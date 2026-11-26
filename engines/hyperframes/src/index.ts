import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface HyperFramesDoctorResult {
  cliFound: boolean;
  output: string;
  exitCode: number;
}

export function resolveHyperFramesBinary(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, 'node_modules', '.bin', 'hyperframes');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function runHyperFramesDoctor(cwd = process.cwd()): Promise<HyperFramesDoctorResult> {
  const binPath = resolveHyperFramesBinary(cwd);
  if (!binPath) {
    return {
      cliFound: false,
      output: 'hyperframes binary not found in node_modules/.bin (run npm install first)',
      exitCode: 1,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(binPath, ['doctor'], {
      cwd,
      timeout: 30_000,
    });
    return {
      cliFound: true,
      output: [stdout, stderr].filter(Boolean).join('\n').trim(),
      exitCode: 0,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      cliFound: true,
      output: [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').trim(),
      exitCode: typeof err.code === 'number' ? err.code : 1,
    };
  }
}
