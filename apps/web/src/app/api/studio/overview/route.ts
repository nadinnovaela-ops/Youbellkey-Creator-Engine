import { createSupabaseAdminClient } from '@youbellkey/database';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { jsonError } from '../../../../lib/http';
import { loadStudioOverview } from '../../../../lib/studio-overview';

export async function GET() {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  // Auto-reclaim expired job leases setiap kali overview dimuat
  // Ini memastikan UI selalu menampilkan status job yang akurat
  // tanpa memerlukan cron yang terpisah sebagai single point of truth
  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc('reclaim_expired_leases');
  } catch {
    // Non-fatal: jika reclaim gagal, overview tetap dimuat
  }

  const overview = await loadStudioOverview(ctx);
  return NextResponse.json({ ok: true, data: overview });
}
