import { runHyperFramesDoctor } from './index.js';

const result = await runHyperFramesDoctor(process.cwd());
console.log(result.output);

if (!result.cliFound) {
  process.exit(1);
}
