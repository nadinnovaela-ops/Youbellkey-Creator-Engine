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
