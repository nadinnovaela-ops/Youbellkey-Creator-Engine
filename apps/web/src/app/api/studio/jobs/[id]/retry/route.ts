import { createSupabaseAdminClient } from '@youbellkey/database';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError } from '../../../../../../lib/http';

/**
 * POST /api/studio/jobs/[id]/retry
 * Reset job yang status=FAILED kembali ke QUEUED untuk bisa di-retry manual.
 * Useful untuk RENDER_HYPERFRAMES yang gagal karena lease expired.
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
    .select('id, job_type, project_id, status, attempt_count, max_attempts, workspace_id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (fetchErr || !job) {
    return jsonError(404, 'JOB_NOT_FOUND', 'Job tidak ditemukan di workspace ini.');
  }

  if (job.status !== 'FAILED') {
    return jsonError(
      409,
      'JOB_NOT_FAILED',
      `Job status adalah '${job.status}', bukan FAILED. Hanya job FAILED yang bisa di-retry.`,
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('jobs')
    .update({
      status: 'QUEUED',
      progress: 0,
      attempt_count: 0,
      locked_by_worker_id: null,
      lease_expires_at: null,
      error_message: null,
      updated_at: nowIso,
    })
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .eq('status', 'FAILED');

  if (updateErr) {
    return jsonError(500, 'JOB_RETRY_FAILED', updateErr.message);
  }

  if (job.job_type === 'RENDER_HYPERFRAMES' && job.project_id) {
    await admin
      .from('content_projects')
      .update({ status: 'RENDER_QUEUED', updated_at: nowIso })
      .eq('id', job.project_id)
      .eq('workspace_id', ctx.workspace.id);
  }

  return NextResponse.json({
    ok: true,
    jobId: id,
    jobType: job.job_type,
    message: `Job ${job.job_type} direset ke QUEUED. Worker akan mengambilnya di polling berikutnya.`,
  });
}
