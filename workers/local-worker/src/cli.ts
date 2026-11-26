import { createDefaultWorkerConfig, loadLocalEnvFile, startWorkerLoop } from './runner.js';

loadLocalEnvFile(process.cwd());
const config = createDefaultWorkerConfig(process.env);
await startWorkerLoop(config);
