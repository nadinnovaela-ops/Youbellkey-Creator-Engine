import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function decodeMasterKey(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('YB_SECRETS_MASTER_KEY must be exactly 64 hex characters (32 bytes).');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypts sensitive BYOK API keys and OAuth refresh tokens with AES-256-GCM
 * before persistence in Supabase.
 */
export function encryptSecret(plaintext: string, masterKeyHex: string): string {
  const key = decodeMasterKey(masterKeyHex);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string, masterKeyHex: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret payload format.');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const key = decodeMasterKey(masterKeyHex);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashWorkerToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function timingSafeEqualHex(hexA: string, hexB: string): boolean {
  if (hexA.length !== hexB.length || hexA.length === 0) return false;
  return crypto.timingSafeEqual(Buffer.from(hexA, 'utf8'), Buffer.from(hexB, 'utf8'));
}

export function maskSecretPreview(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
