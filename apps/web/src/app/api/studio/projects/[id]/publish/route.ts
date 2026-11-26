import crypto from 'node:crypto';
import type { ContentProjectRow } from '@youbellkey/database';
import { TriggerProjectPublishRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../../lib/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  if (ctx.workspace.kill_switch_active) {
    return jsonError(403, 'KILL_SWITCH_ACTIVE', 'Matikan Kill Switch terlebih dahulu sebelum mempublikasikan video.');
  }

  const { id } = await context.params;
  if (!id) return jsonError(400, 'MISSING_PROJECT_ID', 'Project ID required.');

  const parsed = await parseJsonBody(request, TriggerProjectPublishRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { data: projData, error: projErr } = await ctx.supabase
    .from('content_projects')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (projErr || !projData) {
    return jsonError(404, 'PROJECT_NOT_FOUND', 'Content project tidak ditemukan.');
  }
  const project = projData as ContentProjectRow;

  const targetChannelId = parsed.data.channelId ?? project.channel_id;
  if (!targetChannelId) {
    return jsonError(400, 'MISSING_CHANNEL_ID', 'Pilih channel YouTube terlebih dahulu untuk publikasi.');
  }

  const { data: channel } = await ctx.supabase
    .from('channels')
    .select('id, platform, title, workflow_mode, autopilot_enabled')
    .eq('id', targetChannelId)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (!channel) {
    return jsonError(404, 'CHANNEL_NOT_FOUND', 'Channel tidak ditemukan di workspace ini.');
  }

  const idempotencyKey = `pub-yt-${project.id}-${targetChannelId}`;
  const { data: existingPub } = await ctx.supabase
    .from('publications')
    .select('id, status, external_video_id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingPub && (existingPub as { status?: string }).status === 'PUBLISHED') {
    return jsonError(
      409,
      'ALREADY_PUBLISHED',
      `Proyek ini sudah terpublikasi ke YouTube (${(existingPub as { external_video_id?: string }).external_video_id ?? 'OK'}).`,
    );
  }

  let publicationId = (existingPub as { id?: string } | null)?.id;
  if (!publicationId) {
    const { data: newPub, error: pubErr } = await ctx.supabase
      .from('publications')
      .insert({
        workspace_id: ctx.workspace.id,
        channel_id: targetChannelId,
        project_id: project.id,
        platform: 'youtube_shorts',
        idempotency_key: idempotencyKey,
        publish_at: parsed.data.publishAt ?? null,
        status: parsed.data.publishAt ? 'SCHEDULED' : 'QUEUED',
      })
      .select('id')
      .single();

    if (pubErr || !newPub) {
      return jsonError(500, 'PUBLICATION_CREATE_FAILED', pubErr?.message ?? 'Gagal mencatat antrean publikasi.');
    }
    publicationId = (newPub as { id: string }).id;
  }

  const { data: job, error: jobErr } = await ctx.supabase
    .from('jobs')
    .insert({
      workspace_id: ctx.workspace.id,
      project_id: project.id,
      job_type: 'PUBLISH_YOUTUBE_SHORTS',
      required_capability: 'publish',
      status: 'QUEUED',
      priority: 20,
      payload: {
        projectId: project.id,
        channelId: targetChannelId,
        publicationId,
        title: project.title,
        description: project.script_text ?? project.title,
        locale: project.locale,
        privacyStatus: parsed.data.privacyStatus,
        publishAt: parsed.data.publishAt ?? null,
        tags: parsed.data.tags ?? [],
      },
      idempotency_key: `job-${idempotencyKey}-${crypto.randomUUID().slice(0, 8)}`,
    })
    .select('id, job_type, status')
    .single();

  if (jobErr || !job) {
    return jsonError(500, 'PUBLISH_JOB_CREATE_FAILED', jobErr?.message ?? 'Gagal mengantrekan upload.');
  }

  return NextResponse.json({ ok: true, publicationId, job });
}
