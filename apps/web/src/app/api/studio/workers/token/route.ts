import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedWorkspace } from '../../../../../lib/auth';
import { hashWorkerToken } from '../../../../../lib/crypto';
import { jsonError, parseJsonBody } from '../../../../../lib/http';

const CreateWorkerTokenSchema = z.object({
  workerName: z.string().min(2).max(80).default('local-pc-01'),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, CreateWorkerTokenSchema);
  if (!parsed.ok) return parsed.response;

  const rawToken = `ybw_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = hashWorkerToken(rawToken);

  const { data, error } = await ctx.supabase
    .from('workers')
    .insert({
      workspace_id: ctx.workspace.id,
      worker_name: parsed.data.workerName.trim(),
      token_hash: tokenHash,
      platform_arch: 'pending-register',
      capabilities: ['render', 'research', 'publish'],
      status: 'OFFLINE',
    })
    .select('id, worker_name, status')
    .single();

  if (error) {
    return jsonError(500, 'WORKER_TOKEN_CREATE_FAILED', error.message);
  }

  // Raw token is returned once and never stored unhashed.
  return NextResponse.json({
    ok: true,
    worker: data,
    rawToken,
  });
}
