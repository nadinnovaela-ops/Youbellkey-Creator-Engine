import crypto from 'node:crypto';
import type { ResearchSourceRow } from '@youbellkey/database';
import {
  fetchYoutubeChannelRssFeed,
  fetchYoutubeVideoStatsBatch,
  scoreResearchEntries,
} from '@youbellkey/research-worker/core';
import type { AuthenticatedContext } from './auth';
import { resolveWorkspaceAiKeys } from './vault';

export async function runQuickResearchSync(
  ctx: AuthenticatedContext,
  sources: ResearchSourceRow[],
): Promise<{ syncedCount: number; savedItemsCount: number; warnings: string[] }> {
  const keys = await resolveWorkspaceAiKeys(ctx.workspace.id);
  const ytApiKey = keys['youtube-data-api'];
  const warnings: string[] = [];
  const rowsToUpsert: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    try {
      const entries = await fetchYoutubeChannelRssFeed(source.external_channel_id);
      let apiStats: Awaited<ReturnType<typeof fetchYoutubeVideoStatsBatch>> | undefined;

      if (ytApiKey && entries.length > 0) {
        try {
          apiStats = await fetchYoutubeVideoStatsBatch(
            entries.map((e) => e.videoId),
            ytApiKey,
          );
        } catch (err) {
          warnings.push(`YouTube API enrichment skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const scored = scoreResearchEntries(entries, { niche: source.niche, apiStats });
      for (const item of scored.slice(0, 15)) {
        rowsToUpsert.push({
          workspace_id: ctx.workspace.id,
          source_id: source.id,
          external_video_id: item.externalVideoId,
          video_url: item.videoUrl,
          title: item.title.slice(0, 200),
          view_count: item.viewCount,
          outlier_score: item.outlierScore,
          growth_velocity: item.growthVelocity,
          viral_score: item.viralScore,
          metadata: item.metadata,
        });
      }
    } catch (err) {
      warnings.push(`RSS ${source.external_channel_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await ctx.supabase
      .from('research_items')
      .upsert(rowsToUpsert, { onConflict: 'workspace_id,external_video_id' });
    if (error) {
      throw new Error(`Failed saving research items: ${error.message}`);
    }
  }

  return {
    syncedCount: sources.length,
    savedItemsCount: rowsToUpsert.length,
    warnings,
  };
}

export async function enqueueResearchSyncJob(
  ctx: AuthenticatedContext,
  sources: ResearchSourceRow[],
): Promise<string> {
  const { data, error } = await ctx.supabase
    .from('jobs')
    .insert({
      workspace_id: ctx.workspace.id,
      job_type: 'RESEARCH_SYNC',
      required_capability: 'research',
      status: 'QUEUED',
      priority: 40,
      payload: {
        sources: sources.map((s) => ({
          id: s.id,
          externalChannelId: s.external_channel_id,
          niche: s.niche,
          locale: s.locale,
        })),
        requestedAt: new Date().toISOString(),
      },
      idempotency_key: `research-sync-${crypto.randomUUID()}`,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to enqueue RESEARCH_SYNC job.');
  }
  return (data as { id: string }).id;
}
