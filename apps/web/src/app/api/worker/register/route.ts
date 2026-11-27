import { createSupabaseAdminClient } from '@youbellkey/database';
import { RegisterWorkerRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker, bootstrapPersonalWorkerIfAllowed } from '../../../../lib/worker-auth';

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, RegisterWorkerRequestSchema);
  if (!parsed.ok) return parsed.response;

  let worker = await authenticateWorker(request);
  if (!worker) {
    worker = await bootstrapPersonalWorkerIfAllowed(
      request,
      parsed.data.workerName,
      parsed.data.platformArch,
      parsed.data.capabilities,
    );
  }

  if (!worker) {
    return jsonError(
      401,
      'WORKER_UNAUTHORIZED',
      'Invalid worker token. Generate a worker token in Studio or verify YB_WORKER_TOKEN.',
    );
  }

  const admin = createSupabaseAdminClient();
  await admin.rpc('reclaim_expired_leases');

  const { error } = await admin
    .from('workers')
    .update({
      worker_name: parsed.data.workerName,
      platform_arch: parsed.data.platformArch,
      capabilities: parsed.data.capabilities,
      status: 'ONLINE',
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', worker.id);

  if (error) {
    return jsonError(500, 'WORKER_REGISTER_FAILED', error.message);
  }

  return NextResponse.json({
    ok: true,
    workerId: worker.id,
    workspaceId: worker.workspace_id,
    heartbeatIntervalSeconds: 30,
    leaseTtlSeconds: 900,
  });
}
