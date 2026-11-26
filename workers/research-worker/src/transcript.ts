import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseVttTranscript } from './core.js';

const execFileAsync = promisify(execFile);

export interface TranscriptExtractionResult {
  transcriptText: string;
  method: 'yt-dlp-subtitles' | 'groq-whisper';
  language: string | null;
  durationSeconds?: number;
}

/**
 * Extracts a reference video transcript on a worker PC via yt-dlp subprocess CLI,
 * using captions first and falling back to Groq Whisper if no captions exist.
 */
export async function extractReferenceTranscript(options: {
  videoUrl: string;
  preferredLocale?: 'id-ID' | 'en-US';
  groqApiKey?: string;
  ytDlpBin?: string;
}): Promise<TranscriptExtractionResult> {
  const ytDlp = options.ytDlpBin ?? process.env.YT_DLP_PATH ?? 'yt-dlp';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yb-transcript-'));
  const langOrder = options.preferredLocale === 'en-US' ? 'en,en-US,id' : 'id,en,en-US';

  try {
    // Pass 1: Try free subtitle / auto-caption extraction without downloading video
    try {
      await execFileAsync(
        ytDlp,
        [
          '--no-playlist',
          '--skip-download',
          '--write-auto-sub',
          '--write-sub',
          '--sub-langs',
          langOrder,
          '--sub-format',
          'vtt',
          '-o',
          path.join(tempDir, 'ref.%(ext)s'),
          options.videoUrl,
        ],
        { timeout: 60_000 },
      );

      const files = await fs.readdir(tempDir);
      const vttFiles = files.filter((f) => f.endsWith('.vtt'));
      if (vttFiles.length > 0) {
        const preferredPrefix = options.preferredLocale === 'en-US' ? '.en' : '.id';
        const chosen = vttFiles.find((f) => f.includes(preferredPrefix)) ?? vttFiles[0]!;
        const vttRaw = await fs.readFile(path.join(tempDir, chosen), 'utf8');
        const transcriptText = parseVttTranscript(vttRaw);
        if (transcriptText.length >= 20) {
          const langMatch = chosen.match(/\.([a-zA-Z-]+)\.vtt$/);
          return {
            transcriptText,
            method: 'yt-dlp-subtitles',
            language: langMatch?.[1] ?? null,
          };
        }
      }
    } catch {
      // Fallback cleanly to audio + Groq Whisper below.
    }

    const groqKey = options.groqApiKey?.trim();
    if (!groqKey) {
      throw new Error(
        'Video ini tidak memiliki subtitle/auto-caption YouTube, dan GROQ_API_KEY belum tersedia di worker untuk transkripsi Whisper.',
      );
    }

    // Pass 2: Extract small audio file and call Groq Whisper Free API (whisper-large-v3-turbo)
    const audioOutput = path.join(tempDir, 'audio.%(ext)s');
    await execFileAsync(
      ytDlp,
      [
        '--no-playlist',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '7',
        '--max-filesize',
        '24M',
        '-o',
        audioOutput,
        options.videoUrl,
      ],
      { timeout: 120_000 },
    );

    const files = await fs.readdir(tempDir);
    const audioFile = files.find((f) => /\.(mp3|m4a|webm|opus)$/i.test(f));
    if (!audioFile) {
      throw new Error('yt-dlp tidak menghasilkan file audio untuk transkripsi.');
    }

    const audioBuffer = await fs.readFile(path.join(tempDir, audioFile));
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), audioFile);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    if (options.preferredLocale) {
      form.append('language', options.preferredLocale === 'id-ID' ? 'id' : 'en');
    }

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      throw new Error(`Groq Whisper API failed (${whisperRes.status}): ${errText.slice(0, 300)}`);
    }

    const whisperJson = (await whisperRes.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };
    const transcriptText = whisperJson.text?.trim() ?? '';
    if (!transcriptText) {
      throw new Error('Groq Whisper mengembalikan transkrip kosong.');
    }

    return {
      transcriptText,
      method: 'groq-whisper',
      language: whisperJson.language ?? null,
      durationSeconds: whisperJson.duration,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
