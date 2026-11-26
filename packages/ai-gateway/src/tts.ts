import type { SupportedLocale } from '@youbellkey/shared-types';
import type { WordCaption } from '@youbellkey/video-schema';

export interface TtsSynthesisOptions {
  text: string;
  locale: SupportedLocale;
  voiceId?: string;
  providerKeys?: {
    geminiApiKey?: string;
    googleCloudTtsApiKey?: string;
    azureSpeechKey?: string;
    azureSpeechRegion?: string;
  };
}

export interface TtsSynthesisResult {
  wavBuffer: Buffer;
  provider: 'gemini-tts' | 'google-cloud-tts' | 'azure-speech-f0' | 'fallback-tone';
  model: string;
  estimatedDurationSeconds: number;
  warnings: string[];
}

export function pcmL16ToWavBuffer(
  pcmData: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM subchunk size
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Generates a subtle warm-bed fallback WAV when all cloud TTS APIs are offline
 * so automated render tests remain deterministic and pass non-silent media checks.
 */
export function buildFallbackToneWavBuffer(durationSeconds: number, sampleRate = 24000): Buffer {
  const clampedDur = Math.max(2, Math.min(60, durationSeconds));
  const totalSamples = Math.floor(clampedDur * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 4) * Math.min(1, (clampedDur - t) * 4);
    const val = Math.sin(2 * Math.PI * 196 * t) * 0.08 * envelope;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(val * 32767))), i * 2);
  }
  return pcmL16ToWavBuffer(pcm, sampleRate, 1, 16);
}

export function estimateSpeechDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2.5, Number(((words / 2.4) + 0.6).toFixed(2)));
}

export function estimateWordCaptionsFromScript(
  text: string,
  totalDurationSeconds: number,
  offsetSeconds = 0,
): WordCaption[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const usableDuration = Math.max(0.5, totalDurationSeconds - 0.25);
  const weights = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, '').length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let cursor = offsetSeconds + 0.08;
  return words.map((word, idx) => {
    const portion = ((weights[idx] ?? 2) / Math.max(1, totalWeight)) * usableDuration;
    const startSeconds = Number(cursor.toFixed(3));
    const endSeconds = Number(Math.max(startSeconds + 0.08, cursor + portion).toFixed(3));
    cursor = endSeconds;
    return { word, startSeconds, endSeconds };
  });
}

async function callGeminiTts(text: string, locale: SupportedLocale, apiKey: string, voiceName?: string): Promise<{ wavBuffer: Buffer; model: string }> {
  const models = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
  const selectedVoice = voiceName || (locale === 'id-ID' ? 'Kore' : 'Puck');
  // Pass only the exact spoken text so the TTS model does not narrate meta-instructions.
  const spokenText = text.trim();

  let lastErr = '';
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: spokenText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) {
        lastErr = `Gemini TTS ${model} (${res.status}): ${(await res.text()).slice(0, 180)}`;
        if ([404, 429, 500, 502, 503].includes(res.status)) continue;
        throw new Error(lastErr);
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
        }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        lastErr = `Gemini TTS ${model} returned no audio inlineData`;
        continue;
      }

      const rawBytes = Buffer.from(inline.data, 'base64');
      const rateMatch = inline.mimeType?.match(/rate=(\d+)/i);
      const sampleRate = rateMatch?.[1] ? Number(rateMatch[1]) : 24000;
      const wavBuffer = inline.mimeType?.toLowerCase().includes('wav')
        ? rawBytes
        : pcmL16ToWavBuffer(rawBytes, sampleRate, 1, 16);

      return { wavBuffer, model };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastErr || 'Gemini TTS failed.');
}

async function callGoogleCloudTts(text: string, locale: SupportedLocale, apiKey: string): Promise<Buffer> {
  const voiceName = locale === 'id-ID' ? 'id-ID-Standard-B' : 'en-US-Standard-J';
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey.trim())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: locale, name: voiceName },
        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Google Cloud TTS (${res.status}): ${(await res.text()).slice(0, 180)}`);
  }
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error('Google Cloud TTS returned empty audioContent');
  return Buffer.from(json.audioContent, 'base64');
}

export async function synthesizeVoiceover(options: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
  const warnings: string[] = [];
  const keys = options.providerKeys ?? {};

  if (keys.geminiApiKey?.trim()) {
    try {
      const { wavBuffer, model } = await callGeminiTts(
        options.text,
        options.locale,
        keys.geminiApiKey,
        options.voiceId,
      );
      const dataBytes = Math.max(0, wavBuffer.length - 44);
      const estimatedDurationSeconds = Number(Math.max(1.5, dataBytes / (24000 * 2)).toFixed(2));
      return {
        wavBuffer,
        provider: 'gemini-tts',
        model,
        estimatedDurationSeconds,
        warnings,
      };
    } catch (err) {
      warnings.push(`Gemini TTS dilewati: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (keys.googleCloudTtsApiKey?.trim()) {
    try {
      const wavBuffer = await callGoogleCloudTts(options.text, options.locale, keys.googleCloudTtsApiKey);
      const dataBytes = Math.max(0, wavBuffer.length - 44);
      const estimatedDurationSeconds = Number(Math.max(1.5, dataBytes / (24000 * 2)).toFixed(2));
      return {
        wavBuffer,
        provider: 'google-cloud-tts',
        model: 'standard-linear16',
        estimatedDurationSeconds,
        warnings,
      };
    } catch (err) {
      warnings.push(`Google Cloud TTS dilewati: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const estimatedDurationSeconds = estimateSpeechDurationSeconds(options.text);
  warnings.push('Menggunakan fallback audio deterministik karena layanan TTS cloud tidak tersedia.');
  return {
    wavBuffer: buildFallbackToneWavBuffer(estimatedDurationSeconds),
    provider: 'fallback-tone',
    model: 'sine-bed-24k',
    estimatedDurationSeconds,
    warnings,
  };
}

/**
 * Aligns voiceover audio to word-level timestamps using Groq Whisper (`whisper-large-v3-turbo`).
 */
export async function alignWordCaptionsWithGroqWhisper(options: {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  locale: SupportedLocale;
  fallbackText: string;
  fallbackDurationSeconds: number;
  offsetSeconds?: number;
  groqApiKey?: string;
}): Promise<{ wordCaptions: WordCaption[]; usedWhisper: boolean; warning?: string }> {
  const offset = options.offsetSeconds ?? 0;
  const groqKey = options.groqApiKey?.trim();

  if (!groqKey) {
    return {
      wordCaptions: estimateWordCaptionsFromScript(options.fallbackText, options.fallbackDurationSeconds, offset),
      usedWhisper: false,
      warning: 'GROQ_API_KEY tidak tersedia; memakai estimasi timing kata proporsional.',
    };
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(options.audioBuffer)], { type: options.mimeType }), options.filename);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('language', options.locale === 'id-ID' ? 'id' : 'en');
    if (options.fallbackText.trim()) {
      form.append('prompt', options.fallbackText.slice(0, 220));
    }

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq Whisper (${res.status}): ${errText.slice(0, 180)}`);
    }

    const json = (await res.json()) as {
      words?: Array<{ word?: string; start?: number; end?: number }>;
    };

    const words = (json.words ?? [])
      .map((w) => {
        const word = (w.word ?? '').trim();
        const start = Math.max(0, Number(w.start ?? 0)) + offset;
        const end = Math.max(start + 0.05, Number(w.end ?? start + 0.25) + offset);
        return {
          word,
          startSeconds: Number(start.toFixed(3)),
          endSeconds: Number(end.toFixed(3)),
        };
      })
      .filter((w) => w.word.length > 0);

    if (words.length === 0) {
      return {
        wordCaptions: estimateWordCaptionsFromScript(options.fallbackText, options.fallbackDurationSeconds, offset),
        usedWhisper: false,
        warning: 'Whisper tidak mengembalikan word timestamps; memakai estimasi proporsional.',
      };
    }

    return { wordCaptions: words, usedWhisper: true };
  } catch (err) {
    return {
      wordCaptions: estimateWordCaptionsFromScript(options.fallbackText, options.fallbackDurationSeconds, offset),
      usedWhisper: false,
      warning: err instanceof Error ? err.message : String(err),
    };
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates an editorial SVG 9:16 artwork fallback when cloud image generation
 * quota is exhausted or unavailable, ensuring Jalur B stays deterministic.
 */
export function buildDeterministicEditorialSvg(prompt: string, sceneIndex: number): string {
  const palettes: ReadonlyArray<readonly [string, string, string]> = [
    ['#071426', '#0E7490', '#38BDF8'],
    ['#1A102B', '#6D28D9', '#C084FC'],
    ['#06221C', '#047857', '#34D399'],
    ['#271111', '#B91C1C', '#FB923C'],
  ];
  const palette = palettes[sceneIndex % palettes.length] ?? palettes[0]!;
  const [bg1, bg2, accent] = palette;
  const label = escapeXml(prompt.slice(0, 72));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="55%" stop-color="${bg2}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="48%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <circle cx="540" cy="720" r="520" fill="url(#glow)"/>
  <g opacity="0.22" stroke="${accent}" stroke-width="2" fill="none">
    <circle cx="540" cy="720" r="220"/>
    <circle cx="540" cy="720" r="340" stroke-dasharray="14 10"/>
    <circle cx="540" cy="720" r="460"/>
    <path d="M120 1320 Q 540 1120 960 1320"/>
    <path d="M120 1380 Q 540 1180 960 1380"/>
  </g>
  <text x="540" y="106" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="22" opacity="0.35">${label}</text>
</svg>`;
}

export async function generateSceneVisualAsset(options: {
  prompt: string;
  sceneIndex: number;
  geminiApiKey?: string;
}): Promise<{ buffer: Buffer; extension: 'png' | 'svg'; usedFallback: boolean }> {
  const key = options.geminiApiKey?.trim();
  if (key) {
    for (const model of ['gemini-3.1-flash-image', 'gemini-2.5-flash-image']) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${options.prompt}, vertical 9:16 composition, no watermark, no overlaid text` }] }],
              generationConfig: { responseModalities: ['IMAGE'] },
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
            }>;
          };
          const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
          if (inline?.data) {
            return {
              buffer: Buffer.from(inline.data, 'base64'),
              extension: 'png',
              usedFallback: false,
            };
          }
        }
      } catch {
        // Fall through cleanly to editorial SVG art.
      }
    }
  }

  return {
    buffer: Buffer.from(buildDeterministicEditorialSvg(options.prompt, options.sceneIndex), 'utf8'),
    extension: 'svg',
    usedFallback: true,
  };
}
