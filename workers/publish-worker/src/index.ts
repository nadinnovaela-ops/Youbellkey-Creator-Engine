import {
  evaluateAutopilotGuardrails,
  uploadYoutubeResumableVideo,
  type AutopilotGuardrailResult,
  type AutopilotMediaCheckInput,
  type YoutubeUploadMetadataInput,
  type YoutubeResumableUploadResult,
} from '@youbellkey/publishing-adapters';

export function checkShortsAutopilotReadiness(
  input: AutopilotMediaCheckInput,
): AutopilotGuardrailResult {
  return evaluateAutopilotGuardrails(input);
}

export async function publishYoutubeShortFromWorker(options: {
  accessToken: string;
  videoBytes: Uint8Array;
  guardrailsInput: AutopilotMediaCheckInput;
  metadata: YoutubeUploadMetadataInput;
}): Promise<YoutubeResumableUploadResult> {
  const verdict = evaluateAutopilotGuardrails(options.guardrailsInput);
  if (!verdict.allowed) {
    throw new Error(`Autopilot publish blocked by guardrails: ${verdict.reasons.join('; ')}`);
  }

  return uploadYoutubeResumableVideo({
    accessToken: options.accessToken,
    videoBytes: options.videoBytes,
    metadata: options.metadata,
  });
}
