import crypto from 'node:crypto';
import type { ResearchItemRow } from '@youbellkey/database';
import { AddResearchVideoUrlRequestSchema } from '@youbellkey/job-contracts';
import { extractYoutubeVideoId } from '@youbellkey/research-worker/core';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';

async function fetchYoutubeOembedTitle(videoUrl: string): Promise<{ title?: string; authorName?: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
    if (!res.ok) return {};
    const json = (await res.json()) as { title?: string; author_name?: string };
    return { title: json.title, authorName: json.author_name };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, AddResearchVideoUrlRequestSchema);
  if (!parsed.ok) return parsed.response;

  const videoId = extractYoutubeVideoId(parsed.data.videoUrl);
  if (!videoId) {
    return jsonError(400, 'INVALID_YOUTUBE_URL', 'URL harus berupa link video atau YouTube Shorts yang valid.');
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembed = await fetchYoutubeOembedTitle(canonicalUrl);
  const title = parsed.data.title?.trim() || oembed.title || `Reference Video (${videoId})`;

  const { data: item, error: itemError } = await ctx.supabase
    .from('research_items')
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        external_video_id: videoId,
        video_url: canonicalUrl,
        title: title.slice(0, 200),
        metadata: {
          addedManually: true,
          locale: parsed.data.locale,
          authorName: oembed.authorName ?? null,
        },
      },
      { onConflict: 'workspace_id,external_video_id' },
    )
    .select('*')
    .single();

  if (itemError || !item) {
    return jsonError(500, 'RESEARCH_ITEM_SAVE_FAILED', itemError?.message ?? 'Gagal menyimpan URL referensi.');
  }

  const savedItem = item as ResearchItemRow;
  let transcriptJobId: string | null = null;

  if (parsed.data.enqueueTranscript && !savedItem.transcript_text) {
    const { data: jobData, error: jobErr } = await ctx.supabase
      .from('jobs')
      .insert({
        workspace_id: ctx.workspace.id,
        job_type: 'REFERENCE_TRANSCRIPT',
        required_capability: 'research',
        status: 'QUEUED',
        priority: 30,
        payload: {
          researchItemId: savedItem.id,
          videoUrl: savedItem.video_url,
          preferredLocale: parsed.data.locale,
        },
        idempotency_key: `transcript-${savedItem.id}-${crypto.randomUUID().slice(0, 8)}`,
      })
      .select('id')
      .single();

    if (!jobErr && jobData) {
      transcriptJobId = (jobData as { id: string }).id;
    }
  }

  return NextResponse.json({ ok: true, item: savedItem, transcriptJobId });
}
