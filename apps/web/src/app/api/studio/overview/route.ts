import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError } from '../../../../lib/http';
import { loadStudioOverview } from '../../../../lib/studio-overview';

export async function GET() {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const overview = await loadStudioOverview(ctx);
  return NextResponse.json({ ok: true, data: overview });
}
