import { createSupabaseAdminClient, type JobRow } from '@youbellkey/database';
import { WorkerPresignRenderUploadSchema } from '@youbellkey/job-contracts';
import {
  buildWorkspaceR2Key,
  createPresignedUploadUrl,
  readR2ConfigFromEnv,
} from '@youbellkey/storage';
import { NextResponse } from 'next/server';
import { jsonError, parseJsonBody } from '../../../../lib/http';
import { authenticateWorker } from '../../../../lib/worker-auth';

/**
 * Issues a short-lived Cloudflare R2 presigned PUT URL strictly scoped to the worker's
 * workspace & active RUNNING render job, keeping R2 secrets on the Control Plane only.
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

  const r2Config = readR2ConfigFromEnv();
  if (!r2Config) {
    return NextResponse.json({
      ok: true,
      r2Configured: false,
      r2Key: null,
      uploadUrl: null,
    });
  }

  const r2Key = buildWorkspaceR2Key(
    worker.workspace_id,
    parsed.data.projectId,
    'render-mp4',
    parsed.data.filename,
  );
  const uploadUrl = await createPresignedUploadUrl(r2Config, r2Key, parsed.data.contentType, 900);

  return NextResponse.json({
    ok: true,
    r2Configured: true,
    r2Key,
    uploadUrl,
    expiresInSeconds: 900,
  });
}
