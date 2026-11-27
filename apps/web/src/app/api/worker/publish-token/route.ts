import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { WorkerPublishTokenRequestSchema } from '@youbellkey/job-contracts';
import { refreshGoogleOAuthAccessToken } from '@youbellkey/publishing-adapters';
import { NextResponse } from 'next/server';
import { decryptSecret } from '../../../../lib/crypto';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { createMediaDownloadUrl } from '../../../../lib/media-storage';
import { authenticateWorker } from '../../../../lib/worker-auth';

/**
 * Issues a short-lived Google OAuth access_token and optional R2 download URL strictly
 * to an authenticated worker holding a RUNNING publish job lease when Kill Switch is OFF.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, WorkerPublishTokenRequestSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();

  // 1. Check workspace kill switch immediately
  const { data: ws } = await admin
    .from('workspaces')
    .select('kill_switch_active')
    .eq('id', worker.workspace_id)
    .single();
  if ((ws as { kill_switch_active?: boolean } | null)?.kill_switch_active) {
    return jsonError(403, 'KILL_SWITCH_ACTIVE', 'Workspace Kill Switch aktif. Publikasi diblokir.');
  }

  // 2. Verify active RUNNING publish lease
  const { data: activeJob } = await admin
    .from('jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .eq('workspace_id', worker.workspace_id)
    .eq('locked_by_worker_id', worker.id)
    .eq('job_type', 'PUBLISH_YOUTUBE_SHORTS')
    .eq('status', 'RUNNING')
    .maybeSingle();

  if (!activeJob) {
    return jsonError(409, 'JOB_LEASE_NOT_HELD', 'Worker tidak memegang lease aktif untuk job publish ini.');
  }
  const job = activeJob as JobRow;

  // 3. Verify channel ownership, daily cap, and OAuth refresh token
  const { data: channel } = await admin
    .from('channels')
    .select('id, autopilot_enabled, daily_publish_cap, oauth_tokens_encrypted')
    .eq('id', parsed.data.channelId)
    .eq('workspace_id', worker.workspace_id)
    .maybeSingle();

  if (!channel) {
    return jsonError(404, 'CHANNEL_NOT_FOUND', 'Channel tidak ditemukan di workspace.');
  }

  const chRow = channel as {
    id: string;
    autopilot_enabled: boolean;
    daily_publish_cap: number;
    oauth_tokens_encrypted: string | null;
  };

  if (!chRow.autopilot_enabled) {
    return jsonError(403, 'CHANNEL_AUTOPILOT_DISABLED', 'Autopilot pada channel ini sedang dimatikan.');
  }

  const startOfDayIso = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
  const { count: publishedTodayCount } = await admin
    .from('publications')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', worker.workspace_id)
    .eq('channel_id', chRow.id)
    .eq('status', 'PUBLISHED')
    .gte('created_at', startOfDayIso);

  const publicationId = typeof job.payload?.publicationId === 'string' ? job.payload.publicationId : null;
  const { data: existingPub } = publicationId
    ? await admin
        .from('publications')
        .select('idempotency_key, status')
        .eq('id', publicationId)
        .eq('workspace_id', worker.workspace_id)
        .maybeSingle()
    : { data: null };

  const idempotencyKey =
    (existingPub as { idempotency_key?: string } | null)?.idempotency_key ?? job.idempotency_key;
  const alreadyPublishedWithKey =
    (existingPub as { status?: string } | null)?.status === 'PUBLISHED';

  if (alreadyPublishedWithKey) {
    return jsonError(409, 'ALREADY_PUBLISHED', 'Idempotency key sudah terpublikasi sebelumnya.');
  }

  const masterKeyHex = process.env.YB_SECRETS_MASTER_KEY?.trim() ?? '';
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? '';
  if (!chRow.oauth_tokens_encrypted || !/^[0-9a-fA-F]{64}$/.test(masterKeyHex) || !clientId || !clientSecret) {
    return jsonError(
      503,
      'YOUTUBE_OAUTH_NOT_CONFIGURED',
      'OAuth YouTube channel atau GOOGLE_OAUTH_CLIENT_ID/SECRET belum dihubungkan.',
    );
  }

  let refreshToken = '';
  try {
    const decrypted = decryptSecret(chRow.oauth_tokens_encrypted, masterKeyHex);
    const parsedTok = JSON.parse(decrypted) as { refreshToken?: string };
    refreshToken = parsedTok.refreshToken ?? decrypted;
  } catch {
    return jsonError(500, 'OAUTH_DECRYPT_FAILED', 'Gagal mendekripsi OAuth token channel.');
  }

  const tokenResult = await refreshGoogleOAuthAccessToken({
    refreshToken,
    clientId,
    clientSecret,
  });

  // 4. Optional short-lived signed download URL (Cloudflare R2 or Supabase Storage fallback)
  let downloadUrl: string | null = null;
  if (job.project_id) {
    const { data: asset } = await admin
      .from('media_assets')
      .select('r2_key')
      .eq('workspace_id', worker.workspace_id)
      .eq('project_id', job.project_id)
      .eq('asset_type', 'render-mp4')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const storedKey = (asset as { r2_key?: string } | null)?.r2_key;
    if (storedKey) {
      const dl = await createMediaDownloadUrl({
        admin,
        storedKey,
        expiresInSeconds: 3600,
      });
      downloadUrl = dl.url;
    }
  }

  return NextResponse.json({
    ok: true,
    accessToken: tokenResult.accessToken,
    expiresAt: new Date(Date.now() + tokenResult.expiresInSeconds * 1000).toISOString(),
    downloadUrl,
    idempotencyKey,
    alreadyPublishedWithKey,
    channelGuardrails: {
      publishedTodayCount: publishedTodayCount ?? 0,
      dailyPublishCap: chRow.daily_publish_cap,
      autopilotEnabled: chRow.autopilot_enabled,
    },
  });
}
