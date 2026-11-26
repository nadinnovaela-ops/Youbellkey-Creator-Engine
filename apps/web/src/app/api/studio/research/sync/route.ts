import type { ResearchSourceRow } from '@youbellkey/database';
import { TriggerResearchSyncRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';
import { enqueueResearchSyncJob, runQuickResearchSync } from '../../../../../lib/research-sync';

export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, TriggerResearchSyncRequestSchema);
  if (!parsed.ok) return parsed.response;

  let query = ctx.supabase
    .from('research_sources')
    .select('*')
    .eq('workspace_id', ctx.workspace.id)
    .eq('is_active', true);

  if (parsed.data.sourceId) {
    query = query.eq('id', parsed.data.sourceId);
  }

  const { data: sourcesData, error } = await query;
  if (error) {
    return jsonError(500, 'RESEARCH_SOURCES_LOAD_FAILED', error.message);
  }

  const sources = (sourcesData ?? []) as ResearchSourceRow[];
  if (sources.length === 0) {
    return jsonError(400, 'NO_ACTIVE_RESEARCH_SOURCES', 'Tambahkan minimal 1 channel pantauan aktif terlebih dahulu.');
  }

  try {
    if (parsed.data.mode === 'quick') {
      const result = await runQuickResearchSync(ctx, sources);
      return NextResponse.json({ ok: true, mode: 'quick', ...result });
    }

    const jobId = await enqueueResearchSyncJob(ctx, sources);
    return NextResponse.json({ ok: true, mode: 'worker', jobId, queuedSourcesCount: sources.length });
  } catch (err) {
    return jsonError(500, 'RESEARCH_SYNC_FAILED', err instanceof Error ? err.message : 'Research sync failed.');
  }
}
