import { createSupabaseAdminClient } from '@youbellkey/database';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError } from '../../../../../../lib/http';

/**
 * Status yang boleh dibatalkan dari PWA. Terminal statuses
 * (APPROVED, PUBLISHED, FAILED, SCHEDULED) tidak dapat dibatalkan di sini.
 */
const CANCELABLE_STATUSES = new Set(['QUEUED', 'RUNNING', 'RETRY_PENDING', 'PUBLISHING']);

/**
 * POST /api/studio/jobs/[id]/cancel
 *
 * Membatalkan job dari Studio PWA (Supabase Auth user), bukan dari worker token.
 * Melepaskan lease dan mengubah status menjadi FAILED dengan pesan "dibatalkan",
 * sehingga job tidak terjebak selamanya (mis. worker mati namun lease belum expired)
 * dan antrean dapat dibersihkan/dibatalkan oleh pengguna. Worker yang masih memegang
 * job RUNNING akan mendeteksi kehilangan lease (heartbeat 409) dan berhenti otomatis.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const { id } = await context.params;
  if (!id) return jsonError(400, 'MISSING_JOB_ID', 'Job ID required.');

  const admin = createSupabaseAdminClient();

  const { data: job, error: fetchErr } = await admin
    .from('jobs')
    .select('id, job_type, project_id, status, workspace_id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (fetchErr || !job) {
    return jsonError(404, 'JOB_NOT_FOUND', 'Job tidak ditemukan di workspace ini.');
  }

  if (!CANCELABLE_STATUSES.has(String(job.status))) {
    return jsonError(
      409,
      'JOB_NOT_CANCELABLE',
      `Job status adalah '${job.status}'. Hanya job QUEUED / RUNNING / RETRY_PENDING / PUBLISHING yang dapat dibatalkan.`,
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('jobs')
    .update({
      status: 'FAILED',
      locked_by_worker_id: null,
      lease_expires_at: null,
      error_message: 'Dibatalkan dari Studio PWA.',
      updated_at: nowIso,
    })
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .in('status', Array.from(CANCELABLE_STATUSES));

  if (updateErr) {
    return jsonError(500, 'JOB_CANCEL_FAILED', updateErr.message);
  }

  // Untuk publish yang dibatalkan sebelum selesai, tandai publication FAILED agar tidak menggantung.
  if (job.job_type === 'PUBLISH_YOUTUBE_SHORTS' && job.project_id) {
    await admin
      .from('publications')
      .update({ status: 'FAILED', updated_at: nowIso })
      .eq('project_id', job.project_id)
      .eq('workspace_id', ctx.workspace.id)
      .eq('status', 'PENDING');
  }

  return NextResponse.json({
    ok: true,
    jobId: id,
    jobType: job.job_type,
    status: 'FAILED',
    message: `Job ${job.job_type} dibatalkan. ${
      job.status === 'RUNNING' ? 'Worker akan berhenti otomatis pada heartbeat berikutnya.' : ''
    }`.trim(),
  });
}
