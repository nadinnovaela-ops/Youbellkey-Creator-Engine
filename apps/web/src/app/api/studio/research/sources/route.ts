import type { ResearchSourceRow } from '@youbellkey/database';
import {
  CreateResearchSourceRequestSchema,
  ToggleResearchSourceRequestSchema,
} from '@youbellkey/job-contracts';
import { buildYoutubeChannelRssUrl, resolveYoutubeChannelId } from '@youbellkey/research-worker/core';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';
import { runQuickResearchSync } from '../../../../../lib/research-sync';

export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, CreateResearchSourceRequestSchema);
  if (!parsed.ok) return parsed.response;

  let externalChannelId: string;
  try {
    const resolved = await resolveYoutubeChannelId(parsed.data.channelInput);
    externalChannelId = resolved.channelId;
  } catch (err) {
    return jsonError(400, 'CHANNEL_RESOLVE_FAILED', err instanceof Error ? err.message : 'Channel tidak valid.');
  }

  const rssUrl = buildYoutubeChannelRssUrl(externalChannelId);
  const { data: existing } = await ctx.supabase
    .from('research_sources')
    .select('*')
    .eq('workspace_id', ctx.workspace.id)
    .eq('external_channel_id', externalChannelId)
    .maybeSingle();

  let source: ResearchSourceRow;
  if (existing) {
    const { data: updated, error: updateErr } = await ctx.supabase
      .from('research_sources')
      .update({
        niche: parsed.data.niche.trim(),
        locale: parsed.data.locale,
        rss_url: rssUrl,
        is_active: true,
      })
      .eq('id', (existing as ResearchSourceRow).id)
      .eq('workspace_id', ctx.workspace.id)
      .select('*')
      .single();
    if (updateErr || !updated) {
      return jsonError(500, 'RESEARCH_SOURCE_UPDATE_FAILED', updateErr?.message ?? 'Update failed.');
    }
    source = updated as ResearchSourceRow;
  } else {
    const { data: created, error: insertErr } = await ctx.supabase
      .from('research_sources')
      .insert({
        workspace_id: ctx.workspace.id,
        platform: 'youtube',
        external_channel_id: externalChannelId,
        niche: parsed.data.niche.trim(),
        locale: parsed.data.locale,
        rss_url: rssUrl,
        is_active: true,
      })
      .select('*')
      .single();
    if (insertErr || !created) {
      return jsonError(500, 'RESEARCH_SOURCE_CREATE_FAILED', insertErr?.message ?? 'Create failed.');
    }
    source = created as ResearchSourceRow;
  }

  let syncResult: { syncedCount: number; savedItemsCount: number; warnings: string[] } | null = null;
  if (parsed.data.syncNow) {
    syncResult = await runQuickResearchSync(ctx, [source]);
  }

  return NextResponse.json({ ok: true, source, syncResult });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, ToggleResearchSourceRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await ctx.supabase
    .from('research_sources')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.sourceId)
    .eq('workspace_id', ctx.workspace.id)
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(500, 'RESEARCH_SOURCE_TOGGLE_FAILED', error?.message ?? 'Failed to update source.');
  }

  return NextResponse.json({ ok: true, source: data });
}
