import { createDefaultWorkerConfig, loadLocalEnvFile, startWorkerLoop } from './runner.js';

loadLocalEnvFile(process.cwd());
const config = createDefaultWorkerConfig(process.env);

const runOnce = process.argv.includes('--once');
await startWorkerLoop(config, runOnce);
