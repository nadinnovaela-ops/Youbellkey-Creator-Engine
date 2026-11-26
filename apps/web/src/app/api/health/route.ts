import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'youbellkey-control-plane',
    phase: 0,
    timestamp: new Date().toISOString(),
  });
}
