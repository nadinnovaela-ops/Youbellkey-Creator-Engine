import { createDefaultWorkerConfig } from '@youbellkey/local-worker';

export function createCloudWorkerConfig(env: NodeJS.ProcessEnv) {
  return {
    ...createDefaultWorkerConfig(env),
    workerName: env.YB_WORKER_ID ?? 'cloud-arm64-01',
  };
}
