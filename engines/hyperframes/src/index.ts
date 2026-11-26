import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

export * from './compiler.js';

const execFileAsync = promisify(execFile);

export interface HyperFramesDoctorResult {
  cliFound: boolean;
  output: string;
  exitCode: number;
}

export interface HyperFramesLintResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  findings: Array<{ severity?: string; message?: string }>;
  rawOutput: string;
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

export async function lintHyperFramesProject(
  workDir: string,
  repoRootDir = process.cwd(),
): Promise<HyperFramesLintResult> {
  const binPath = resolveHyperFramesBinary(repoRootDir);
  if (!binPath) {
    throw new Error('hyperframes binary not found.');
  }

  let rawOutput = '';
  try {
    const { stdout, stderr } = await execFileAsync(binPath, ['lint', workDir, '--json'], {
      cwd: repoRootDir,
      timeout: 30_000,
    });
    rawOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    rawOutput = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
  }

  try {
    const jsonStart = rawOutput.indexOf('{');
    const jsonStr = jsonStart >= 0 ? rawOutput.slice(jsonStart) : '{}';
    const parsed = JSON.parse(jsonStr) as {
      errorCount?: number;
      warningCount?: number;
      findings?: Array<{ severity?: string; message?: string }>;
    };
    const errorCount = Number(parsed.errorCount ?? 0);
    return {
      passed: errorCount === 0,
      errorCount,
      warningCount: Number(parsed.warningCount ?? 0),
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      rawOutput,
    };
  } catch {
    return {
      passed: false,
      errorCount: 1,
      warningCount: 0,
      findings: [{ severity: 'error', message: rawOutput || 'HyperFrames lint returned non-JSON error' }],
      rawOutput,
    };
  }
}

export async function renderHyperFramesProject(options: {
  workDir: string;
  outputMp4Path: string;
  fps?: number;
  quality?: 'draft' | 'looks' | 'delivery';
  repoRootDir?: string;
}): Promise<{ stdout: string; stderr: string }> {
  const rootDir = options.repoRootDir ?? process.cwd();
  const binPath = resolveHyperFramesBinary(rootDir);
  if (!binPath) {
    throw new Error('hyperframes binary not found.');
  }

  const args = [
    'render',
    options.workDir,
    '-o',
    options.outputMp4Path,
    '--fps',
    String(options.fps ?? 30),
    '--quality',
    options.quality ?? 'looks',
    '--low-memory-mode',
  ];

  const { stdout, stderr } = await execFileAsync(binPath, args, {
    cwd: rootDir,
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return { stdout, stderr };
}
