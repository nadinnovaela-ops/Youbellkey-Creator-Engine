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
    const nextStatus = job.job_type === 'PUBLISH_YOUTUBE_SHORTS' ? 'PUBLISHED' : 'APPROVED';
    const nextPayload = {
      ...(job.payload ?? {}),
      lastResult: parsed.data.result ?? {},
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
