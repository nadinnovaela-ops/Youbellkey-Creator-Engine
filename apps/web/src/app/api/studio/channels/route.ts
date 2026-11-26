import { CreateChannelRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../lib/http';

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, CreateChannelRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await ctx.supabase
    .from('channels')
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        platform: parsed.data.platform,
        external_channel_id: parsed.data.externalChannelId.trim(),
        title: parsed.data.title.trim(),
        locale: parsed.data.locale,
        timezone: parsed.data.timezone.trim(),
        workflow_mode: parsed.data.workflowMode,
        daily_publish_cap: parsed.data.dailyPublishCap,
        autopilot_enabled: parsed.data.autopilotEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,platform,external_channel_id' },
    )
    .select('id, platform, external_channel_id, title, locale, timezone, workflow_mode, daily_publish_cap, autopilot_enabled')
    .single();

  if (error) {
    return jsonError(500, 'CHANNEL_UPSERT_FAILED', error.message);
  }

  return NextResponse.json({ ok: true, channel: data });
}
