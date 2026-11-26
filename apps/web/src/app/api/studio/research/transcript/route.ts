import crypto from 'node:crypto';
import type { ResearchItemRow } from '@youbellkey/database';
import { RequestTranscriptJobSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, RequestTranscriptJobSchema);
  if (!parsed.ok) return parsed.response;

  const { data: item, error: loadErr } = await ctx.supabase
    .from('research_items')
    .select('*')
    .eq('id', parsed.data.researchItemId)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (loadErr || !item) {
    return jsonError(404, 'RESEARCH_ITEM_NOT_FOUND', 'Item riset tidak ditemukan di workspace ini.');
  }

  const row = item as ResearchItemRow;
  const preferredLocale =
    parsed.data.preferredLocale ??
    (row.metadata?.locale === 'en-US' || row.metadata?.locale === 'id-ID'
      ? row.metadata.locale
      : ctx.workspace.default_locale);

  const { data: job, error: jobErr } = await ctx.supabase
    .from('jobs')
    .insert({
      workspace_id: ctx.workspace.id,
      job_type: 'REFERENCE_TRANSCRIPT',
      required_capability: 'research',
      status: 'QUEUED',
      priority: 30,
      payload: {
        researchItemId: row.id,
        videoUrl: row.video_url,
        preferredLocale,
      },
      idempotency_key: `transcript-${row.id}-${crypto.randomUUID().slice(0, 8)}`,
    })
    .select('id, status')
    .single();

  if (jobErr || !job) {
    return jsonError(500, 'TRANSCRIPT_JOB_CREATE_FAILED', jobErr?.message ?? 'Gagal mengantrekan transkrip.');
  }

  return NextResponse.json({ ok: true, job });
}
