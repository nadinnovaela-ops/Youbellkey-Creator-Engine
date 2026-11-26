import type { WorkerCapability } from '@youbellkey/job-contracts';

export interface WorkerRuntimeConfig {
  controlPlaneUrl: string;
  workerName: string;
  workerToken: string;
  capabilities: WorkerCapability[];
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
}

export function createDefaultWorkerConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  return {
    controlPlaneUrl: env.YB_CONTROL_PLANE_URL ?? 'http://localhost:3000',
    workerName: env.YB_WORKER_ID ?? 'local-pc-01',
    workerToken: env.YB_WORKER_TOKEN ?? '',
    capabilities: ['render', 'research', 'publish'],
    pollIntervalMs: 5000,
    heartbeatIntervalMs: 30000,
  };
}
