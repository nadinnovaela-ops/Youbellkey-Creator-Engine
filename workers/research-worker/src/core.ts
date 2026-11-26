export interface ViralScoreComponents {
  growthVelocityNorm: number; // 0..1
  outlierRatioNorm: number; // 0..1
  relativeEngagementNorm: number; // 0..1
  nicheRelevanceNorm: number; // 0..1
  noveltyNorm: number; // 0..1
}

export interface ParsedYoutubeRssEntry {
  videoId: string;
  videoUrl: string;
  title: string;
  publishedAt: string;
  authorName: string;
  description: string;
  viewCount: number;
}

export interface YoutubeVideoApiStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number | null;
  tags: string[];
}

export interface ScoredResearchCandidate {
  externalVideoId: string;
  videoUrl: string;
  title: string;
  viewCount: number;
  outlierScore: number;
  growthVelocity: number;
  viralScore: number;
  metadata: Record<string, unknown>;
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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function extractTagContent(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match?.[1] ? decodeXmlEntities(match[1]) : '';
}

export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const candidate = parsed.pathname.split('/').filter(Boolean)[0];
      return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) return vParam;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if ((segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') && segments[1]) {
        return /^[A-Za-z0-9_-]{11}$/.test(segments[1]) ? segments[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function extractYoutubeChannelIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  const channelMatch = trimmed.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (channelMatch?.[1]) return channelMatch[1];

  const feedMatch = trimmed.match(/[?&]channel_id=(UC[A-Za-z0-9_-]{20,})/);
  if (feedMatch?.[1]) return feedMatch[1];

  return null;
}

export async function resolveYoutubeChannelId(channelInput: string): Promise<{ channelId: string }> {
  const direct = extractYoutubeChannelIdFromInput(channelInput);
  if (direct) return { channelId: direct };

  const trimmed = channelInput.trim();
  const targetUrl = trimmed.startsWith('http')
    ? trimmed
    : trimmed.startsWith('@')
      ? `https://www.youtube.com/${trimmed}`
      : `https://www.youtube.com/@${trimmed}`;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; YoubellkeyResearch/1.0)',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Gagal membuka halaman channel YouTube (${res.status}). Gunakan Channel ID (UC...) secara langsung.`);
  }

  const html = await res.text();
  const patterns = [
    /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
    /"externalId":"(UC[A-Za-z0-9_-]{20,})"/,
    /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) {
      return { channelId: match[1] };
    }
  }

  throw new Error('Tidak dapat menemukan Channel ID (UC...) dari URL/handle tersebut. Masukkan ID UC... secara manual.');
}

export function parseYoutubeRssXml(xml: string): ParsedYoutubeRssEntry[] {
  const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const entries: ParsedYoutubeRssEntry[] = [];

  for (const block of entryMatches) {
    const videoId = extractTagContent(block, 'yt:videoId');
    if (!videoId) continue;

    const title = extractTagContent(block, 'title') || `YouTube Video ${videoId}`;
    const publishedAt = extractTagContent(block, 'published') || new Date().toISOString();
    const authorName = extractTagContent(block, 'name') || 'Unknown Creator';
    const description = extractTagContent(block, 'media:description');
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
    const statsMatch = block.match(/<media:statistics[^>]+views="(\d+)"/i);

    entries.push({
      videoId,
      videoUrl: linkMatch?.[1] ? decodeXmlEntities(linkMatch[1]) : `https://www.youtube.com/watch?v=${videoId}`,
      title,
      publishedAt,
      authorName,
      description,
      viewCount: statsMatch?.[1] ? Number(statsMatch[1]) : 0,
    });
  }

  return entries;
}

export async function fetchYoutubeChannelRssFeed(channelId: string): Promise<ParsedYoutubeRssEntry[]> {
  const rssUrl = buildYoutubeChannelRssUrl(channelId);
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Youbellkey-Creator-Engine/1.0' },
  });
  if (!res.ok) {
    throw new Error(`YouTube RSS fetch failed (${res.status}) for channel ${channelId}`);
  }
  const xml = await res.text();
  return parseYoutubeRssXml(xml);
}

export function parseIso8601DurationSeconds(isoDuration: string | undefined): number | null {
  if (!isoDuration) return null;
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Batches up to 50 video IDs per YouTube Data API v3 `videos.list` request (1 quota unit).
 */
export async function fetchYoutubeVideoStatsBatch(
  videoIds: string[],
  youtubeApiKey?: string,
): Promise<Map<string, YoutubeVideoApiStats>> {
  const statsMap = new Map<string, YoutubeVideoApiStats>();
  const key = youtubeApiKey?.trim();
  if (!key || videoIds.length === 0) return statsMap;

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics,contentDetails');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', key);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`YouTube Data API videos.list failed (${res.status})`);
    }

    const payload = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: { tags?: string[] };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
        contentDetails?: { duration?: string };
      }>;
    };

    for (const item of payload.items ?? []) {
      statsMap.set(item.id, {
        videoId: item.id,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
        durationSeconds: parseIso8601DurationSeconds(item.contentDetails?.duration),
        tags: item.snippet?.tags ?? [],
      });
    }
  }

  return statsMap;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

export function scoreResearchEntries(
  entries: ParsedYoutubeRssEntry[],
  options: {
    niche?: string;
    apiStats?: Map<string, YoutubeVideoApiStats>;
    nowMs?: number;
  } = {},
): ScoredResearchCandidate[] {
  if (entries.length === 0) return [];
  const nowMs = options.nowMs ?? Date.now();
  const nicheTokens = (options.niche ?? '')
    .toLowerCase()
    .split(/[\s,/|]+/)
    .filter((t) => t.length >= 3);

  const viewsList = entries.map((e) => options.apiStats?.get(e.videoId)?.viewCount ?? e.viewCount);
  const medianViews = Math.max(1, computeMedian(viewsList));

  return entries
    .map((entry) => {
      const api = options.apiStats?.get(entry.videoId);
      const viewCount = api?.viewCount ?? entry.viewCount;
      const publishedMs = Date.parse(entry.publishedAt) || nowMs;
      const ageHours = Math.max(1, (nowMs - publishedMs) / (1000 * 60 * 60));

      const outlierScore = Number((viewCount / medianViews).toFixed(3));
      const growthVelocity = Number((viewCount / ageHours).toFixed(2));

      const engagementRatio =
        api && viewCount > 0 ? (api.likeCount + api.commentCount * 2) / viewCount : 0.04;

      const haystack = `${entry.title} ${entry.description}`.toLowerCase();
      const matchedTokens = nicheTokens.filter((token) => haystack.includes(token));
      const nicheRelevanceNorm =
        nicheTokens.length === 0 ? 0.8 : Math.min(1, 0.55 + (matchedTokens.length / nicheTokens.length) * 0.45);

      const noveltyNorm = ageHours <= 48 ? 1 : ageHours <= 168 ? 0.8 : ageHours <= 720 ? 0.55 : 0.3;

      const viralScore = computeViralScore({
        growthVelocityNorm: Math.min(1, growthVelocity / 5000),
        outlierRatioNorm: Math.min(1, outlierScore / 3),
        relativeEngagementNorm: Math.min(1, engagementRatio / 0.08),
        nicheRelevanceNorm,
        noveltyNorm,
      });

      return {
        externalVideoId: entry.videoId,
        videoUrl: entry.videoUrl,
        title: entry.title,
        viewCount,
        outlierScore,
        growthVelocity,
        viralScore,
        metadata: {
          authorName: entry.authorName,
          publishedAt: entry.publishedAt,
          description: entry.description.slice(0, 600),
          durationSeconds: api?.durationSeconds ?? null,
          isLikelyShort: api?.durationSeconds !== null && api?.durationSeconds !== undefined ? api.durationSeconds <= 65 : null,
          likeCount: api?.likeCount ?? null,
          commentCount: api?.commentCount ?? null,
        },
      };
    })
    .sort((a, b) => b.viralScore - a.viralScore);
}

/**
 * Cleans WebVTT captions into readable deduplicated plain text.
 */
export function parseVttTranscript(vttContent: string): string {
  const lines = vttContent.split(/\r?\n/);
  const cleaned: string[] = [];
  let prev = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line === 'WEBVTT' ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:') ||
      line.startsWith('NOTE') ||
      /^\d+$/.test(line) ||
      line.includes('-->')
    ) {
      continue;
    }

    const plain = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!plain || plain === prev) continue;
    prev = plain;
    cleaned.push(plain);
  }

  return cleaned.join(' ').replace(/\s+/g, ' ').trim();
}
