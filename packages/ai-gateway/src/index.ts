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
  { task: 'tts_voiceover', preferredProviders: ['google-cloud-tts', 'azure-speech-f0', 'edge-tts-personal'] },
  { task: 'whisper_alignment', preferredProviders: ['groq-whisper-free'] },
];

export const geminiFreeAdapter: AIProviderAdapter = {
  providerId: 'gemini-free',
  async generateText(req, apiKey) {
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
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
          signal: AbortSignal.timeout(10_000),
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
    const presets = ['orbital-particles', 'floating-cards', 'data-bars-3d'] as const;
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

      const templateId =
        fallback.videoTrack === 'AI_STORYTELLING'
          ? 'ai-visual-storytelling'
          : idx === 1
            ? 'data-threejs-explainer'
            : 'kinetic-typography';

      return {
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `scene_${String(idx + 1).padStart(2, '0')}`,
        durationSeconds,
        templateId,
        backgroundLayer: normalizeSceneLayer(s.backgroundLayer, fallback.videoTrack, fallback.title, idx),
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

export function buildDeterministicVariations(
  input: ContentLabGenerationInput,
): Array<{ angle: string; hookText: string; title: string; scriptText: string; ybVideoDoc: YBVideoDocument }> {
  const isId = input.locale === 'id-ID';
  const topic = input.topicOrTitle.trim();
  const count = Math.max(3, Math.min(5, input.variationCount));

  const templates = isId
    ? [
        {
          angle: ANGLE_PRESETS[0],
          title: `Mitos Salah Soal ${topic}`.slice(0, 115),
          hook: `Kebanyakan orang masih keliru memahami ${topic}, padahal mekanismenya justru terbalik.`,
          body: `Jika dilihat lebih dekat, ${topic} tidak bekerja seperti asumsi populer. Faktor penentunya justru ada pada perubahan pola kecil yang sering terlewat sejak awal.`,
          cta: `Uji langsung sudut pandang baru ini pada kasus ${topic} berikutnya dan catat perbedaannya.`,
        },
        {
          angle: ANGLE_PRESETS[1],
          title: `Fakta Angka Di Balik ${topic}`.slice(0, 115),
          hook: `Satu angka penting tentang ${topic} ini jarang sekali dibahas secara terbuka.`,
          body: `Ketika kita membandingkan dua skenario pada ${topic}, lonjakan terbesar muncul saat variabel utamanya diisolasi dengan ukuran yang terukur dan konsisten.`,
          cta: `Simpan perbandingan metrik ${topic} ini sebagai acuan cepat sebelum mengambil keputusan.`,
        },
        {
          angle: ANGLE_PRESETS[2],
          title: `Kisah Nyata Transformasi ${topic}`.slice(0, 115),
          hook: `Bayangkan detik pertama ketika sistem ${topic} berubah total hanya karena satu pemicu.`,
          body: `Awalnya proses ${topic} terlihat lambat dan rumit, namun begitu hambatan utamanya dipetakan ulang, hasilnya langsung melesat dalam waktu singkat.`,
          cta: `Mulai petakan titik balik ${topic} versi kamu hari ini agar progresnya terasa nyata.`,
        },
        {
          angle: ANGLE_PRESETS[3],
          title: `3 Jebakan Umum Saat Bahas ${topic}`.slice(0, 115),
          hook: `Stop mengulangi kesalahan paling mahal saat berurusan dengan ${topic} ini.`,
          body: `Banyak kreator terpaku pada detail permukaan dari ${topic}, padahal tanpa validasi akar masalahnya sejak awal, tenaga hanya habis tanpa dampak.`,
          cta: `Periksa ulang checklist ${topic} ini supaya kamu terhindar dari jebakan yang sama.`,
        },
        {
          angle: ANGLE_PRESETS[4],
          title: `Cara Cepat Memahami ${topic} Dalam 3 Langkah`.slice(0, 115),
          hook: `Ini kerangka tiga langkah paling ringkas untuk menguasai inti ${topic}.`,
          body: `Langkah pertama tentukan sasaran, langkah kedua ukur indikator utama ${topic}, dan langkah ketiga evaluasi hasilnya dalam siklus pendek yang rutin.`,
          cta: `Praktikkan tiga langkah ${topic} tersebut mulai dari proyek pertamamu sekarang.`,
        },
      ]
    : [
        {
          angle: ANGLE_PRESETS[0],
          title: `The Hidden Myth Behind ${topic}`.slice(0, 115),
          hook: `Almost everyone gets ${topic} backward, and the real mechanism works the opposite way.`,
          body: `Once you inspect how ${topic} actually behaves under pressure, small upstream adjustments drive far larger outcomes than surface tweaks.`,
          cta: `Challenge that old assumption on your next ${topic} experiment and watch the shift.`,
        },
        {
          angle: ANGLE_PRESETS[1],
          title: `The Surprising Numbers Of ${topic}`.slice(0, 115),
          hook: `One metric about ${topic} explains ninety percent of the difference you see.`,
          body: `Comparing side-by-side benchmarks around ${topic} reveals a sharp inflection point as soon as the core bottleneck is measured properly.`,
          cta: `Bookmark this ${topic} benchmark breakdown so you can spot the signal faster.`,
        },
        {
          angle: ANGLE_PRESETS[2],
          title: `Inside The Turning Point Of ${topic}`.slice(0, 115),
          hook: `Picture the exact moment ${topic} flipped from friction into rapid momentum.`,
          body: `At first ${topic} looked stagnant from the outside, yet removing a single hidden constraint unlocked compounding gains across every stage.`,
          cta: `Trace that same turning point inside your own ${topic} workflow today.`,
        },
        {
          angle: ANGLE_PRESETS[3],
          title: `Avoid This Costly ${topic} Mistake`.slice(0, 115),
          hook: `Stop making this expensive mistake whenever you approach ${topic}.`,
          body: `Chasing flashy shortcuts inside ${topic} hides the structural flaw underneath, wasting effort before real traction ever begins.`,
          cta: `Audit your setup against this warning before you ship your next piece.`,
        },
        {
          angle: ANGLE_PRESETS[4],
          title: `Master ${topic} In Three Clear Steps`.slice(0, 115),
          hook: `Here is a crisp three-step blueprint to unlock ${topic} without guesswork.`,
          body: `First define the baseline, second isolate the highest-leverage variable in ${topic}, and third review results in tight weekly feedback loops.`,
          cta: `Run step one on ${topic} right now and build momentum from day one.`,
        },
      ];

  return templates.slice(0, count).map((tpl, idx) => {
    const scriptText = `${tpl.hook} ${tpl.body} ${tpl.cta}`;
    const ybVideoDoc = normalizeToValidYBVideoDocument(
      {
        scenes: [
          {
            id: 'scene_01_hook',
            durationSeconds: 3.5,
            backgroundLayer:
              input.videoTrack === 'AI_STORYTELLING'
                ? { kind: 'ai-image', prompt: `Striking vertical opening shot representing ${topic}, moody cinematic lighting`, cameraMotion: 'ken-burns-in' }
                : { kind: 'typography', headline: tpl.hook.slice(0, 64), subheadline: tpl.angle, accentColor: '#38BDF8' },
            voiceover: { text: tpl.hook },
          },
          {
            id: 'scene_02_core',
            durationSeconds: 14,
            backgroundLayer:
              input.videoTrack === 'AI_STORYTELLING'
                ? { kind: 'ai-image', prompt: `Detailed visual metaphor explaining ${topic}, documentary vertical style`, cameraMotion: 'pan-right' }
                : idx % 2 === 0
                  ? { kind: 'threejs', preset: 'orbital-particles', params: { density: 200 } }
                  : {
                      kind: 'chart',
                      chartType: 'bar',
                      title: tpl.title.slice(0, 48),
                      series: [
                        { label: 'Baseline', value: 28 },
                        { label: 'Focused', value: 84 },
                      ],
                    },
            voiceover: { text: tpl.body },
          },
          {
            id: 'scene_03_cta',
            durationSeconds: 5.5,
            backgroundLayer:
              input.videoTrack === 'AI_STORYTELLING'
                ? { kind: 'ai-image', prompt: `Inspiring final frame illustrating resolution of ${topic}`, cameraMotion: 'ken-burns-out' }
                : { kind: 'typography', headline: tpl.cta.slice(0, 64), accentColor: '#34D399' },
            voiceover: { text: tpl.cta },
          },
        ],
      },
      {
        title: tpl.title,
        locale: input.locale,
        videoTrack: input.videoTrack,
        scenesText: [tpl.hook, tpl.body, tpl.cta],
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
    'You are Youbellkey Video Director & Originality Scriptwriter for 9:16 vertical Shorts (1080x1920, 30fps).',
    languageDirective,
    trackDirective,
    `Generate exactly ${count} DISTINCT variations using different storytelling angles (e.g., ${ANGLE_PRESETS.slice(0, count).join(', ')}). Each variation MUST use a distinct opening hook in the first 2.5 seconds (scene 1 duration 2.5-4s) and distinct structure/examples so variations do not sound repetitive.`,
    'Respond ONLY with a JSON object of shape:',
    '{"variations":[{"angle":"...","title":"...","hookText":"...","scenes":[{"id":"scene_01","durationSeconds":3,"backgroundLayer":{...},"voiceover":{"text":"..."}}]}]}',
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
          maxTokens: 4096,
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
