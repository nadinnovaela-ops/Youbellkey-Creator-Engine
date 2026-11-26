import { isR2Configured } from '@youbellkey/storage';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '../../../lib/supabase-server';

export async function GET() {
  const masterKeyHex = process.env.YB_SECRETS_MASTER_KEY ?? '';
  return NextResponse.json({
    ok: true,
    service: 'youbellkey-control-plane',
    phase: 1,
    readiness: {
      supabaseConfigured: isSupabaseConfigured(),
      r2Configured: isR2Configured(),
      secretsMasterKeyConfigured: /^[0-9a-fA-F]{64}$/.test(masterKeyHex),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
    },
    timestamp: new Date().toISOString(),
  });
}
