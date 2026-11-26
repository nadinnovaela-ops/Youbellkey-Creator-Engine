import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
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

export interface ProceduralSfxCue {
  timestampSeconds: number;
  kind: 'whoosh' | 'pop' | 'riser';
}

export interface ConcatAudioOptions {
  /** Exact per-scene duration slots so inter-scene pauses stay aligned with captions. */
  sceneDurationsSeconds?: number[];
  /** Subtle procedural transition/pop SFX cues mixed cleanly under voiceover (-20 dB). */
  sfxCues?: ProceduralSfxCue[];
}

/**
 * Generates clean copyright-free procedural WAV sound effects (whoosh, UI pop, riser)
 * mathematically in memory for editorial video pacing without external audio packs.
 */
export function synthesizeProceduralSfxWav(kind: ProceduralSfxCue['kind'], sampleRate = 44100): Buffer {
  const durationSec = kind === 'pop' ? 0.11 : kind === 'riser' ? 0.48 : 0.28;
  const totalSamples = Math.floor(durationSec * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);

  let lpState = 0;
  let phase = 0;
  let seed = 1337 + kind.length * 97;
  const nextNoise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < totalSamples; i++) {
    const p = i / Math.max(1, totalSamples - 1);
    let sample = 0;
    if (kind === 'pop') {
      const env = Math.sin(Math.PI * Math.pow(p, 0.55)) * Math.exp(-p * 5.2);
      const freq = 240 + 440 * Math.sin(Math.PI * Math.min(1, p * 1.4));
      phase += (2 * Math.PI * freq) / sampleRate;
      sample = (Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.18) * env * 0.72;
    } else if (kind === 'whoosh') {
      const env = Math.sin(Math.PI * p);
      const alpha = 0.04 + 0.18 * Math.sin(Math.PI * p);
      lpState = lpState + alpha * (nextNoise() - lpState);
      sample = lpState * env * 0.85;
    } else {
      const env = Math.pow(p, 1.3) * (1 - Math.pow(Math.max(0, (p - 0.85) / 0.15), 2));
      const freq = 180 + 480 * p * p;
      phase += (2 * Math.PI * freq) / sampleRate;
      sample = (Math.sin(phase) * 0.65 + Math.sin(phase * 1.5) * 0.22) * env * 0.52;
    }

    const clamped = Math.max(-0.98, Math.min(0.98, sample));
    pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Concatenates per-scene WAV files sequentially into a single normalized MP3 voiceover track,
 * preserving exact per-scene duration slots and optionally mixing subtle procedural SFX cues.
 */
export async function concatAudioSegmentsToMp3(
  segmentWavPaths: string[],
  outputMp3Path: string,
  options?: ConcatAudioOptions,
): Promise<number> {
  if (segmentWavPaths.length === 0) {
    throw new Error('concatAudioSegmentsToMp3 requires at least 1 audio file.');
  }

  const durations =
    options?.sceneDurationsSeconds && options.sceneDurationsSeconds.length === segmentWavPaths.length
      ? options.sceneDurationsSeconds
      : null;

  const args: string[] = ['-y'];
  for (const p of segmentWavPaths) {
    args.push('-i', p);
  }

  const segmentFilters = segmentWavPaths.map((_, i) => {
    const dur = durations ? Math.max(0.5, durations[i]!).toFixed(3) : null;
    return dur
      ? `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono,apad=whole_dur=${dur},atrim=0:${dur}[p${i}]`
      : `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono[p${i}]`;
  });
  const paddedLabels = segmentWavPaths.map((_, i) => `[p${i}]`).join('');
  const baseConcatPath = `${outputMp3Path}.base.wav`;

  args.push(
    '-filter_complex',
    `${segmentFilters.join(';')};${paddedLabels}concat=n=${segmentWavPaths.length}:v=0:a=1[aout]`,
    '-map',
    '[aout]',
    '-c:a',
    'pcm_s16le',
    '-ar',
    '44100',
    baseConcatPath,
  );

  await execFileAsync('ffmpeg', args, { timeout: 60_000 });

  const sfxCues = (options?.sfxCues ?? [])
    .filter((c) => Number.isFinite(c.timestampSeconds) && c.timestampSeconds >= 0)
    .slice(0, 20);

  let mixedSuccessfully = false;
  if (sfxCues.length > 0) {
    const workDir = path.dirname(outputMp3Path);
    const sfxPaths: Record<ProceduralSfxCue['kind'], string> = {
      whoosh: path.join(workDir, '_sfx_whoosh.wav'),
      pop: path.join(workDir, '_sfx_pop.wav'),
      riser: path.join(workDir, '_sfx_riser.wav'),
    };
    try {
      await Promise.all([
        fs.writeFile(sfxPaths.whoosh, synthesizeProceduralSfxWav('whoosh')),
        fs.writeFile(sfxPaths.pop, synthesizeProceduralSfxWav('pop')),
        fs.writeFile(sfxPaths.riser, synthesizeProceduralSfxWav('riser')),
      ]);

      const mixArgs = ['-y', '-i', baseConcatPath];
      const filterParts: string[] = ['[0:a]aformat=sample_rates=44100:channel_layouts=mono[vo]'];
      const mixLabels = ['[vo]'];

      sfxCues.forEach((cue, idx) => {
        const inputIdx = idx + 1;
        mixArgs.push('-i', sfxPaths[cue.kind]);
        const delayMs = Math.max(0, Math.round(cue.timestampSeconds * 1000));
        const gain = cue.kind === 'pop' ? 0.14 : cue.kind === 'riser' ? 0.11 : 0.1;
        filterParts.push(`[${inputIdx}:a]adelay=${delayMs},volume=${gain}[s${idx}]`);
        mixLabels.push(`[s${idx}]`);
      });

      filterParts.push(
        `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[afinal]`,
      );

      mixArgs.push(
        '-filter_complex',
        filterParts.join(';'),
        '-map',
        '[afinal]',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-ar',
        '44100',
        outputMp3Path,
      );
      await execFileAsync('ffmpeg', mixArgs, { timeout: 60_000 });
      mixedSuccessfully = true;
    } catch {
      mixedSuccessfully = false;
    } finally {
      await Promise.all(
        Object.values(sfxPaths).map((p) => fs.unlink(p).catch(() => undefined)),
      );
    }
  }

  if (!mixedSuccessfully) {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', baseConcatPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', outputMp3Path],
      { timeout: 60_000 },
    );
  }

  await fs.unlink(baseConcatPath).catch(() => undefined);
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
