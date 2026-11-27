import { evaluateBatchOriginality, type BatchCandidateReport } from '@youbellkey/originality-engine';
import type { SupportedLocale, UsageCostEntry, VideoTrack } from '@youbellkey/shared-types';
import {
  YBVideoDocumentSchema,
  type SceneLayer,
  type YBScene,
  type YBVideoDocument,
} from '@youbellkey/video-schema';

export type AITaskKind =
  | 'script_draft'
  | 'complex_research'
  | 'grammar_check'
  | 'vision_analysis'
  | 'image_generation'
  | 'tts_voiceover'
  | 'whisper_alignment';

export interface TextGenerationRequest {
  task: Extract<AITaskKind, 'script_draft' | 'complex_research' | 'grammar_check' | 'vision_analysis'>;
  locale: SupportedLocale;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface TextGenerationResponse {
  text: string;
  usage: UsageCostEntry;
}

export interface WordAlignmentToken {
  word: string;
  startSeconds: number;
  endSeconds: number;
}

export interface AIProviderAdapter {
  readonly providerId: string;
  generateText(req: TextGenerationRequest, apiKey: string): Promise<TextGenerationResponse>;
}

export interface RoutingRule {
  task: AITaskKind;
  preferredProviders: string[];
}

export const DEFAULT_FREE_ROUTING_RULES: RoutingRule[] = [
  { task: 'script_draft', preferredProviders: ['gemini-free', 'groq-free', 'openrouter-free'] },
  { task: 'complex_research', preferredProviders: ['gemini-free', 'openrouter-free', 'groq-free'] },
  { task: 'grammar_check', preferredProviders: ['groq-free', 'gemini-free', 'openrouter-free'] },
  { task: 'vision_analysis', preferredProviders: ['gemini-free', 'openrouter-free'] },
  { task: 'image_generation', preferredProviders: ['cloudflare-workers-ai', 'gemini-imagen'] },
  { task: 'tts_voiceover', preferredProviders: ['google-cloud-tts', 'azure-speech-f0'] },
  { task: 'whisper_alignment', preferredProviders: ['groq-whisper-free'] },
];

export const geminiFreeAdapter: AIProviderAdapter = {
  providerId: 'gemini-free',
  async generateText(req, apiKey) {
    const models = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
    let lastErr = '';

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 4096,
          temperature: 0.8,
          ...(req.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(22_000),
        });
      } catch (err) {
        lastErr = `Gemini ${model} timeout/network: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }

      if (!res.ok) {
        lastErr = `Gemini ${model} (${res.status}): ${(await res.text()).slice(0, 220)}`;
        if ([404, 429, 500, 502, 503, 504].includes(res.status)) continue;
        throw new Error(lastErr);
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text.trim()) {
        lastErr = `Gemini ${model} returned empty text.`;
        continue;
      }

      return {
        text,
        usage: {
          provider: 'gemini-free',
          model,
          inputUnits: Number(json.usageMetadata?.promptTokenCount ?? 0),
          outputUnits: Number(json.usageMetadata?.candidatesTokenCount ?? 0),
          estimatedCostUsd: 0,
        },
      };
    }

    throw new Error(lastErr || 'Gemini call failed.');
  },
};

async function callOpenAiCompatible(
  providerId: string,
  endpoint: string,
  models: string[],
  req: TextGenerationRequest,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): Promise<TextGenerationResponse> {
  let lastErr = '';

  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 4096,
          temperature: 0.8,
          ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      lastErr = `${providerId} ${model} timeout/network: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }

    if (!res.ok) {
      lastErr = `${providerId} ${model} (${res.status}): ${(await res.text()).slice(0, 220)}`;
      if ([404, 429, 500, 502, 503, 504].includes(res.status)) continue;
      throw new Error(lastErr);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      lastErr = `${providerId} ${model} returned empty message.`;
      continue;
    }

    return {
      text,
      usage: {
        provider: providerId,
        model,
        inputUnits: Number(json.usage?.prompt_tokens ?? 0),
        outputUnits: Number(json.usage?.completion_tokens ?? 0),
        estimatedCostUsd: 0,
      },
    };
  }

  throw new Error(lastErr || `${providerId} call failed.`);
}

export const groqFreeAdapter: AIProviderAdapter = {
  providerId: 'groq-free',
  generateText(req, apiKey) {
    return callOpenAiCompatible(
      'groq-free',
      'https://api.groq.com/openai/v1/chat/completions',
      ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
      req,
      apiKey,
    );
  },
};

export const openRouterFreeAdapter: AIProviderAdapter = {
  providerId: 'openrouter-free',
  generateText(req, apiKey) {
    return callOpenAiCompatible(
      'openrouter-free',
      'https://openrouter.ai/api/v1/chat/completions',
      ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free'],
      req,
      apiKey,
      {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://youbellkey-creator-engine.vercel.app',
        'X-Title': 'Youbellkey Studio',
      },
    );
  },
};

export const TEXT_ADAPTER_REGISTRY: Record<string, AIProviderAdapter> = {
  'gemini-free': geminiFreeAdapter,
  'groq-free': groqFreeAdapter,
  'openrouter-free': openRouterFreeAdapter,
};

export async function generateTextWithRouting(
  req: TextGenerationRequest,
  providerKeys: Record<string, string | undefined>,
): Promise<{ response: TextGenerationResponse; errors: string[] }> {
  const rule = DEFAULT_FREE_ROUTING_RULES.find((r) => r.task === req.task);
  const candidates = rule?.preferredProviders ?? ['gemini-free', 'groq-free', 'openrouter-free'];
  const errors: string[] = [];

  for (const providerId of candidates) {
    const adapter = TEXT_ADAPTER_REGISTRY[providerId];
    const key = providerKeys[providerId]?.trim();
    if (!adapter || !key) continue;

    try {
      const response = await adapter.generateText(req, key);
      return { response, errors };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(
    errors.length > 0
      ? `Semua AI provider gagal dihubungi: ${errors.join(' | ')}`
      : 'Tidak ada API key AI yang aktif (Gemini / Groq / OpenRouter) di AI Vault atau env Vercel.',
  );
}

export function extractJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const startObj = candidate.indexOf('{');
    const endObj = candidate.lastIndexOf('}');
    if (startObj >= 0 && endObj > startObj) {
      return JSON.parse(candidate.slice(startObj, endObj + 1));
    }
    throw new Error('Model response did not contain valid JSON.');
  }
}

export interface ContentLabGenerationInput {
  topicOrTitle: string;
  referenceSummary?: string;
  referenceTranscript?: string;
  locale: SupportedLocale;
  videoTrack: VideoTrack;
  variationCount: number;
}

export interface GeneratedContentVariation {
  angle: string;
  hookText: string;
  title: string;
  scriptText: string;
  ybVideoDoc: YBVideoDocument;
  originality: BatchCandidateReport;
}

export interface ContentLabGenerationOutput {
  variations: GeneratedContentVariation[];
  usage: UsageCostEntry | null;
  usedFallbackTemplate: boolean;
  warnings: string[];
}

const ANGLE_PRESETS = [
  'Contrarian Myth-Buster',
  'Visual Data & Proof',
  'Micro-Story Investigation',
  'Common Mistake Alert',
  '3-Step Action Blueprint',
] as const;

function sanitizeAccentColor(color: unknown): string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#38BDF8';
}

function normalizeSceneLayer(
  rawLayer: unknown,
  videoTrack: VideoTrack,
  fallbackHeadline: string,
  sceneIdx: number,
): SceneLayer {
  const obj = (rawLayer && typeof rawLayer === 'object' ? rawLayer : {}) as Record<string, unknown>;
  const kind = obj.kind;

  if (videoTrack === 'AI_STORYTELLING' || kind === 'ai-image') {
    const motions = ['ken-burns-in', 'pan-right', 'ken-burns-out', 'pan-left'] as const;
    const motion =
      typeof obj.cameraMotion === 'string' && motions.includes(obj.cameraMotion as (typeof motions)[number])
        ? (obj.cameraMotion as (typeof motions)[number])
        : motions[sceneIdx % motions.length]!;
    const promptText =
      typeof obj.prompt === 'string' && obj.prompt.trim().length >= 5
        ? obj.prompt.trim()
        : `Editorial vertical 9:16 documentary illustration about ${fallbackHeadline}, dramatic lighting, crisp composition`;
    return {
      kind: 'ai-image',
      prompt: promptText,
      cameraMotion: motion,
    };
  }

  if (kind === 'threejs') {
    const presets = [
      'diorama-city-flood',
      'diorama-volume-cube',
      'diorama-cutaway-strata',
      'diorama-map-compare',
      'orbital-particles',
      'floating-cards',
      'data-bars-3d',
    ] as const;
    const preset =
      typeof obj.preset === 'string' && presets.includes(obj.preset as (typeof presets)[number])
        ? (obj.preset as (typeof presets)[number])
        : presets[sceneIdx % presets.length]!;
    return {
      kind: 'threejs',
      preset,
      params: { density: 180, speed: 1.1 },
    };
  }

  if (kind === 'chart' && Array.isArray(obj.series) && obj.series.length > 0) {
    const chartTypes = ['bar', 'line', 'counter'] as const;
    const chartType =
      typeof obj.chartType === 'string' && chartTypes.includes(obj.chartType as (typeof chartTypes)[number])
        ? (obj.chartType as (typeof chartTypes)[number])
        : 'bar';
    const series = obj.series
      .slice(0, 5)
      .map((item, idx) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
          label: typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 32) : `Item ${idx + 1}`,
          value: typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : (idx + 1) * 25,
        };
      });
    return {
      kind: 'chart',
      chartType,
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : fallbackHeadline,
      series,
    };
  }

  return {
    kind: 'typography',
    headline:
      typeof obj.headline === 'string' && obj.headline.trim()
        ? obj.headline.trim().slice(0, 90)
        : fallbackHeadline.slice(0, 90),
    subheadline:
      typeof obj.subheadline === 'string' && obj.subheadline.trim()
        ? obj.subheadline.trim().slice(0, 120)
        : undefined,
    accentColor: sanitizeAccentColor(obj.accentColor),
  };
}

export function normalizeToValidYBVideoDocument(
  rawDoc: unknown,
  fallback: {
    title: string;
    locale: SupportedLocale;
    videoTrack: VideoTrack;
    scenesText: string[];
  },
): YBVideoDocument {
  const obj = (rawDoc && typeof rawDoc === 'object' ? rawDoc : {}) as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.scenes) && obj.scenes.length > 0 ? obj.scenes : null;

  const scenes: YBScene[] = (rawScenes ?? fallback.scenesText.map((t) => ({ voiceover: { text: t } }))).map(
    (rawScene, idx) => {
      const s = (rawScene && typeof rawScene === 'object' ? rawScene : {}) as Record<string, unknown>;
      const vo = (s.voiceover && typeof s.voiceover === 'object' ? s.voiceover : {}) as Record<string, unknown>;
      const voiceText =
        typeof vo.text === 'string' && vo.text.trim().length > 0
          ? vo.text.trim()
          : fallback.scenesText[idx % fallback.scenesText.length] ?? fallback.title;

      const rawDur = Number(s.durationSeconds);
      const durationSeconds = Number.isFinite(rawDur) && rawDur >= 2 && rawDur <= 60 ? Number(rawDur.toFixed(1)) : 8;

      const backgroundLayer = normalizeSceneLayer(s.backgroundLayer, fallback.videoTrack, fallback.title, idx);
      const templateId =
        fallback.videoTrack === 'AI_STORYTELLING'
          ? 'ai-visual-storytelling'
          : backgroundLayer.kind === 'threejs' || backgroundLayer.kind === 'chart'
            ? 'data-threejs-explainer'
            : 'kinetic-typography';

      return {
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `scene_${String(idx + 1).padStart(2, '0')}`,
        durationSeconds,
        templateId,
        backgroundLayer,
        voiceover: {
          text: voiceText,
          locale: fallback.locale,
        },
        captionsEnabled: true,
        wordCaptions: [],
      };
    },
  );

  return YBVideoDocumentSchema.parse({
    schemaVersion: '1.0',
    project: {
      title: fallback.title.slice(0, 120),
      locale: fallback.locale,
      videoTrack: fallback.videoTrack,
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      fps: 30,
    },
    scenes,
    render: {
      engine: 'hyperframes',
      format: 'mp4',
      safeZoneOverlay: true,
    },
  });
}

// ─── Helper: build an 11-scene VBVideoDocument structure for 60-90s videos ─────
function buildLongFormScenes(
  topic: string,
  tpl: { angle: string; title: string; hook: string; bodyScenes: string[]; recap: string; cta: string },
  idx: number,
  videoTrack: string,
): Array<Record<string, unknown>> {
  const isAI = videoTrack === 'AI_STORYTELLING';
  const ACCENTS = ['#38BDF8', '#E879F9', '#34D399', '#FBBF24', '#818CF8', '#F472B6', '#22D3EE', '#A3E635'];
  const THREEJS_PRESETS_CYCLE = ['orbital-particles', 'floating-cards', 'data-bars-3d'] as const;

  const scenes: Array<Record<string, unknown>> = [
    // Scene 1 — Hook (~4s)
    {
      id: 'scene_01_hook',
      durationSeconds: 4,
      backgroundLayer: isAI
        ? { kind: 'ai-image', prompt: `Dramatic vertical cinematic opening shot representing "${topic}", moody dark lighting, 9:16`, cameraMotion: 'ken-burns-in' }
        : { kind: 'typography', headline: tpl.hook.slice(0, 72), subheadline: tpl.angle, accentColor: ACCENTS[0] },
      voiceover: { text: tpl.hook },
    },
  ];

  // Scenes 2–9 — Body scenes (~8s each)
  tpl.bodyScenes.forEach((bodyText, bi) => {
    const sceneIdx = bi + 2;
    const accent = ACCENTS[sceneIdx % ACCENTS.length]!;
    let backgroundLayer: Record<string, unknown>;

    if (isAI) {
      const motions: Array<'ken-burns-in' | 'ken-burns-out' | 'pan-left' | 'pan-right'> = ['pan-right', 'pan-left', 'ken-burns-out', 'ken-burns-in'];
      backgroundLayer = {
        kind: 'ai-image',
        prompt: `Vertical 9:16 illustration for "${bodyText.slice(0, 60)}" about ${topic}, cinematic`,
        cameraMotion: motions[bi % motions.length],
      };
    } else {
      const pattern = (idx + bi) % 3;
      if (pattern === 0) {
        backgroundLayer = { kind: 'typography', headline: bodyText.slice(0, 72), accentColor: accent };
      } else if (pattern === 1) {
        backgroundLayer = {
          kind: 'threejs',
          preset: THREEJS_PRESETS_CYCLE[bi % 3],
          params: { density: 180 + bi * 20 },
        };
      } else {
        // chart with varied data
        const baseVal = 20 + (bi * 13) % 40;
        backgroundLayer = {
          kind: 'chart',
          chartType: 'bar',
          title: bodyText.slice(0, 48),
          series: [
            { label: isAI ? 'Before' : 'Sebelum', value: baseVal },
            { label: isAI ? 'After'  : 'Sesudah', value: baseVal + 30 + (bi * 7) % 40 },
            { label: isAI ? 'Target' : 'Target',  value: baseVal + 60 + (bi * 5) % 30 },
          ],
        };
      }
    }

    scenes.push({
      id: `scene_${String(sceneIdx).padStart(2, '0')}_body${bi + 1}`,
      durationSeconds: 8,
      backgroundLayer,
      voiceover: { text: bodyText },
    });
  });

  // Scene 10 — Recap (~6s)
  scenes.push({
    id: 'scene_10_recap',
    durationSeconds: 6,
    backgroundLayer: isAI
      ? { kind: 'ai-image', prompt: `Summary cinematic frame for "${topic}", dramatic vertical 9:16`, cameraMotion: 'ken-burns-out' }
      : { kind: 'typography', headline: tpl.recap.slice(0, 72), accentColor: '#38BDF8' },
    voiceover: { text: tpl.recap },
  });

  // Scene 11 — CTA (~5s)
  scenes.push({
    id: 'scene_11_cta',
    durationSeconds: 5,
    backgroundLayer: isAI
      ? { kind: 'ai-image', prompt: `Call to action motivational frame about "${topic}", inspiring vertical 9:16`, cameraMotion: 'ken-burns-in' }
      : { kind: 'typography', headline: tpl.cta.slice(0, 72), accentColor: '#34D399' },
    voiceover: { text: tpl.cta },
  });

  return scenes;
}

export function buildDeterministicVariations(
  input: ContentLabGenerationInput,
): Array<{ angle: string; hookText: string; title: string; scriptText: string; ybVideoDoc: YBVideoDocument }> {
  const isId = input.locale === 'id-ID';
  const topic = input.topicOrTitle.trim();
  const count = Math.max(3, Math.min(5, input.variationCount));

  // 11-scene templates → ~78s per video (4 + 8×8 + 6 + 5 = 79s)
  const templates = isId
    ? [
        {
          angle: ANGLE_PRESETS[0],
          title: `Mitos Salah Soal ${topic}`.slice(0, 115),
          hook: `Kebanyakan orang masih keliru memahami ${topic}, padahal mekanismenya justru terbalik.`,
          bodyScenes: [
            `Mitos pertama: banyak yang percaya ${topic} hanya soal permukaan. Faktanya justru sebaliknya.`,
            `Penelitian terkini membuktikan bahwa mekanisme utama ${topic} bekerja dari dalam keluar, bukan dari luar.`,
            `Jika dibandingkan antara pendekatan lama dan baru pada ${topic}, selisihnya bisa mencapai tiga kali lipat.`,
            `Faktor tersembunyi yang paling sering dilewat dalam ${topic} adalah konsistensi pada titik awal proses.`,
            `Data dari ribuan kasus ${topic} menunjukkan pola yang sama: perubahan kecil di awal memberi dampak besar.`,
            `Pendekatan berbasis bukti pada ${topic} jauh lebih efektif dari sekadar intuisi atau kebiasaan lama.`,
            `Langkah pertama untuk membalik paradigma ${topic} dimulai dari validasi asumsi dasarnya.`,
            `Begitu mitos ini terbongkar, cara pandang terhadap ${topic} berubah sepenuhnya dan hasilnya terasa nyata.`,
          ],
          recap: `Intinya: ${topic} bekerja kebalikan dari yang dikira. Validasi dulu asumsi dasarnya sebelum bertindak.`,
          cta: `Uji langsung sudut pandang baru ini pada kasus ${topic} berikutnya dan catat perbedaannya.`,
        },
        {
          angle: ANGLE_PRESETS[1],
          title: `Fakta Angka Di Balik ${topic}`.slice(0, 115),
          hook: `Satu angka penting tentang ${topic} ini jarang sekali dibahas secara terbuka.`,
          bodyScenes: [
            `Fakta pertama: hanya dua puluh persen usaha pada ${topic} menghasilkan delapan puluh persen hasilnya.`,
            `Angka rata-rata yang sering dikutip untuk ${topic} ternyata menyesatkan karena mengabaikan variabel kunci.`,
            `Ketika variabel utama ${topic} diisolasi, lonjakan performanya bisa dua hingga empat kali lipat.`,
            `Perbandingan data sebelum dan sesudah penerapan ${topic} yang terukur menunjukkan pola konsisten.`,
            `Studi kasus nyata membuktikan bahwa investasi tepat sasaran pada ${topic} memberikan ROI tertinggi.`,
            `Angka yang paling jarang disorot dalam ${topic}: tingkat kegagalan turun drastis saat fondasi diperkuat.`,
            `Metrik kunci yang perlu dipantau dalam ${topic} hanya tiga, bukan puluhan seperti yang sering dikira.`,
            `Visualisasi data ${topic} memperlihatkan bahwa titik pembalikan selalu muncul di fase kedua prosesnya.`,
          ],
          recap: `Intinya: ukur tiga metrik kunci ${topic} secara konsisten dan abaikan kebisingan data yang tidak relevan.`,
          cta: `Simpan perbandingan metrik ${topic} ini sebagai acuan cepat sebelum mengambil keputusan.`,
        },
        {
          angle: ANGLE_PRESETS[2],
          title: `Kisah Nyata Transformasi ${topic}`.slice(0, 115),
          hook: `Bayangkan detik pertama ketika sistem ${topic} berubah total hanya karena satu pemicu.`,
          bodyScenes: [
            `Situasi awal: semuanya tampak lambat dan penuh hambatan, termasuk dalam mengelola ${topic}.`,
            `Titik kritis muncul ketika satu variabel tersembunyi dalam ${topic} akhirnya teridentifikasi.`,
            `Begitu hambatan utama ${topic} dipetakan ulang, seluruh prosesnya bergeser secara signifikan.`,
            `Fase pertumbuhan dimulai perlahan, tapi begitu momentumnya terbentuk, hasilnya melesat cepat.`,
            `Setiap iterasi pada ${topic} mengungkapkan pelajaran baru yang semakin mempertajam pendekatannya.`,
            `Transformasi ${topic} yang nyata tidak terjadi dalam semalam, melainkan melalui langkah kecil yang konsisten.`,
            `Kunci keberlanjutan dalam ${topic} terletak pada sistem umpan balik yang pendek dan cepat.`,
            `Hari ini, hasilnya sudah terukur: perubahan pada ${topic} membawa dampak nyata yang bisa direplikasi.`,
          ],
          recap: `Transformasi ${topic} dimulai dari satu pemicu kecil yang tepat, bukan dari perubahan besar sekaligus.`,
          cta: `Mulai petakan titik balik ${topic} versi kamu hari ini agar progresnya terasa nyata.`,
        },
        {
          angle: ANGLE_PRESETS[3],
          title: `3 Jebakan Umum Saat Bahas ${topic}`.slice(0, 115),
          hook: `Stop mengulangi kesalahan paling mahal saat berurusan dengan ${topic} ini.`,
          bodyScenes: [
            `Jebakan pertama: terlalu fokus pada output ${topic} tanpa memperkuat prosesnya terlebih dulu.`,
            `Jebakan kedua: mengabaikan umpan balik awal dari ${topic} karena dianggap tidak signifikan.`,
            `Jebakan ketiga: mencoba mengoptimalkan semua variabel ${topic} sekaligus alih-alih bertahap.`,
            `Dampak nyata dari jebakan pertama: sumber daya habis sebelum ${topic} mencapai traksi awal.`,
            `Dampak jebakan kedua: masalah kecil pada ${topic} terakumulasi menjadi hambatan sistemik.`,
            `Cara menghindari jebakan ketiga: pilih satu variabel kritis ${topic} per sprint, ukur, baru lanjut.`,
            `Pola yang berhasil: kreator ${topic} terbaik selalu mulai dari fondasi sebelum bicara eskalasi.`,
            `Audit sederhana yang bisa kamu lakukan sekarang untuk menghindari ketiga jebakan ${topic} ini.`,
          ],
          recap: `Tiga jebakan utama ${topic}: terlalu fokus output, abaikan feedback awal, optimasi semua sekaligus.`,
          cta: `Periksa ulang checklist ${topic} ini supaya kamu terhindar dari jebakan yang sama.`,
        },
        {
          angle: ANGLE_PRESETS[4],
          title: `Cara Cepat Memahami ${topic} Dalam 3 Langkah`.slice(0, 115),
          hook: `Ini kerangka tiga langkah paling ringkas untuk menguasai inti ${topic}.`,
          bodyScenes: [
            `Langkah satu: tentukan satu sasaran spesifik dan terukur yang ingin dicapai dari ${topic}.`,
            `Langkah dua: identifikasi tiga indikator utama yang paling mencerminkan kemajuan ${topic}.`,
            `Langkah tiga: jalankan siklus evaluasi mingguan yang pendek dan konsisten pada ${topic}.`,
            `Kenapa tiga langkah ini berhasil? Karena masing-masing menghilangkan satu kebocoran umum pada ${topic}.`,
            `Langkah satu membantu menghindari dispersi energi yang sering menjebak pelaku ${topic} pemula.`,
            `Langkah dua memastikan kamu tidak terjebak mengukur hal yang tidak berdampak pada ${topic}.`,
            `Langkah tiga membuat penyesuaian tepat waktu sebelum masalah ${topic} berubah menjadi krisis.`,
            `Contoh nyata: satu tim yang menerapkan kerangka ini pada ${topic} meningkat performanya dalam empat minggu.`,
          ],
          recap: `Tiga langkah master ${topic}: sasaran spesifik, tiga indikator kunci, evaluasi mingguan yang konsisten.`,
          cta: `Praktikkan tiga langkah ${topic} tersebut mulai dari proyek pertamamu sekarang.`,
        },
      ]
    : [
        {
          angle: ANGLE_PRESETS[0],
          title: `The Hidden Myth Behind ${topic}`.slice(0, 115),
          hook: `Almost everyone gets ${topic} backward, and the real mechanism works the opposite way.`,
          bodyScenes: [
            `Myth one: most people assume ${topic} is about surface-level tweaks, but the real driver is upstream.`,
            `Recent research confirms that ${topic}'s core mechanism flows from the inside out, not the other way.`,
            `When you compare the old approach to ${topic} with evidence-based methods, the gap is often triple.`,
            `The most overlooked factor in ${topic} is consistency at the very beginning of the process, not the end.`,
            `Data from thousands of ${topic} cases shows the same pattern: tiny early shifts produce outsized gains.`,
            `An evidence-driven lens on ${topic} consistently outperforms intuition and legacy habits by a wide margin.`,
            `Step one to flipping the ${topic} paradigm: validate every base assumption before you act on anything.`,
            `Once that myth breaks, your entire perspective on ${topic} shifts and the results become immediately tangible.`,
          ],
          recap: `Key takeaway: ${topic} works opposite to popular belief. Validate the base assumption before you move.`,
          cta: `Challenge that old assumption on your next ${topic} experiment and watch the shift.`,
        },
        {
          angle: ANGLE_PRESETS[1],
          title: `The Surprising Numbers Of ${topic}`.slice(0, 115),
          hook: `One metric about ${topic} explains ninety percent of the difference you see.`,
          bodyScenes: [
            `Fact one: only twenty percent of effort inside ${topic} produces eighty percent of the outcome.`,
            `The average number most people cite for ${topic} is misleading because it ignores the core variable.`,
            `Isolate that one variable and performance on ${topic} can jump two to four times almost immediately.`,
            `Side-by-side benchmarks before and after structured ${topic} implementation reveal a consistent pattern.`,
            `Real case studies confirm: targeted investment in ${topic} delivers the highest measurable return.`,
            `The metric rarely highlighted in ${topic}: failure rate drops sharply once the foundation is locked in.`,
            `You only need to track three numbers for ${topic} — not dozens — to stay reliably on course.`,
            `Visualizing ${topic} data always shows the same inflection point appearing during the second phase.`,
          ],
          recap: `Bottom line: track three key ${topic} metrics consistently and ignore the noise around everything else.`,
          cta: `Bookmark this ${topic} benchmark breakdown so you can spot the signal faster.`,
        },
        {
          angle: ANGLE_PRESETS[2],
          title: `Inside The Turning Point Of ${topic}`.slice(0, 115),
          hook: `Picture the exact moment ${topic} flipped from friction into rapid momentum.`,
          bodyScenes: [
            `Starting point: everything felt sluggish and cluttered, including the approach to ${topic}.`,
            `The critical moment arrived when one hidden variable inside ${topic} was finally identified.`,
            `Once that core constraint on ${topic} was remapped, the entire system began shifting visibly.`,
            `The growth phase started slowly, but once momentum built, results compounded at every stage.`,
            `Each iteration on ${topic} surfaced a new insight that sharpened the approach even further.`,
            `Real transformation in ${topic} never happens overnight — it moves through consistent small steps.`,
            `The key to sustaining ${topic} gains lies in short, tight feedback loops that keep the process honest.`,
            `Today the results are measurable: the change in ${topic} produced an outcome that is fully replicable.`,
          ],
          recap: `${topic} transformation starts from one precise trigger, not from one sweeping overnight overhaul.`,
          cta: `Trace that same turning point inside your own ${topic} workflow today.`,
        },
        {
          angle: ANGLE_PRESETS[3],
          title: `Avoid This Costly ${topic} Mistake`.slice(0, 115),
          hook: `Stop making this expensive mistake whenever you approach ${topic}.`,
          bodyScenes: [
            `Mistake one: obsessing over ${topic} outputs before the underlying process is actually solid.`,
            `Mistake two: dismissing early ${topic} feedback signals as noise before they scale into real problems.`,
            `Mistake three: trying to optimize every ${topic} variable simultaneously instead of sequentially.`,
            `Real cost of mistake one: resources drain before ${topic} ever reaches initial traction.`,
            `Real cost of mistake two: small ${topic} defects accumulate silently into systemic blockers.`,
            `How to avoid mistake three: pick one critical ${topic} variable per sprint, measure it, then advance.`,
            `The pattern that works: top ${topic} practitioners always reinforce foundations before scaling anything.`,
            `A simple self-audit you can run right now to catch all three ${topic} mistakes before they compound.`,
          ],
          recap: `The three ${topic} traps: output obsession, ignored early signals, and simultaneous over-optimization.`,
          cta: `Audit your setup against this warning before you ship your next piece.`,
        },
        {
          angle: ANGLE_PRESETS[4],
          title: `Master ${topic} In Three Clear Steps`.slice(0, 115),
          hook: `Here is a crisp three-step blueprint to unlock ${topic} without guesswork.`,
          bodyScenes: [
            `Step one: define one specific, measurable outcome you want to achieve from ${topic}.`,
            `Step two: identify the three leading indicators that best reflect progress inside ${topic}.`,
            `Step three: run a short, consistent weekly review cycle focused exclusively on ${topic}.`,
            `Why this works: each step removes one common leak that slows most ${topic} practitioners down.`,
            `Step one prevents the energy dispersion that consistently traps ${topic} beginners early on.`,
            `Step two stops you from measuring things that have no real bearing on ${topic} outcomes.`,
            `Step three enables timely course corrections before ${topic} issues escalate into full crises.`,
            `Real example: one team using this blueprint improved their ${topic} performance within four weeks.`,
          ],
          recap: `Three-step ${topic} master plan: specific goal, three leading indicators, weekly review. That is it.`,
          cta: `Run step one on ${topic} right now and build momentum from day one.`,
        },
      ];

  return templates.slice(0, count).map((tpl, idx) => {
    const allBodyText = tpl.bodyScenes.join(' ');
    const scriptText = `${tpl.hook} ${allBodyText} ${tpl.recap} ${tpl.cta}`;
    const rawScenes = buildLongFormScenes(topic, tpl, idx, input.videoTrack);
    const scenesText = [tpl.hook, ...tpl.bodyScenes, tpl.recap, tpl.cta];

    const ybVideoDoc = normalizeToValidYBVideoDocument(
      { scenes: rawScenes },
      {
        title: tpl.title,
        locale: input.locale,
        videoTrack: input.videoTrack,
        scenesText,
      },
    );

    return {
      angle: tpl.angle,
      hookText: tpl.hook,
      title: tpl.title,
      scriptText,
      ybVideoDoc,
    };
  });
}

export async function generateContentVariations(
  input: ContentLabGenerationInput,
  providerKeys: Record<string, string | undefined>,
): Promise<ContentLabGenerationOutput> {
  const count = Math.max(3, Math.min(5, input.variationCount));
  const warnings: string[] = [];
  const referenceCombined = [input.referenceSummary, input.referenceTranscript].filter(Boolean).join('\n').trim();

  const languageDirective =
    input.locale === 'id-ID'
      ? 'WAJIB menulis seluruh title, hookText, scriptText, dan voiceover.text dalam Bahasa Indonesia yang alami, tajam, ritmis, dan cocok untuk YouTube Shorts Indonesia. Jangan meniru kalimat referensi kata demi kata.'
      : 'Write all title, hookText, scriptText, and voiceover.text in crisp, natural US/global English suited for YouTube Shorts. Never copy source lines verbatim.';

  const trackDirective =
    input.videoTrack === 'AI_STORYTELLING'
      ? 'Each scene must use templateId "ai-visual-storytelling" and backgroundLayer kind "ai-image" with a vivid English visual prompt (9:16 vertical photography/illustration) and cameraMotion ("ken-burns-in" | "ken-burns-out" | "pan-left" | "pan-right").'
      : 'Scenes must use code-driven templates ("kinetic-typography" or "data-threejs-explainer") with backgroundLayer kind "typography", "threejs" (preset "orbital-particles" | "floating-cards" | "data-bars-3d"), or "chart".';

  const systemPrompt = [
    'You are Youbellkey Video Director & Originality Scriptwriter for 9:16 vertical YouTube Shorts (1080x1920, 30fps).',
    languageDirective,
    trackDirective,
    `Generate exactly ${count} DISTINCT variations. Each variation MUST have 10-11 scenes: scene_01_hook (3-4s hook), scene_02 through scene_09 (body scenes 7-10s each — rich layered explanations with examples and comparisons; for MOTION_EXPLAINER alternate between typography/threejs/chart layers), scene_10_recap (5-6s summary), scene_11_cta (4-5s call-to-action). Total video duration MUST be 60-100 seconds. Each variation must use a completely distinct opening hook angle.`,
    'Respond ONLY with a valid JSON object of this exact shape (no markdown, no extra keys):',
    '{"variations":[{"angle":"myth-busting","title":"...","hookText":"...","scenes":[{"id":"scene_01_hook","durationSeconds":4,"backgroundLayer":{"kind":"typography","headline":"...","accentColor":"#38BDF8"},"voiceover":{"text":"..."}},{"id":"scene_02_body1","durationSeconds":8,"backgroundLayer":{"kind":"threejs","preset":"orbital-particles","params":{}},"voiceover":{"text":"..."}},{"id":"scene_11_cta","durationSeconds":5,"backgroundLayer":{"kind":"typography","headline":"...","accentColor":"#34D399"},"voiceover":{"text":"..."}}]}]}',
  ].join('\n');

  const userPrompt = [
    `Topic / Reference Title: ${input.topicOrTitle}`,
    input.referenceSummary ? `Reference Metadata / Notes: ${input.referenceSummary.slice(0, 1200)}` : '',
    input.referenceTranscript
      ? `Reference Transcript (extract insight ONLY, rewrite from fresh original angle): ${input.referenceTranscript.slice(0, 3500)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  let rawVariations: Array<{ angle: string; hookText: string; title: string; scriptText: string; ybVideoDoc: YBVideoDocument }> = [];
  let usage: UsageCostEntry | null = null;
  let usedFallbackTemplate = false;

  const hasAnyKey = Boolean(
    providerKeys['gemini-free'] || providerKeys['groq-free'] || providerKeys['openrouter-free'],
  );

  if (hasAnyKey) {
    try {
      const { response, errors } = await generateTextWithRouting(
        {
          task: 'script_draft',
          locale: input.locale,
          systemPrompt,
          userPrompt,
          maxTokens: 8192,
          jsonMode: true,
        },
        providerKeys,
      );
      usage = response.usage;
      warnings.push(...errors);

      const parsedJson = extractJsonFromText(response.text) as { variations?: unknown[] };
      const list = Array.isArray(parsedJson?.variations) ? parsedJson.variations : [];

      rawVariations = list.slice(0, count).map((item, idx) => {
        const v = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const angle = typeof v.angle === 'string' && v.angle.trim() ? v.angle.trim() : ANGLE_PRESETS[idx % ANGLE_PRESETS.length]!;
        const title = typeof v.title === 'string' && v.title.trim() ? v.title.trim() : `${input.topicOrTitle} (${angle})`;
        const hookText = typeof v.hookText === 'string' && v.hookText.trim() ? v.hookText.trim() : title;

        const ybVideoDoc = normalizeToValidYBVideoDocument(
          { scenes: v.scenes },
          {
            title,
            locale: input.locale,
            videoTrack: input.videoTrack,
            scenesText: [hookText, title],
          },
        );
        const scriptText = ybVideoDoc.scenes.map((s) => s.voiceover.text).join(' ');

        return { angle, hookText, title, scriptText, ybVideoDoc };
      });
    } catch (err) {
      warnings.push(`Fallback ke generator terstruktur karena LLM gagal: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    warnings.push('Belum ada API key Gemini/Groq/OpenRouter terdeteksi — memakai generator storyboard terstruktur lokal.');
  }

  if (rawVariations.length < 3) {
    usedFallbackTemplate = true;
    rawVariations = buildDeterministicVariations(input);
  }

  const originalityReports = evaluateBatchOriginality(
    referenceCombined,
    rawVariations.map((v) => ({ angle: v.angle, scriptText: v.scriptText })),
  );

  const variations: GeneratedContentVariation[] = rawVariations.map((item, idx) => ({
    ...item,
    originality: originalityReports[idx] ?? {
      index: idx,
      angle: item.angle,
      referenceOverlap: 0,
      maxPeerOverlap: 0,
      originalityScore: 1,
      verdict: 'PASS',
      reasons: [],
    },
  }));

  return {
    variations,
    usage,
    usedFallbackTemplate,
    warnings,
  };
}
