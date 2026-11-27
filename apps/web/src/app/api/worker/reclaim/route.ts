import { createSupabaseAdminClient } from '@youbellkey/database';
import { NextResponse } from 'next/server';
import { jsonError } from '../../../../lib/http';

/**
 * POST /api/worker/reclaim
 *
 * Trigger reclaim_expired_leases() secara eksplisit — dipanggil oleh:
 * 1. Vercel Cron (tiap 2 menit) via vercel.json
 * 2. Studio overview GET sebelum memuat job list
 * 3. Worker saat startup
 *
 * Hanya bisa dipanggil dengan CRON_SECRET dari Vercel Cron,
 * atau sebagai internal server call tanpa auth (dari overview route).
 */
export async function POST(request: Request) {
  // Vercel Cron kirim Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Jika CRON_SECRET dikonfigurasi, wajib cocok
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid cron secret.');
  }

  const admin = createSupabaseAdminClient();
  const { data: reclaimedCount, error } = await admin.rpc('reclaim_expired_leases');

  if (error) {
    return jsonError(500, 'RECLAIM_FAILED', error.message);
  }

  const count = typeof reclaimedCount === 'number' ? reclaimedCount : 0;

  if (count > 0) {
    console.log(`[reclaim] Reclaimed ${count} expired job lease(s) at ${new Date().toISOString()}`);
  }

  return NextResponse.json({ ok: true, reclaimedCount: count });
}

/**
 * GET /api/worker/reclaim — Vercel Cron endpoint (GET-based cron)
 *
 * Vercel Cron bisa pakai GET; kita expose keduanya agar fleksibel.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid cron secret.');
  }

  const admin = createSupabaseAdminClient();
  const { data: reclaimedCount, error } = await admin.rpc('reclaim_expired_leases');

  if (error) {
    return jsonError(500, 'RECLAIM_FAILED', error.message);
  }

  const count = typeof reclaimedCount === 'number' ? reclaimedCount : 0;

  if (count > 0) {
    console.log(`[reclaim-cron] Reclaimed ${count} expired job lease(s) at ${new Date().toISOString()}`);
  }

  return NextResponse.json({ ok: true, reclaimedCount: count });
}
