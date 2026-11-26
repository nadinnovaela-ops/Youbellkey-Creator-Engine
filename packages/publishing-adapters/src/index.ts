export interface AutopilotMediaCheckInput {
  workspaceKillSwitchActive: boolean;
  channelAutopilotEnabled: boolean;
  publishedTodayCount: number;
  dailyPublishCap: number;
  idempotencyKey: string;
  alreadyPublishedWithKey: boolean;
  width: number;
  height: number;
  durationSeconds: number;
  hasAudioTrack: boolean;
  audioPeakDb: number;
  captionsCount: number;
}

export interface AutopilotGuardrailResult {
  allowed: boolean;
  reasons: string[];
}

export interface YoutubeUploadMetadataInput {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  publishAtIso?: string;
  defaultLanguage?: 'id' | 'en';
}

export interface YoutubeResumableUploadResult {
  externalVideoId: string;
  privacyStatus: string;
  publishAt: string | null;
}

const MIN_SHORTS_DURATION_SECONDS = 5;
const MAX_SHORTS_DURATION_SECONDS = 180;
const SILENT_AUDIO_THRESHOLD_DB = -60;

/**
 * Validates every safety invariant before an Autopilot upload to YouTube Shorts
 * (or future Meta Reels) is permitted to execute.
 */
export function evaluateAutopilotGuardrails(
  input: AutopilotMediaCheckInput,
): AutopilotGuardrailResult {
  const reasons: string[] = [];

  if (input.workspaceKillSwitchActive) {
    reasons.push('Workspace kill switch is active.');
  }
  if (!input.channelAutopilotEnabled) {
    reasons.push('Channel autopilot is disabled.');
  }
  if (input.publishedTodayCount >= input.dailyPublishCap) {
    reasons.push(`Daily publish cap reached (${input.publishedTodayCount}/${input.dailyPublishCap}).`);
  }
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    reasons.push('Invalid idempotency key.');
  }
  if (input.alreadyPublishedWithKey) {
    reasons.push('Duplicate upload blocked by idempotency key.');
  }
  if (input.width !== 1080 || input.height !== 1920) {
    reasons.push(`Expected 1080x1920 vertical video, got ${input.width}x${input.height}.`);
  }
  if (
    input.durationSeconds < MIN_SHORTS_DURATION_SECONDS ||
    input.durationSeconds > MAX_SHORTS_DURATION_SECONDS
  ) {
    reasons.push(`Duration ${input.durationSeconds}s outside allowed Shorts range (5..180s).`);
  }
  if (!input.hasAudioTrack || input.audioPeakDb <= SILENT_AUDIO_THRESHOLD_DB) {
    reasons.push('Audio track missing or below silence threshold.');
  }
  if (input.captionsCount <= 0) {
    reasons.push('Synchronized captions missing.');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function buildYoutubeShortsMetadata(input: YoutubeUploadMetadataInput) {
  const cleanTitle = input.title.trim().slice(0, 90);
  const titleWithTag = cleanTitle.toLowerCase().includes('#shorts')
    ? cleanTitle
    : `${cleanTitle} #Shorts`.slice(0, 100);

  const isScheduled = Boolean(input.publishAtIso);
  const effectivePrivacy = isScheduled ? 'private' : (input.privacyStatus ?? 'public');

  return {
    snippet: {
      title: titleWithTag,
      description: `${input.description.trim()}\n\n#Shorts`.slice(0, 4900),
      tags: [...new Set(['Shorts', ...(input.tags ?? [])])].slice(0, 20),
      categoryId: input.categoryId ?? '22',
      defaultLanguage: input.defaultLanguage ?? 'id',
    },
    status: {
      privacyStatus: effectivePrivacy,
      selfDeclaredMadeForKids: false,
      ...(input.publishAtIso ? { publishAt: input.publishAtIso } : {}),
    },
  };
}

/**
 * Exchanges a decrypted OAuth refresh_token on the Control Plane server
 * for a short-lived Google OAuth access_token. Never called in frontend code.
 */
export async function refreshGoogleOAuthAccessToken(options: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    refresh_token: options.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Google OAuth token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('Google OAuth response did not include access_token.');
  }

  return {
    accessToken: json.access_token,
    expiresInSeconds: Number(json.expires_in ?? 3500),
  };
}

/**
 * Executes a YouTube Data API v3 resumable video upload directly from the Worker
 * using a short-lived access token (bypassing Vercel serverless payload limits).
 */
export async function uploadYoutubeResumableVideo(options: {
  accessToken: string;
  videoBytes: Uint8Array;
  metadata: YoutubeUploadMetadataInput;
}): Promise<YoutubeResumableUploadResult> {
  const ytBody = buildYoutubeShortsMetadata(options.metadata);

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(options.videoBytes.byteLength),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(ytBody),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!initRes.ok) {
    throw new Error(`YouTube resumable upload init failed (${initRes.status}): ${(await initRes.text()).slice(0, 220)}`);
  }

  const uploadSessionUri = initRes.headers.get('location');
  if (!uploadSessionUri) {
    throw new Error('YouTube API did not return resumable Location header.');
  }

  const putRes = await fetch(uploadSessionUri, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(options.videoBytes.byteLength),
    },
    body: new Blob([new Uint8Array(options.videoBytes)], { type: 'video/mp4' }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!putRes.ok) {
    throw new Error(`YouTube resumable binary upload failed (${putRes.status}): ${(await putRes.text()).slice(0, 220)}`);
  }

  const created = (await putRes.json()) as {
    id?: string;
    status?: { privacyStatus?: string; publishAt?: string };
  };
  if (!created.id) {
    throw new Error('YouTube upload succeeded without returning video ID.');
  }

  return {
    externalVideoId: created.id,
    privacyStatus: created.status?.privacyStatus ?? ytBody.status.privacyStatus,
    publishAt: created.status?.publishAt ?? null,
  };
}

/**
 * Validates Phase 4.2 Meta Reels (Instagram & Facebook) publishing preconditions
 * relying on short-lived Cloudflare R2 presigned GET URLs.
 */
export function validateMetaReelsPublishInput(input: {
  platform: 'instagram_reels' | 'facebook_reels';
  r2PresignedGetUrl: string;
  caption: string;
}): { valid: boolean; reason?: string } {
  if (!input.r2PresignedGetUrl.startsWith('https://')) {
    return { valid: false, reason: 'Meta Reels API requires an HTTPS presigned media URL from Cloudflare R2.' };
  }
  if (!input.caption.trim()) {
    return { valid: false, reason: 'Caption is required for Reels publishing.' };
  }
  return { valid: true };
}
