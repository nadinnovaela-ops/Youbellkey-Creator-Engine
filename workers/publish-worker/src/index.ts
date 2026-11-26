import {
  evaluateAutopilotGuardrails,
  type AutopilotGuardrailResult,
  type AutopilotMediaCheckInput,
} from '@youbellkey/publishing-adapters';

export function checkShortsAutopilotReadiness(
  input: AutopilotMediaCheckInput,
): AutopilotGuardrailResult {
  return evaluateAutopilotGuardrails(input);
}
