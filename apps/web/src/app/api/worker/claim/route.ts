import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { ClaimJobRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

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
    p_lease_seconds: 120,
  });

  if (claimError) {
    return jsonError(500, 'JOB_CLAIM_FAILED', claimError.message);
  }

  const job = Array.isArray(claimedRows) && claimedRows.length > 0 ? (claimedRows[0] as JobRow) : null;

  await admin
    .from('workers')
    .update({
      status: job ? 'BUSY' : 'ONLINE',
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', worker.id);

  if (!job) {
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({
    job: {
      jobId: job.id,
      workspaceId: job.workspace_id,
      projectId: job.project_id,
      jobType: job.job_type,
      attemptCount: job.attempt_count,
      leaseExpiresAt: job.lease_expires_at,
      idempotencyKey: job.idempotency_key,
      payload: job.payload,
    },
  });
}
