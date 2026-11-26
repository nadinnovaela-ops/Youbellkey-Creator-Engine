import { createSupabaseAdminClient, type WorkerRow } from '@youbellkey/database';
import { hashWorkerToken, timingSafeEqualHex } from './crypto';
import { extractBearerToken } from './http';

export async function authenticateWorker(request: Request): Promise<WorkerRow | null> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) return null;

  const tokenHash = hashWorkerToken(rawToken);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('workers')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as WorkerRow;
}

/**
 * Allows personal V1 bootstrap registration when YB_WORKER_TOKEN matches env
 * and exactly one workspace exists in the database.
 */
export async function bootstrapPersonalWorkerIfAllowed(
  request: Request,
  workerName: string,
  platformArch: string,
  capabilities: string[],
): Promise<WorkerRow | null> {
  const rawToken = extractBearerToken(request);
  const envBootstrapToken = process.env.YB_WORKER_TOKEN?.trim();
  if (!rawToken || !envBootstrapToken) return null;

  const incomingHash = hashWorkerToken(rawToken);
  const envHash = hashWorkerToken(envBootstrapToken);
  if (!timingSafeEqualHex(incomingHash, envHash)) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: workspaces, error: wsError } = await admin
    .from('workspaces')
    .select('id')
    .limit(2);

  if (wsError || !workspaces || workspaces.length !== 1) {
    return null;
  }

  const workspaceId = (workspaces[0] as { id: string }).id;
  const { data: upserted, error: upsertError } = await admin
    .from('workers')
    .upsert(
      {
        workspace_id: workspaceId,
        worker_name: workerName,
        token_hash: incomingHash,
        platform_arch: platformArch,
        capabilities,
        status: 'ONLINE',
        last_heartbeat_at: new Date().toISOString(),
      },
      { onConflict: 'token_hash' },
    )
    .select('*')
    .single();

  if (upsertError || !upserted) {
    return null;
  }

  return upserted as WorkerRow;
}
