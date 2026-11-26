import type { ZodType } from 'zod';

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const raw: unknown = await request.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        response: jsonError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid payload'),
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      response: jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON'),
    };
  }
}

export function isWorkerRecentlyActive(lastHeartbeatAt: string | null, maxAgeSeconds = 90): boolean {
  if (!lastHeartbeatAt) return false;
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  return Number.isFinite(ageMs) && ageMs <= maxAgeSeconds * 1000;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
