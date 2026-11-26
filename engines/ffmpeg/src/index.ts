import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FfmpegInspection {
  available: boolean;
  versionLine: string;
  hasGplFlags: boolean;
  commercialBundlingSafe: boolean;
}

/**
 * Inspects the external system FFmpeg CLI binary (subprocess boundary only).
 * Builds with `--enable-gpl` are permitted only as external personal tools and
 * must not be bundled inside Phase 7 commercial distribution installers.
 */
export async function inspectFfmpegBinary(): Promise<FfmpegInspection> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 10_000 });
    const lines = stdout.split('\n');
    const versionLine = lines[0]?.trim() ?? 'unknown';
    const configLine = lines.find((line) => line.startsWith('configuration:')) ?? '';
    const hasGplFlags = configLine.includes('--enable-gpl') || configLine.includes('--enable-libx264');

    return {
      available: true,
      versionLine,
      hasGplFlags,
      commercialBundlingSafe: !hasGplFlags,
    };
  } catch {
    return {
      available: false,
      versionLine: 'ffmpeg not found on PATH',
      hasGplFlags: false,
      commercialBundlingSafe: false,
    };
  }
}
