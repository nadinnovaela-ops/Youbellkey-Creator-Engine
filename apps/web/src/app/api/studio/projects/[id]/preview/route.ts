import { createPresignedDownloadUrl, readR2ConfigFromEnv } from '@youbellkey/storage';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../../../lib/auth';
import { jsonError } from '../../../../../../lib/http';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const { id } = await context.params;
  if (!id) return jsonError(400, 'MISSING_PROJECT_ID', 'Project ID required.');

  const { data: asset } = await ctx.supabase
    .from('media_assets')
    .select('id, r2_key, mime_type, size_bytes, created_at')
    .eq('workspace_id', ctx.workspace.id)
    .eq('project_id', id)
    .eq('asset_type', 'render-mp4')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({
      ok: true,
      hasCloudPreview: false,
      downloadUrl: null,
      message: 'Belum ada hasil render tersimpan di Cloudflare R2.',
    });
  }

  const row = asset as { id: string; r2_key: string; mime_type: string; size_bytes: number };
  const r2Config = readR2ConfigFromEnv();
  if (!r2Config) {
    return NextResponse.json({
      ok: true,
      hasCloudPreview: false,
      r2Key: row.r2_key,
      downloadUrl: null,
      message: 'Cloudflare R2 belum dikonfigurasi di Vercel env.',
    });
  }

  const downloadUrl = await createPresignedDownloadUrl(r2Config, row.r2_key, 3600);
  return NextResponse.json({
    ok: true,
    hasCloudPreview: true,
    r2Key: row.r2_key,
    sizeBytes: row.size_bytes,
    downloadUrl,
  });
}
