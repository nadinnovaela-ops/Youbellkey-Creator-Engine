import { z } from 'zod';

export const WordCaptionSchema = z.object({
  word: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
}).refine((w) => w.endSeconds >= w.startSeconds, {
  message: 'endSeconds must be >= startSeconds',
});
export type WordCaption = z.infer<typeof WordCaptionSchema>;

export const ThreeJsPresetEnum = z.enum([
  'orbital-particles',
  'floating-cards',
  'data-bars-3d',
  'diorama-city-flood',
  'diorama-volume-cube',
  'diorama-cutaway-strata',
  'diorama-map-compare',
]);

export const VisualStyleSchema = z.enum([
  'diorama-maket',
  'editorial-clean',
  'midnight-tech',
  'bold-pop',
]);
export type VisualStyleId = z.infer<typeof VisualStyleSchema>;

export const CaptionStyleSchema = z.enum([
  'bold-stroke',
  'pill-box',
  'clean-editorial',
]);
export type CaptionStyleId = z.infer<typeof CaptionStyleSchema>;

export const CharacterProfileSchema = z.object({
  enabled: z.boolean().default(true),
  presetId: z.enum(['bima-explainer', 'aria-tech', 'nova-analyst', 'none']).default('bima-explainer'),
  name: z.string().min(1).max(40).default('Bima'),
  position: z.enum(['top-right', 'top-left', 'bottom-left']).default('top-right'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38BDF8'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FACC15'),
  hairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1E293B'),
  skinTone: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#F1C27D'),
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

export const SceneCalloutSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().max(40).optional(),
  sublabel: z.string().max(60).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type SceneCallout = z.infer<typeof SceneCalloutSchema>;

export const SceneLayerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('threejs'),
    preset: ThreeJsPresetEnum,
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  }),
  z.object({
    kind: z.literal('chart'),
    chartType: z.enum(['bar', 'line', 'counter']),
    title: z.string().min(1),
    series: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
  }),
  z.object({
    kind: z.literal('ai-image'),
    prompt: z.string().min(3),
    assetR2Key: z.string().optional(),
    cameraMotion: z.enum(['ken-burns-in', 'ken-burns-out', 'pan-left', 'pan-right']),
  }),
  z.object({
    kind: z.literal('clip'),
    sourceEngine: z.enum(['manim', 'motion-canvas', 'external']),
    assetR2Key: z.string().min(1),
  }),
  z.object({
    kind: z.literal('typography'),
    headline: z.string().min(1),
    subheadline: z.string().optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38BDF8'),
  }),
]);
export type SceneLayer = z.infer<typeof SceneLayerSchema>;

export const YBSceneSchema = z.object({
  id: z.string().min(1),
  durationSeconds: z.number().positive().max(180),
  templateId: z.enum([
    'kinetic-typography',
    'data-threejs-explainer',
    'ai-visual-storytelling',
  ]),
  backgroundLayer: SceneLayerSchema,
  callout: SceneCalloutSchema.optional(),
  badgeText: z.string().max(40).optional(),
  voiceover: z.object({
    text: z.string().min(1),
    locale: z.enum(['id-ID', 'en-US']),
    voiceId: z.string().optional(),
    audioR2Key: z.string().optional(),
  }),
  captionsEnabled: z.boolean().default(true),
  wordCaptions: z.array(WordCaptionSchema).default([]),
});
export type YBScene = z.infer<typeof YBSceneSchema>;

export const YBVideoDocumentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  project: z.object({
    title: z.string().min(1).max(120),
    locale: z.enum(['id-ID', 'en-US']),
    videoTrack: z.enum(['MOTION_EXPLAINER', 'AI_STORYTELLING']),
    aspectRatio: z.literal('9:16'),
    width: z.literal(1080),
    height: z.literal(1920),
    fps: z.union([z.literal(30), z.literal(60)]).default(30),
    visualStyle: VisualStyleSchema.optional(),
    captionStyle: CaptionStyleSchema.optional(),
    character: CharacterProfileSchema.optional(),
  }),
  scenes: z.array(YBSceneSchema).min(1),
  render: z.object({
    engine: z.literal('hyperframes'),
    format: z.literal('mp4'),
    safeZoneOverlay: z.boolean().default(true),
  }),
});
export type YBVideoDocument = z.infer<typeof YBVideoDocumentSchema>;

export function computeTotalDurationSeconds(doc: YBVideoDocument): number {
  return doc.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
}

/**
 * Exports a YBVideoDocument v1.0 into open MOTION.md markdown specification
 * (compatible with agentic OpenMotion / GiveMotion shot-list workflows).
 */
export function exportYBVideoDocumentToMotionMd(doc: YBVideoDocument): string {
  const totalSec = computeTotalDurationSeconds(doc);
  const style = doc.project.visualStyle ?? 'diorama-maket';
  const captionStyle = doc.project.captionStyle ?? 'bold-stroke';
  const character = doc.project.character?.enabled
    ? `${doc.project.character.name} (${doc.project.character.presetId})`
    : 'none';

  const lines: string[] = [
    `# ${doc.project.title} · MOTION.md`,
    '',
    '## Brand & Canvas',
    `- **Canvas:** ${doc.project.width} x ${doc.project.height} @ ${doc.project.fps} fps (${doc.project.aspectRatio})`,
    `- **Duration:** ${totalSec.toFixed(1)}s · Locale: ${doc.project.locale}`,
    `- **Visual Style:** \`${style}\` · **Caption Style:** \`${captionStyle}\``,
    `- **Consistent Host Character:** ${character}`,
    `- **Renderer:** ${doc.render.engine} (WebGL Three.js Diorama + GSAP + Whisper Captions)`,
    '',
    '## Shot List Timeline',
    '| # | Time | Scene ID | Layer / Visual | Callout / Takeaway | Narration |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  let cursor = 0;
  doc.scenes.forEach((sc, idx) => {
    const start = cursor.toFixed(1);
    cursor += sc.durationSeconds;
    const end = cursor.toFixed(1);
    const layer =
      sc.backgroundLayer.kind === 'threejs'
        ? `threejs:${sc.backgroundLayer.preset}`
        : sc.backgroundLayer.kind === 'chart'
          ? `chart:${sc.backgroundLayer.chartType}`
          : sc.backgroundLayer.kind === 'typography'
            ? `typo`
            : sc.backgroundLayer.kind;
    const callout = sc.callout
      ? `${sc.callout.label}${sc.callout.value ? ` (${sc.callout.value})` : ''}`
      : sc.badgeText ?? '-';
    const vo = sc.voiceover.text.replace(/\|/g, '/').slice(0, 96);
    lines.push(`| ${idx + 1} | ${start}–${end}s | \`${sc.id}\` | \`${layer}\` | ${callout} | ${vo} |`);
  });

  lines.push(
    '',
    '## Editable Choices',
    '- Swap visual look (`diorama-maket`, `editorial-clean`, `midnight-tech`, `bold-pop`).',
    '- Toggle or customize the consistent vector character host (`bima-explainer`, `aria-tech`, `nova-analyst`, `none`).',
    '- Update scene voiceover or callout badges cleanly via JSON or Studio Editor.',
  );

  return `${lines.join('\n')}\n`;
}
