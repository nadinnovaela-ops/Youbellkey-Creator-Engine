import type { ContentProjectRow, ResearchItemRow } from '@youbellkey/database';
import { UpdateProjectDocumentRequestSchema } from '@youbellkey/job-contracts';
import { evaluateOriginality } from '@youbellkey/originality-engine';
import { YBVideoDocumentSchema } from '@youbellkey/video-schema';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../../lib/http';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const { id } = await context.params;
  if (!id) return jsonError(400, 'MISSING_PROJECT_ID', 'Project ID required.');

  const parsed = await parseJsonBody(request, UpdateProjectDocumentRequestSchema);
  if (!parsed.ok) return parsed.response;

  const docParsed = YBVideoDocumentSchema.safeParse(parsed.data.ybVideoDoc);
  if (!docParsed.success) {
    const firstIssue = docParsed.error.issues[0];
    const issueDesc = firstIssue
      ? `${firstIssue.path.join('.') || 'document'}: ${firstIssue.message}`
      : 'Struktur YB Video Document v1.0 tidak valid.';
    return jsonError(400, 'INVALID_YB_VIDEO_DOCUMENT', issueDesc);
  }

  const { data: existingData, error: existingErr } = await ctx.supabase
    .from('content_projects')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (existingErr || !existingData) {
    return jsonError(404, 'PROJECT_NOT_FOUND', 'Content project tidak ditemukan.');
  }

  const existing = existingData as ContentProjectRow;
  const derivedScript =
    parsed.data.scriptText?.trim() || docParsed.data.scenes.map((s) => s.voiceover.text).join(' ');

  let originalityScore = existing.originality_score ?? 1;
  let nextStatus = existing.status;

  if (existing.source_item_id) {
    const { data: sourceItem } = await ctx.supabase
      .from('research_items')
      .select('title, transcript_text, metadata')
      .eq('id', existing.source_item_id)
      .eq('workspace_id', ctx.workspace.id)
      .maybeSingle();

    if (sourceItem) {
      const refRow = sourceItem as Pick<ResearchItemRow, 'title' | 'transcript_text' | 'metadata'>;
      const refText = [refRow.title, refRow.transcript_text, String(refRow.metadata?.description ?? '')]
        .filter(Boolean)
        .join('\n');
      const report = evaluateOriginality(refText, derivedScript);
      originalityScore = Number(Math.max(0, 1 - report.trigramOverlap).toFixed(4));
      nextStatus = report.verdict === 'PASS' ? 'READY_FOR_RENDER' : 'REVIEW_REQUIRED';
    }
  }

  const { data: updated, error: updateErr } = await ctx.supabase
    .from('content_projects')
    .update({
      title: (parsed.data.title?.trim() || docParsed.data.project.title).slice(0, 120),
      script_text: derivedScript,
      yb_video_doc: docParsed.data as unknown as Record<string, unknown>,
      originality_score: originalityScore,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .select('*')
    .single();

  if (updateErr || !updated) {
    return jsonError(500, 'PROJECT_UPDATE_FAILED', updateErr?.message ?? 'Gagal menyimpan YB Video Document.');
  }

  return NextResponse.json({ ok: true, project: updated });
}
