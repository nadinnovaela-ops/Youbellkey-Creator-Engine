import {
  buildWorkspaceR2Key,
  createPresignedUploadUrl,
  readR2ConfigFromEnv,
} from '@youbellkey/storage';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError, parseJsonBody } from '../../../../lib/http';

const PresignUploadSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(['voiceover', 'image', 'clip', 'render-mp4', 'thumbnail']),
  filename: z.string().min(1).max(160),
  contentType: z.string().min(3).max(120),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const r2Config = readR2ConfigFromEnv();
  if (!r2Config) {
    return jsonError(503, 'R2_NOT_CONFIGURED', 'Cloudflare R2 credentials have not been configured yet.');
  }

  const parsed = await parseJsonBody(request, PresignUploadSchema);
  if (!parsed.ok) return parsed.response;

  const r2Key = buildWorkspaceR2Key(
    ctx.workspace.id,
    parsed.data.projectId,
    parsed.data.kind,
    parsed.data.filename,
  );
  const uploadUrl = await createPresignedUploadUrl(r2Config, r2Key, parsed.data.contentType);

  return NextResponse.json({ ok: true, r2Key, uploadUrl, expiresInSeconds: 900 });
}
