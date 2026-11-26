import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hashWorkerToken } from '../../apps/web/src/lib/crypto.js';

describe('Phase 0 Security & RLS Baseline', () => {
  const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts BYOK API keys using AES-256-GCM and rejects tampered payloads', () => {
    const secret = 'AIzaSyFakeSecretKey12345';
    const encrypted = encryptSecret(secret, masterKey);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, masterKey)).toBe(secret);

    const parts = encrypted.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]?.slice(0, -2)}00`;
    expect(() => decryptSecret(tampered, masterKey)).toThrow();
  });

  it('hashes worker tokens deterministically with SHA-256', () => {
    const hashA = hashWorkerToken('yb_worker_live_token');
    const hashB = hashWorkerToken('yb_worker_live_token');
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
    expect(hashA).not.toContain('yb_worker_live_token');
  });

  it('enforces workspace_id isolation, RLS, and atomic lease RPCs in Supabase migration', () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'packages/database/supabase/migrations/0001_initial_schema.sql',
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const tenantTables = [
      'channels',
      'provider_credentials',
      'workers',
      'research_sources',
      'research_items',
      'content_projects',
      'media_assets',
      'jobs',
      'publications',
      'cost_ledger',
    ];

    for (const table of tenantTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`public.is_workspace_member(workspace_id)`);
    }

    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('reclaim_expired_leases');
  });
});
