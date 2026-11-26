import { z } from 'zod';

export const WordCaptionSchema = z.object({
  word: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
}).refine((w) => w.endSeconds >= w.startSeconds, {
  message: 'endSeconds must be >= startSeconds',
});
export type WordCaption = z.infer<typeof WordCaptionSchema>;

export const SceneLayerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('threejs'),
    preset: z.enum(['orbital-particles', 'floating-cards', 'data-bars-3d']),
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
