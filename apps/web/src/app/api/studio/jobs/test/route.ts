import crypto from 'node:crypto';
import { EnqueueSmokeJobRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../../lib/http';

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, EnqueueSmokeJobRequestSchema);
  if (!parsed.ok) return parsed.response;

  const idempotencyKey = `smoke-${crypto.randomUUID()}`;
  const { data, error } = await ctx.supabase
    .from('jobs')
    .insert({
      workspace_id: ctx.workspace.id,
      job_type: 'PHASE1_SMOKE',
      required_capability: 'render',
      status: 'QUEUED',
      priority: 50,
      payload: {
        note: parsed.data.note ?? 'Phase 1 PWA -> Supabase -> Universal Worker round-trip check',
        requestedAt: new Date().toISOString(),
      },
      idempotency_key: idempotencyKey,
    })
    .select('id, job_type, status, progress, created_at')
    .single();

  if (error) {
    return jsonError(500, 'SMOKE_JOB_ENQUEUE_FAILED', error.message);
  }

  return NextResponse.json({ ok: true, job: data });
}
