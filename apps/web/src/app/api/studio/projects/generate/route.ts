import { generateContentVariations } from '@youbellkey/ai-gateway';
import type { ContentProjectRow, ResearchItemRow } from '@youbellkey/database';
import { GenerateContentLabRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';
import { resolveWorkspaceAiKeys } from '../../../../../lib/vault';

export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, GenerateContentLabRequestSchema);
  if (!parsed.ok) return parsed.response;

  let referenceItem: ResearchItemRow | null = null;
  if (parsed.data.researchItemId) {
    const { data: item, error: itemErr } = await ctx.supabase
      .from('research_items')
      .select('*')
      .eq('id', parsed.data.researchItemId)
      .eq('workspace_id', ctx.workspace.id)
      .maybeSingle();
    if (itemErr || !item) {
      return jsonError(404, 'RESEARCH_ITEM_NOT_FOUND', 'Referensi riset tidak ditemukan.');
    }
    referenceItem = item as ResearchItemRow;
  }

  const topicOrTitle = parsed.data.topic?.trim() || referenceItem?.title || 'Topik Shorts Baru';
  const referenceSummary = referenceItem
    ? `${referenceItem.title}\n${String(referenceItem.metadata?.description ?? '')}`.trim()
    : undefined;
  const referenceTranscript = referenceItem?.transcript_text ?? undefined;

  const providerKeys = await resolveWorkspaceAiKeys(ctx.workspace.id);
  const generated = await generateContentVariations(
    {
      topicOrTitle,
      referenceSummary,
      referenceTranscript,
      locale: parsed.data.locale,
      videoTrack: parsed.data.videoTrack,
      variationCount: parsed.data.variationCount,
    },
    providerKeys,
  );

  const projectRows = generated.variations.map((v) => ({
    workspace_id: ctx.workspace.id,
    channel_id: parsed.data.channelId ?? null,
    source_item_id: referenceItem?.id ?? null,
    title: v.title.slice(0, 120),
    locale: parsed.data.locale,
    video_track: parsed.data.videoTrack,
    script_text: v.scriptText,
    yb_video_doc: v.ybVideoDoc as unknown as Record<string, unknown>,
    originality_score: v.originality.originalityScore,
    status: v.originality.verdict === 'PASS' ? 'READY_FOR_RENDER' : 'REVIEW_REQUIRED',
  }));

  const { data: createdProjects, error: insertErr } = await ctx.supabase
    .from('content_projects')
    .insert(projectRows)
    .select('*');

  if (insertErr || !createdProjects) {
    return jsonError(500, 'CONTENT_PROJECTS_SAVE_FAILED', insertErr?.message ?? 'Gagal menyimpan proyek.');
  }

  if (generated.usage) {
    await ctx.supabase.from('cost_ledger').insert({
      workspace_id: ctx.workspace.id,
      provider: generated.usage.provider,
      model: generated.usage.model,
      input_units: generated.usage.inputUnits,
      output_units: generated.usage.outputUnits,
      estimated_cost_usd: generated.usage.estimatedCostUsd,
    });
  }

  return NextResponse.json({
    ok: true,
    projects: createdProjects as ContentProjectRow[],
    usedFallbackTemplate: generated.usedFallbackTemplate,
    warnings: generated.warnings,
    usage: generated.usage,
  });
}
