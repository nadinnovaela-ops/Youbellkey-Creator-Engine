export interface ViralScoreComponents {
  growthVelocityNorm: number; // 0..1
  outlierRatioNorm: number;   // 0..1
  relativeEngagementNorm: number; // 0..1
  nicheRelevanceNorm: number; // 0..1
  noveltyNorm: number;        // 0..1
}

export function buildYoutubeChannelRssUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/**
 * Computes initial weighted Viral Score V = 0.30G + 0.25O + 0.20E + 0.15R + 0.10N.
 */
export function computeViralScore(input: ViralScoreComponents): number {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const score =
    0.3 * clamp(input.growthVelocityNorm) +
    0.25 * clamp(input.outlierRatioNorm) +
    0.2 * clamp(input.relativeEngagementNorm) +
    0.15 * clamp(input.nicheRelevanceNorm) +
    0.1 * clamp(input.noveltyNorm);
  return Number((score * 100).toFixed(2));
}
