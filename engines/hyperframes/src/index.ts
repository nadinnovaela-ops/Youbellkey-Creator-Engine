import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

function chooseSafeWorkerCount(): number {
  const freeMb = os.freemem() / (1024 * 1024);
  const cpuCount = os.cpus().length;
  // Each Chrome render worker needs ~260 MB; use 2 workers when memory headroom permits
  if (cpuCount >= 4 && freeMb >= 1400) return 2;
  return 1;
}

function terminateChildGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals = 'SIGTERM'): void {
  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    // Ignore ESRCH if process already exited
  }
}

export async function renderHyperFramesProject(options: {
  workDir: string;
  outputMp4Path: string;
  fps?: number;
  quality?: 'draft' | 'looks' | 'delivery';
  expectedDurationSeconds?: number;
  repoRootDir?: string;
  onFrameProgress?: (completedFrames: number, totalFrames: number) => void;
}): Promise<{ stdout: string; stderr: string }> {
  const rootDir = options.repoRootDir ?? process.cwd();
  const binPath = resolveHyperFramesBinary(rootDir);
  if (!binPath) {
    throw new Error('hyperframes binary not found.');
  }

  const workers = chooseSafeWorkerCount();
  const args = [
    'render',
    options.workDir,
    '-o',
    options.outputMp4Path,
    '--fps',
    String(options.fps ?? 30),
    '--quality',
    options.quality ?? 'looks',
    '--workers',
    String(workers),
    '--protocol-timeout',
    '300000',
  ];

  // Low-memory mode prevents worker calibration crashes only on very constrained RAM
  if (workers === 1) {
    args.push('--low-memory-mode');
  } else {
    args.push('--no-low-memory-mode');
  }

  const timeoutMs = Math.max(
    480_000,
    Math.min(1_800_000, Math.round((options.expectedDurationSeconds ?? 60) * 14_000)),
  );

  return new Promise((resolve, reject) => {
    const child = spawn(binPath, args, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        HYPERFRAMES_NO_TELEMETRY: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    let stderrBuf = '';
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      terminateChildGroup(child, 'SIGTERM');
      setTimeout(() => terminateChildGroup(child, 'SIGKILL'), 5_000);
    }, timeoutMs);

    const parseTraceLine = (line: string) => {
      const jsonIdx = line.indexOf('{');
      if (jsonIdx < 0) return;
      try {
        const parsed = JSON.parse(line.slice(jsonIdx)) as {
          framesCompleted?: number;
          totalFrames?: number;
        };
        if (
          typeof parsed.framesCompleted === 'number' &&
          typeof parsed.totalFrames === 'number' &&
          parsed.totalFrames > 0
        ) {
          options.onFrameProgress?.(parsed.framesCompleted, parsed.totalFrames);
        }
      } catch {
        // Non-JSON log line
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 2 * 1024 * 1024) stdout = stdout.slice(-1024 * 1024);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      if (stderr.length > 2 * 1024 * 1024) stderr = stderr.slice(-1024 * 1024);

      stderrBuf += text;
      let nl = stderrBuf.indexOf('\n');
      while (nl >= 0) {
        const line = stderrBuf.slice(0, nl).trim();
        stderrBuf = stderrBuf.slice(nl + 1);
        parseTraceLine(line);
        nl = stderrBuf.indexOf('\n');
      }
    });

    child.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (stderrBuf.trim()) parseTraceLine(stderrBuf.trim());
      if (timedOut) {
        reject(new Error(`HyperFrames render timed out after ${Math.round(timeoutMs / 1000)}s.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`HyperFrames render exited with code ${code}: ${stderr.slice(-500) || stdout.slice(-500)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
