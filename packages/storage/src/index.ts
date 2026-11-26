import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type MediaAssetKind = 'voiceover' | 'image' | 'clip' | 'render-mp4' | 'thumbnail';

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function buildWorkspaceR2Key(
  workspaceId: string,
  projectId: string,
  kind: MediaAssetKind,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `workspaces/${workspaceId}/projects/${projectId}/${kind}/${safeName}`;
}

export function readR2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2StorageConfig | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = env.R2_BUCKET_NAME?.trim() || 'youbellkey-media';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isR2Configured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readR2ConfigFromEnv(env) !== null;
}

export function createR2S3Client(config: R2StorageConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function createPresignedUploadUrl(
  config: R2StorageConfig,
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const client = createR2S3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function createPresignedDownloadUrl(
  config: R2StorageConfig,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = createR2S3Client(config);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
