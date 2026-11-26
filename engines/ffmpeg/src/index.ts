import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FfmpegInspection {
  available: boolean;
  versionLine: string;
  hasGplFlags: boolean;
  commercialBundlingSafe: boolean;
}

export interface MediaProbeResult {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudioTrack: boolean;
  audioPeakDb: number;
  videoCodec: string | null;
  audioCodec: string | null;
  sizeBytes: number;
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

export async function probeMediaFile(filePath: string): Promise<MediaProbeResult> {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { timeout: 20_000 },
  );

  const info = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };

  const videoStream = info.streams?.find((s) => s.codec_type === 'video');
  const audioStream = info.streams?.find((s) => s.codec_type === 'audio');
  const durationSeconds = Number(
    Number(info.format?.duration ?? videoStream?.duration ?? audioStream?.duration ?? 0).toFixed(2),
  );
  const stat = await fs.stat(filePath);

  let audioPeakDb = -91;
  if (audioStream) {
    try {
      const { stderr } = await execFileAsync(
        'ffmpeg',
        ['-i', filePath, '-af', 'volumedetect', '-vn', '-sn', '-dn', '-f', 'null', '-'],
        { timeout: 20_000 },
      );
      const peakMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/i);
      if (peakMatch?.[1]) {
        const parsedPeak = Number(peakMatch[1]);
        if (Number.isFinite(parsedPeak)) audioPeakDb = parsedPeak;
      }
    } catch {
      audioPeakDb = -91;
    }
  }

  return {
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    durationSeconds,
    hasAudioTrack: Boolean(audioStream),
    audioPeakDb,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    sizeBytes: stat.size,
  };
}

/**
 * Concatenates per-scene WAV files sequentially into a single normalized MP3 voiceover track.
 */
export async function concatAudioSegmentsToMp3(
  segmentWavPaths: string[],
  outputMp3Path: string,
): Promise<number> {
  if (segmentWavPaths.length === 0) {
    throw new Error('concatAudioSegmentsToMp3 requires at least 1 audio file.');
  }

  const args: string[] = ['-y'];
  for (const p of segmentWavPaths) {
    args.push('-i', p);
  }

  if (segmentWavPaths.length === 1) {
    args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', outputMp3Path);
  } else {
    const inputs = segmentWavPaths.map((_, i) => `[${i}:a]`).join('');
    args.push(
      '-filter_complex',
      `${inputs}concat=n=${segmentWavPaths.length}:v=0:a=1[aout];[aout]loudnorm=I=-16:TP=-1.5:LRA=11[anorm]`,
      '-map',
      '[anorm]',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      outputMp3Path,
    );
  }

  await execFileAsync('ffmpeg', args, { timeout: 60_000 });
  const probed = await probeMediaFile(outputMp3Path);
  return probed.durationSeconds;
}

/**
 * Normalizes audio loudness to -14 LUFS and enforces Shorts-ready MP4 faststart container.
 */
export async function postProcessShortsMp4(
  inputMp4Path: string,
  outputMp4Path: string,
): Promise<MediaProbeResult> {
  const preProbe = await probeMediaFile(inputMp4Path);

  const args = ['-y', '-i', inputMp4Path];
  if (preProbe.videoCodec === 'h264' && preProbe.width === 1080 && preProbe.height === 1920) {
    args.push('-c:v', 'copy');
  } else {
    args.push('-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '19');
  }

  if (preProbe.hasAudioTrack) {
    args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  } else {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-shortest', '-c:a', 'aac', '-b:a', '128k');
  }

  args.push('-movflags', '+faststart', outputMp4Path);
  await execFileAsync('ffmpeg', args, { timeout: 120_000 });

  return probeMediaFile(outputMp4Path);
}
