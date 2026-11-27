import { createSupabaseAdminClient } from '@youbellkey/database';
import {
  buildWorkspaceR2Key,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  isR2Configured,
  readR2ConfigFromEnv,
  type MediaAssetKind,
} from '@youbellkey/storage';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_FALLBACK_BUCKET = 'youbellkey-media';
export const SUPABASE_FREE_TIER_MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB standard free limit
const SUPABASE_KEY_PREFIX = 'supabase://';

export type StorageProviderKind = 'r2' | 'supabase' | 'none';

export type ParsedStoredMediaKey =
  | { provider: 'r2'; objectPath: string }
  | { provider: 'supabase'; bucket: string; objectPath: string };

export function isSupabaseStorageFallbackConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
      env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getActiveStorageProvider(env: NodeJS.ProcessEnv = process.env): StorageProviderKind {
  if (isR2Configured(env)) return 'r2';
  if (isSupabaseStorageFallbackConfigured(env)) return 'supabase';
  return 'none';
}

export function encodeSupabaseStorageKey(bucket: string, objectPath: string): string {
  const cleanObject = objectPath.replace(/^\/+/, '');
  return `${SUPABASE_KEY_PREFIX}${bucket}/${cleanObject}`;
}

export function parseStoredMediaKey(storedKey: string): ParsedStoredMediaKey {
  if (storedKey.startsWith(SUPABASE_KEY_PREFIX)) {
    const rest = storedKey.slice(SUPABASE_KEY_PREFIX.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx > 0) {
      return {
        provider: 'supabase',
        bucket: rest.slice(0, slashIdx),
        objectPath: rest.slice(slashIdx + 1),
      };
    }
  }
  return { provider: 'r2', objectPath: storedKey };
}

/**
 * Ensures the private fallback bucket exists on Supabase Storage before generating
 * signed upload URLs so fresh Supabase projects work without manual dashboard setup.
 */
export async function ensureSupabaseMediaBucket(
  admin: SupabaseClient = createSupabaseAdminClient(),
  bucketName = SUPABASE_FALLBACK_BUCKET,
): Promise<void> {
  const { data: existing } = await admin.storage.getBucket(bucketName);
  if (existing) return;

  const { error: createErr } = await admin.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: SUPABASE_FREE_TIER_MAX_UPLOAD_BYTES,
    allowedMimeTypes: ['video/mp4', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg'],
  });

  // Ignore race-condition errors when parallel workers initialize the bucket concurrently.
  if (createErr && !/already\s*exists|duplicate/i.test(createErr.message)) {
    throw new Error(`Supabase bucket init failed (${bucketName}): ${createErr.message}`);
  }
}

export interface MediaUploadTargetResult {
  storageProvider: StorageProviderKind;
  storageConfigured: boolean;
  r2Configured: boolean;
  key: string | null;
  uploadUrl: string | null;
  maxUploadBytes: number | null;
}

/**
 * Resolves a short-lived signed PUT URL using Cloudflare R2 first, falling back to
 * Supabase Storage private bucket when R2 credentials are absent (ADR-0005).
 */
export async function createMediaUploadTarget(options: {
  admin?: SupabaseClient;
  workspaceId: string;
  projectId: string;
  kind: MediaAssetKind;
  filename: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<MediaUploadTargetResult> {
  const expiresIn = options.expiresInSeconds ?? 900;
  const objectPath = buildWorkspaceR2Key(
    options.workspaceId,
    options.projectId,
    options.kind,
    options.filename,
  );

  const r2Config = readR2ConfigFromEnv();
  if (r2Config) {
    const uploadUrl = await createPresignedUploadUrl(
      r2Config,
      objectPath,
      options.contentType,
      expiresIn,
    );
    return {
      storageProvider: 'r2',
      storageConfigured: true,
      r2Configured: true,
      key: objectPath,
      uploadUrl,
      maxUploadBytes: null,
    };
  }

  if (isSupabaseStorageFallbackConfigured()) {
    const admin = options.admin ?? createSupabaseAdminClient();
    await ensureSupabaseMediaBucket(admin, SUPABASE_FALLBACK_BUCKET);
    const { data, error } = await admin.storage
      .from(SUPABASE_FALLBACK_BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: true });

    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed upload URL failed: ${error?.message ?? 'empty signedUrl'}`);
    }

    return {
      storageProvider: 'supabase',
      storageConfigured: true,
      r2Configured: false,
      key: encodeSupabaseStorageKey(SUPABASE_FALLBACK_BUCKET, objectPath),
      uploadUrl: data.signedUrl,
      maxUploadBytes: SUPABASE_FREE_TIER_MAX_UPLOAD_BYTES,
    };
  }

  return {
    storageProvider: 'none',
    storageConfigured: false,
    r2Configured: false,
    key: null,
    uploadUrl: null,
    maxUploadBytes: null,
  };
}

export interface MediaDownloadUrlResult {
  provider: 'r2' | 'supabase';
  configured: boolean;
  url: string | null;
}

/**
 * Issues a short-lived download/preview URL matching the backend encoded in `storedKey`.
 */
export async function createMediaDownloadUrl(options: {
  admin?: SupabaseClient;
  storedKey: string;
  expiresInSeconds?: number;
}): Promise<MediaDownloadUrlResult> {
  const expiresIn = options.expiresInSeconds ?? 3600;
  const parsed = parseStoredMediaKey(options.storedKey);

  if (parsed.provider === 'supabase') {
    if (!isSupabaseStorageFallbackConfigured()) {
      return { provider: 'supabase', configured: false, url: null };
    }
    const admin = options.admin ?? createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.objectPath, expiresIn);

    if (error || !data?.signedUrl) {
      return { provider: 'supabase', configured: true, url: null };
    }
    return { provider: 'supabase', configured: true, url: data.signedUrl };
  }

  const r2Config = readR2ConfigFromEnv();
  if (!r2Config) {
    return { provider: 'r2', configured: false, url: null };
  }

  const url = await createPresignedDownloadUrl(r2Config, parsed.objectPath, expiresIn);
  return { provider: 'r2', configured: true, url };
}
