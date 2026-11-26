import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { JobDispatch, WorkerCapability } from '@youbellkey/job-contracts';

export interface WorkerRuntimeConfig {
  controlPlaneUrl: string;
  workerName: string;
  workerToken: string;
  capabilities: WorkerCapability[];
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
}

export function loadLocalEnvFile(cwd = process.cwd()): void {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
}

export function createDefaultWorkerConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  return {
    controlPlaneUrl: (env.YB_CONTROL_PLANE_URL ?? env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    workerName: env.YB_WORKER_ID ?? 'local-pc-01',
    workerToken: env.YB_WORKER_TOKEN ?? '',
    capabilities: ['render', 'research', 'publish'],
    pollIntervalMs: 5000,
    heartbeatIntervalMs: 30000,
  };
}

async function postWorkerJson<T>(
  config: WorkerRuntimeConfig,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${config.controlPlaneUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.workerToken}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`${endpoint} failed (${res.status}): ${json?.error?.message ?? res.statusText}`);
  }
  return json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeClaimedJob(
  config: WorkerRuntimeConfig,
  workerId: string,
  job: JobDispatch,
): Promise<Record<string, unknown>> {
  const sendProgress = async (progress: number, message: string) => {
    const hb = await postWorkerJson<{ ok: boolean; killSwitchActive: boolean }>(
      config,
      '/api/worker/heartbeat',
      { workerId, jobId: job.jobId, progress, message },
    );
    if (hb.killSwitchActive && job.jobType === 'PUBLISH_YOUTUBE_SHORTS') {
      throw new Error('Aborted due to workspace kill switch.');
    }
  };

  if (job.jobType === 'PHASE1_SMOKE') {
    await sendProgress(25, 'Worker claimed smoke job');
    await sleep(600);
    await sendProgress(65, 'Checking local worker environment');
    await sleep(600);
    await sendProgress(100, 'Smoke job completed');
    return {
      executedBy: config.workerName,
      platformArch: `${os.platform()}-${os.arch()}`,
      nodeVersion: process.version,
      note: job.payload.note ?? null,
    };
  }

  throw new Error(`Job type ${job.jobType} will be implemented in Phase 2-4.`);
}

export async function startWorkerLoop(config: WorkerRuntimeConfig): Promise<void> {
  if (!config.workerToken) {
    throw new Error('Missing YB_WORKER_TOKEN. Run bash infrastructure/local/sync-env.sh or generate a token in Studio.');
  }

  const platformArch = `${os.platform()}-${os.arch()}`;
  const reg = await postWorkerJson<{
    ok: boolean;
    workerId: string;
    workspaceId: string;
    heartbeatIntervalSeconds: number;
  }>(config, '/api/worker/register', {
    workerName: config.workerName,
    platformArch,
    capabilities: config.capabilities,
  });

  console.log(
    `[youbellkey-worker] Registered worker=${config.workerName} id=${reg.workerId} arch=${platformArch} controlPlane=${config.controlPlaneUrl}`,
  );

  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log('[youbellkey-worker] Shutdown signal received, stopping gracefully...');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  while (!stopping) {
    try {
      const { job } = await postWorkerJson<{ job: JobDispatch | null }>(config, '/api/worker/claim', {
        workerId: reg.workerId,
        capabilities: config.capabilities,
      });

      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      console.log(`[youbellkey-worker] Claimed job=${job.jobId} type=${job.jobType} attempt=${job.attemptCount}`);
      const heartbeatTimer = setInterval(() => {
        void postWorkerJson(config, '/api/worker/heartbeat', {
          workerId: reg.workerId,
          jobId: job.jobId,
        }).catch((err) => console.error('[youbellkey-worker] Heartbeat error:', err));
      }, Math.max(10_000, reg.heartbeatIntervalSeconds * 1000));

      try {
        const result = await executeClaimedJob(config, reg.workerId, job);
        await postWorkerJson(config, '/api/worker/complete', {
          workerId: reg.workerId,
          jobId: job.jobId,
          status: 'SUCCEEDED',
          result,
        });
        console.log(`[youbellkey-worker] Completed job=${job.jobId}`);
      } catch (jobError) {
        const message = jobError instanceof Error ? jobError.message : 'Unknown worker error';
        await postWorkerJson(config, '/api/worker/complete', {
          workerId: reg.workerId,
          jobId: job.jobId,
          status: 'FAILED',
          errorCode: 'WORKER_EXECUTION_ERROR',
          errorMessage: message,
        });
        console.error(`[youbellkey-worker] Failed job=${job.jobId}: ${message}`);
      } finally {
        clearInterval(heartbeatTimer);
      }
    } catch (loopError) {
      console.error(
        '[youbellkey-worker] Poll error:',
        loopError instanceof Error ? loopError.message : loopError,
      );
      await sleep(config.pollIntervalMs);
    }
  }
}
