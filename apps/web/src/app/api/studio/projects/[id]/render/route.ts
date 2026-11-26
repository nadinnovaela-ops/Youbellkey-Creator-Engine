import crypto from 'node:crypto';
import type { ContentProjectRow } from '@youbellkey/database';
import { TriggerProjectRenderRequestSchema } from '@youbellkey/job-contracts';
import { YBVideoDocumentSchema } from '@youbellkey/video-schema';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../../lib/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const { id } = await context.params;
  if (!id) return jsonError(400, 'MISSING_PROJECT_ID', 'Project ID required.');

  const parsed = await parseJsonBody(request, TriggerProjectRenderRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { data: projData, error: loadErr } = await ctx.supabase
    .from('content_projects')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (loadErr || !projData) {
    return jsonError(404, 'PROJECT_NOT_FOUND', 'Content project tidak ditemukan.');
  }

  const project = projData as ContentProjectRow;
  const docParsed = YBVideoDocumentSchema.safeParse(project.yb_video_doc);
  if (!docParsed.success) {
    return jsonError(400, 'INVALID_YB_VIDEO_DOCUMENT', 'Proyek belum memiliki YB Video Document v1.0 yang valid.');
  }

  const idempotencyKey = `render-${project.id}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: job, error: jobErr } = await ctx.supabase
    .from('jobs')
    .insert({
      workspace_id: ctx.workspace.id,
      project_id: project.id,
      job_type: 'RENDER_HYPERFRAMES',
      required_capability: 'render',
      status: 'QUEUED',
      priority: 25,
      payload: {
        projectId: project.id,
        quality: parsed.data.quality,
        document: docParsed.data,
      },
      idempotency_key: idempotencyKey,
    })
    .select('id, job_type, status, created_at')
    .single();

  if (jobErr || !job) {
    return jsonError(500, 'RENDER_JOB_CREATE_FAILED', jobErr?.message ?? 'Gagal mengantrekan render.');
  }

  await ctx.supabase
    .from('content_projects')
    .update({ status: 'RENDER_QUEUED', updated_at: new Date().toISOString() })
    .eq('id', project.id)
    .eq('workspace_id', ctx.workspace.id);

  return NextResponse.json({ ok: true, job });
}
