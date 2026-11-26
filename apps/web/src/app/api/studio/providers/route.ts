import { UpsertProviderCredentialRequestSchema } from '@youbellkey/job-contracts';
import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspace } from '../../../../lib/auth';
import { encryptSecret, maskSecretPreview } from '../../../../lib/crypto';
import { jsonError, parseJsonBody } from '../../../../lib/http';

export async function POST(request: Request) {
  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.');

  const parsed = await parseJsonBody(request, UpsertProviderCredentialRequestSchema);
  if (!parsed.ok) return parsed.response;

  const masterKeyHex = process.env.YB_SECRETS_MASTER_KEY?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    return jsonError(500, 'MISSING_MASTER_KEY', 'YB_SECRETS_MASTER_KEY is not configured on the server.');
  }

  const encryptedPayload = encryptSecret(parsed.data.apiKey.trim(), masterKeyHex);
  const maskedHint = maskSecretPreview(parsed.data.apiKey);

  const { data, error } = await ctx.supabase
    .from('provider_credentials')
    .insert({
      workspace_id: ctx.workspace.id,
      provider: parsed.data.provider.trim(),
      label: `${parsed.data.label.trim()} (${maskedHint})`,
      encrypted_payload: encryptedPayload,
      is_active: true,
    })
    .select('id, provider, label, is_active, updated_at')
    .single();

  if (error) {
    return jsonError(500, 'PROVIDER_SAVE_FAILED', error.message);
  }

  return NextResponse.json({ ok: true, credential: data });
}
