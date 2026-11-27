import { createSupabaseAdminClient } from '@youbellkey/database';
import { CancelJobRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

/**
 * POST /api/worker/cancel
 *
 * Membatalkan job yang sedang dipegang worker (RUNNING) atau antrean (QUEUED / RETRY_PENDING)
 * milik workspace worker tersebut. Melepaskan lease dan mengubah status menjadi FAILED
 * sehingga job tidak terjebak selamanya dan antrean dapat dilanjutkan job berikutnya.
 *
 * Hanya bisa dipanggil oleh worker yang memiliki token valid dan milik workspace yang sama.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, CancelJobRequestSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Verifikasi worker memiliki lease aktif pada job RUNNING, atau job QUEUED/RETRY_PENDING
  // dalam workspace yang sama.
  const { data: existingJob, error: fetchError } = await admin
    .from('jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .eq('workspace_id', worker.workspace_id)
    .in('status', ['RUNNING', 'QUEUED', 'RETRY_PENDING'])
    .maybeSingle();

  if (fetchError || !existingJob) {
    return jsonError(
      409,
      'JOB_NOT_CANCELABLE',
      'Job tidak ditemukan, bukan milik workspace ini, atau status tidak dapat dibatalkan.',
    );
  }

  // Jika job RUNNING, pastikan worker adalah pemegang lease.
  const job = existingJob as { id: string; locked_by_worker_id: string | null; status: string };
  if (job.status === 'RUNNING' && job.locked_by_worker_id !== worker.id) {
    return jsonError(
      409,
      'JOB_LEASE_NOT_HELD',
      'Worker tidak memiliki lease aktif untuk job RUNNING ini.',
    );
  }

  const { error: cancelError } = await admin
    .from('jobs')
    .update({
      status: 'FAILED',
      locked_by_worker_id: null,
      lease_expires_at: null,
      error_message: parsed.data.reason ?? 'Job dibatalkan oleh worker.',
      updated_at: nowIso,
    })
    .eq('id', parsed.data.jobId);

  if (cancelError) {
    return jsonError(500, 'JOB_CANCEL_FAILED', cancelError.message);
  }

  await admin
    .from('workers')
    .update({ status: 'ONLINE', last_heartbeat_at: nowIso })
    .eq('id', worker.id);

  return NextResponse.json({ ok: true, jobId: parsed.data.jobId, status: 'FAILED' });
}
