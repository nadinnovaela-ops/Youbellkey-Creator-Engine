import { createSupabaseAdminClient } from '@youbellkey/database';
import { HeartbeatRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, HeartbeatRequestSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const newLeaseIso = new Date(Date.now() + 120 * 1000).toISOString();

  await admin
    .from('workers')
    .update({
      status: parsed.data.jobId ? 'BUSY' : 'ONLINE',
      last_heartbeat_at: nowIso,
    })
    .eq('id', worker.id);

  if (parsed.data.jobId) {
    const updateFields: Record<string, unknown> = {
      lease_expires_at: newLeaseIso,
      updated_at: nowIso,
    };
    if (typeof parsed.data.progress === 'number') {
      updateFields.progress = parsed.data.progress;
    }

    const { error: jobError } = await admin
      .from('jobs')
      .update(updateFields)
      .eq('id', parsed.data.jobId)
      .eq('workspace_id', worker.workspace_id)
      .eq('locked_by_worker_id', worker.id)
      .eq('status', 'RUNNING');

    if (jobError) {
      return jsonError(500, 'HEARTBEAT_JOB_UPDATE_FAILED', jobError.message);
    }
  }

  const { data: workspace } = await admin
    .from('workspaces')
    .select('kill_switch_active')
    .eq('id', worker.workspace_id)
    .single();

  return NextResponse.json({
    ok: true,
    leaseExpiresAt: newLeaseIso,
    killSwitchActive: Boolean((workspace as { kill_switch_active?: boolean } | null)?.kill_switch_active),
  });
}
