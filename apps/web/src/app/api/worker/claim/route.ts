import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { ClaimJobRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

const HEAVY_JOB_TYPES = new Set(['RENDER_HYPERFRAMES', 'PUBLISH_YOUTUBE_SHORTS']);
const STANDARD_LEASE_SECONDS = 900;
const HEAVY_LEASE_SECONDS = 1500;

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, ClaimJobRequestSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();
  await admin.rpc('reclaim_expired_leases');

  const { data: claimedRows, error: claimError } = await admin.rpc('claim_next_job', {
    p_worker_id: worker.id,
    p_capabilities: parsed.data.capabilities,
    p_lease_seconds: STANDARD_LEASE_SECONDS,
  });

  if (claimError) {
    return jsonError(500, 'JOB_CLAIM_FAILED', claimError.message);
  }

  const job = Array.isArray(claimedRows) && claimedRows.length > 0 ? (claimedRows[0] as JobRow) : null;
  const nowIso = new Date().toISOString();

  await admin
    .from('workers')
    .update({
      status: job ? 'BUSY' : 'ONLINE',
      last_heartbeat_at: nowIso,
    })
    .eq('id', worker.id);

  if (!job) {
    return NextResponse.json({ job: null });
  }

  const isHeavy = HEAVY_JOB_TYPES.has(job.job_type);
  const effectiveLeaseSeconds = isHeavy ? HEAVY_LEASE_SECONDS : STANDARD_LEASE_SECONDS;
  const leaseExpiresAt = isHeavy
    ? new Date(Date.now() + effectiveLeaseSeconds * 1000).toISOString()
    : job.lease_expires_at;

  // Reset stale progress/error_message from any prior reclaimed attempt,
  // and extend initial lease atomically for heavy render/publish jobs.
  await admin
    .from('jobs')
    .update({
      progress: 0,
      error_message: null,
      ...(isHeavy ? { lease_expires_at: leaseExpiresAt } : {}),
      updated_at: nowIso,
    })
    .eq('id', job.id)
    .eq('locked_by_worker_id', worker.id)
    .eq('status', 'RUNNING');

  return NextResponse.json({
    job: {
      jobId: job.id,
      workspaceId: job.workspace_id,
      projectId: job.project_id,
      jobType: job.job_type,
      attemptCount: job.attempt_count,
      leaseExpiresAt,
      idempotencyKey: job.idempotency_key,
      payload: job.payload,
    },
  });
}
