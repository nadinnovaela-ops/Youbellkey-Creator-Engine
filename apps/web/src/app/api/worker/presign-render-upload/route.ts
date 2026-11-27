import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { WorkerPresignRenderUploadSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { createMediaUploadTarget } from '../../../../lib/media-storage';
import { authenticateWorker } from '../../../../lib/worker-auth';

/**
 * Issues a short-lived signed PUT URL strictly scoped to the worker's
 * workspace & active RUNNING render job, preferring Cloudflare R2 and
 * falling back cleanly to Supabase Storage private bucket when R2 is unset (ADR-0005).
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, WorkerPresignRenderUploadSchema);
  if (!parsed.ok) return parsed.response;

  const worker = await authenticateWorker(request);
  if (!worker || worker.id !== parsed.data.workerId) {
    return jsonError(401, 'WORKER_UNAUTHORIZED', 'Worker token mismatch or unknown worker.');
  }

  const admin = createSupabaseAdminClient();
  const { data: activeJob, error: jobErr } = await admin
    .from('jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .eq('workspace_id', worker.workspace_id)
    .eq('locked_by_worker_id', worker.id)
    .eq('status', 'RUNNING')
    .maybeSingle();

  if (jobErr || !activeJob) {
    return jsonError(409, 'JOB_LEASE_NOT_HELD', 'Worker does not hold an active RUNNING render lease.');
  }

  const job = activeJob as JobRow;
  if (job.project_id && job.project_id !== parsed.data.projectId) {
    return jsonError(403, 'PROJECT_MISMATCH', 'Project ID does not match active job lease.');
  }

  const target = await createMediaUploadTarget({
    admin,
    workspaceId: worker.workspace_id,
    projectId: parsed.data.projectId,
    kind: 'render-mp4',
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    expiresInSeconds: 900,
  });

  return NextResponse.json({
    ok: true,
    r2Configured: target.r2Configured,
    storageConfigured: target.storageConfigured,
    storageProvider: target.storageProvider,
    r2Key: target.key,
    uploadUrl: target.uploadUrl,
    maxUploadBytes: target.maxUploadBytes,
    expiresInSeconds: 900,
  });
}
