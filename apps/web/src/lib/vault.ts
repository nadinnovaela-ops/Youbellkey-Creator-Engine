import { createSupabaseAdminClient } from '@youbellkey/database';
import { decryptSecret } from './crypto';

/**
 * Resolves workspace AI provider keys by decrypting BYOK vault entries first
 * and falling back to server environment variables when available.
 * Server-only: must never expose raw keys to browsers or worker job payloads.
 */
export async function resolveWorkspaceAiKeys(workspaceId: string): Promise<Record<string, string | undefined>> {
  const keys: Record<string, string | undefined> = {
    'gemini-free': process.env.GEMINI_API_KEY?.trim(),
    'groq-free': process.env.GROQ_API_KEY?.trim(),
    'groq-whisper-free': process.env.GROQ_API_KEY?.trim(),
    'openrouter-free': process.env.OPENROUTER_API_KEY?.trim(),
    'youtube-data-api': process.env.YOUTUBE_API_KEY?.trim(),
  };

  const masterKeyHex = process.env.YB_SECRETS_MASTER_KEY?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    return keys;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('provider_credentials')
    .select('provider, encrypted_payload')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  for (const row of data ?? []) {
    const record = row as { provider?: string; encrypted_payload?: string };
    if (!record.provider || !record.encrypted_payload) continue;

    try {
      const decrypted = decryptSecret(record.encrypted_payload, masterKeyHex).trim();
      if (!decrypted) continue;
      keys[record.provider] = decrypted;
      if (record.provider === 'groq-whisper-free' && !keys['groq-free']) {
        keys['groq-free'] = decrypted;
      }
    } catch {
      // Skip corrupted or master-key-mismatched vault rows cleanly.
    }
  }

  return keys;
}
