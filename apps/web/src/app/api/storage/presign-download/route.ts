import { createPresignedDownloadUrl, readR2ConfigFromEnv } from '@youbellkey/storage';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../lib/http';

const PresignDownloadSchema = z.object({
  r2Key: z.string().min(10).max(400),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const r2Config = readR2ConfigFromEnv();
  if (!r2Config) {
    return jsonError(503, 'R2_NOT_CONFIGURED', 'Cloudflare R2 credentials have not been configured yet.');
  }

  const parsed = await parseJsonBody(request, PresignDownloadSchema);
  if (!parsed.ok) return parsed.response;

  const expectedPrefix = `workspaces/${ctx.workspace.id}/`;
  if (!parsed.data.r2Key.startsWith(expectedPrefix) || parsed.data.r2Key.includes('..')) {
    return jsonError(403, 'FORBIDDEN_R2_SCOPE', 'Cannot access R2 object outside your workspace.');
  }

  const downloadUrl = await createPresignedDownloadUrl(r2Config, parsed.data.r2Key);
  return NextResponse.json({ ok: true, downloadUrl, expiresInSeconds: 3600 });
}
