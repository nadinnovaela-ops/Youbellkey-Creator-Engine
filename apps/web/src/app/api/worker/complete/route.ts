import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { CompleteJobRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, CompleteJobRequestSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();
  const { data: existingJob, error: fetchError } = await admin
    .from('jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .eq('workspace_id', worker.workspace_id)
    .eq('locked_by_worker_id', worker.id)
    .eq('status', 'RUNNING')
    .maybeSingle();

  if (fetchError || !existingJob) {
    return jsonError(409, 'JOB_LEASE_NOT_HELD', 'Worker does not hold an active RUNNING lease for this job.');
  }

  const job = existingJob as JobRow;
  const nowIso = new Date().toISOString();

  if (parsed.data.status === 'SUCCEEDED') {
    const resultPayload = (parsed.data.result ?? {}) as Record<string, unknown>;

    // Persist Phase 2 job outputs into workspace-scoped research tables.
    if (job.job_type === 'RESEARCH_SYNC' && Array.isArray(resultPayload.discoveredItems)) {
      const rowsToUpsert = resultPayload.discoveredItems
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          workspace_id: worker.workspace_id,
          source_id: typeof item.sourceId === 'string' ? item.sourceId : null,
          external_video_id: String(item.externalVideoId ?? ''),
          video_url: String(item.videoUrl ?? ''),
          title: String(item.title ?? 'Untitled Video').slice(0, 200),
          view_count: Number(item.viewCount ?? 0),
          outlier_score: Number(item.outlierScore ?? 0),
          growth_velocity: Number(item.growthVelocity ?? 0),
          viral_score: Number(item.viralScore ?? 0),
          metadata:
            item.metadata && typeof item.metadata === 'object'
              ? (item.metadata as Record<string, unknown>)
              : {},
        }))
        .filter((row) => row.external_video_id.length > 0 && row.video_url.length > 0);

      if (rowsToUpsert.length > 0) {
        const { error: upsertErr } = await admin
          .from('research_items')
          .upsert(rowsToUpsert, { onConflict: 'workspace_id,external_video_id' });
        if (upsertErr) {
          return jsonError(500, 'RESEARCH_ITEMS_SAVE_FAILED', upsertErr.message);
        }
      }
    }

    if (job.job_type === 'REFERENCE_TRANSCRIPT') {
      const researchItemId =
        typeof resultPayload.researchItemId === 'string'
          ? resultPayload.researchItemId
          : typeof job.payload?.researchItemId === 'string'
            ? job.payload.researchItemId
            : null;
      const transcriptText =
        typeof resultPayload.transcriptText === 'string' ? resultPayload.transcriptText.trim() : '';

      if (researchItemId && transcriptText) {
        const { error: transcriptErr } = await admin
          .from('research_items')
          .update({
            transcript_text: transcriptText,
          })
          .eq('id', researchItemId)
          .eq('workspace_id', worker.workspace_id);
        if (transcriptErr) {
          return jsonError(500, 'TRANSCRIPT_SAVE_FAILED', transcriptErr.message);
        }
      }
    }

    const nextStatus = job.job_type === 'PUBLISH_YOUTUBE_SHORTS' ? 'PUBLISHED' : 'APPROVED';
    const nextPayload = {
      ...(job.payload ?? {}),
      lastResult:
        job.job_type === 'RESEARCH_SYNC'
          ? {
              syncedSourcesCount: resultPayload.syncedSourcesCount ?? 0,
              discoveredCount: Array.isArray(resultPayload.discoveredItems)
                ? resultPayload.discoveredItems.length
                : 0,
              warnings: resultPayload.warnings ?? [],
            }
          : resultPayload,
      completedAt: nowIso,
    };

    const { error: completeError } = await admin
      .from('jobs')
      .update({
        status: nextStatus,
        progress: 100,
        payload: nextPayload,
        locked_by_worker_id: null,
        lease_expires_at: null,
        error_message: null,
        updated_at: nowIso,
      })
      .eq('id', job.id);

    if (completeError) {
      return jsonError(500, 'JOB_COMPLETE_FAILED', completeError.message);
    }
  } else {
    const nextStatus = job.attempt_count >= job.max_attempts ? 'FAILED' : 'RETRY_PENDING';
    const { error: failError } = await admin
      .from('jobs')
      .update({
        status: nextStatus,
        locked_by_worker_id: null,
        lease_expires_at: null,
        error_message: parsed.data.errorMessage ?? parsed.data.errorCode ?? 'Worker execution failed',
        updated_at: nowIso,
      })
      .eq('id', job.id);

    if (failError) {
      return jsonError(500, 'JOB_FAIL_UPDATE_FAILED', failError.message);
    }
  }

  await admin
    .from('workers')
    .update({ status: 'ONLINE', last_heartbeat_at: nowIso })
    .eq('id', worker.id);

  return NextResponse.json({ ok: true });
}
