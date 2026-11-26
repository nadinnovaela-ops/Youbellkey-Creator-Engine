import { createDefaultWorkerConfig, loadLocalEnvFile, startWorkerLoop } from '@youbellkey/local-worker';

export function createCloudWorkerConfig(env: NodeJS.ProcessEnv) {
  return {
    ...createDefaultWorkerConfig(env),
    workerName: env.YB_WORKER_ID ?? 'cloud-arm64-01',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnvFile(process.cwd());
  await startWorkerLoop(createCloudWorkerConfig(process.env));
}
