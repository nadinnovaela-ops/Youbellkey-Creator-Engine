import { ToggleKillSwitchRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../lib/http';

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, ToggleKillSwitchRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { error } = await ctx.supabase
    .from('workspaces')
    .update({
      kill_switch_active: parsed.data.killSwitchActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.workspace.id);

  if (error) {
    return jsonError(500, 'KILL_SWITCH_UPDATE_FAILED', error.message);
  }

  return NextResponse.json({ ok: true, killSwitchActive: parsed.data.killSwitchActive });
}
