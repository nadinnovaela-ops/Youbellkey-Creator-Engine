import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  alignWordCaptionsWithGroqWhisper,
  generateSceneVisualAsset,
  synthesizeVoiceover,
} from '@youbellkey/ai-gateway/tts';
import {
  concatAudioSegmentsToMp3,
  postProcessShortsMp4,
  probeMediaFile,
  type MediaProbeResult,
} from '@youbellkey/engine-ffmpeg';
import {
  compileYBVideoDocumentToHyperFrames,
  lintHyperFramesProject,
  renderHyperFramesProject,
  type SceneAssetBinding,
} from '@youbellkey/engine-hyperframes';
import { evaluateAutopilotGuardrails, type AutopilotGuardrailResult } from '@youbellkey/publishing-adapters';
import {
  YBVideoDocumentSchema,
  computeTotalDurationSeconds,
  type YBScene,
  type YBVideoDocument,
} from '@youbellkey/video-schema';
import { getTemplateSpec } from '@youbellkey/video-templates';

export interface RenderPlanSummary {
  title: string;
  locale: string;
  sceneCount: number;
  totalDurationSeconds: number;
  templatesUsed: string[];
}

export interface RenderPipelineOptions {
  document: unknown;
  outputPath: string;
  quality?: 'draft' | 'looks' | 'delivery';
  repoRootDir?: string;
  providerKeys?: {
    geminiApiKey?: string;
    groqApiKey?: string;
    googleCloudTtsApiKey?: string;
  };
  onProgress?: (progress: number, message: string) => Promise<void>;
}

export interface RenderPipelineResult {
  outputPath: string;
  updatedDocument: YBVideoDocument;
  mediaProbe: MediaProbeResult;
  qualityGate: AutopilotGuardrailResult;
  ttsProviders: string[];
  whisperAlignedScenes: number;
  warnings: string[];
}

/**
 * Validates a YB Video Document against schema and V1 template registry
 * before invoking HyperFrames in Phase 3.
 */
export function validateAndSummarizeRenderPlan(rawDocument: unknown): RenderPlanSummary {
  const doc: YBVideoDocument = YBVideoDocumentSchema.parse(rawDocument);
  const templatesUsed = [...new Set(doc.scenes.map((scene) => getTemplateSpec(scene.templateId).id))];

  return {
    title: doc.project.title,
    locale: doc.project.locale,
    sceneCount: doc.scenes.length,
    totalDurationSeconds: computeTotalDurationSeconds(doc),
    templatesUsed,
  };
}

/**
 * Executes full Phase 3 rendering pipeline inside an isolated temp directory:
 * 1. Validated YB Video Document v1.0
 * 2. Per-scene Voiceover TTS + Groq Whisper word-level alignment
 * 3. Jalur B scene visual asset generation (when ai-image layer present)
 * 4. HyperFrames self-contained HTML composition compile + lint + render
 * 5. FFmpeg -14 LUFS loudness normalization & ffprobe quality verification
 */
export async function executeRenderPipeline(
  options: RenderPipelineOptions,
): Promise<RenderPipelineResult> {
  const doc = YBVideoDocumentSchema.parse(options.document);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yb-render-'));
  const audioDir = path.join(workDir, 'audio');
  const assetsDir = path.join(workDir, 'assets');

  const warnings: string[] = [];
  const ttsProviders = new Set<string>();
  let whisperAlignedScenes = 0;

  try {
    await fs.mkdir(audioDir, { recursive: true });
    await fs.mkdir(assetsDir, { recursive: true });

    const segmentWavPaths: string[] = [];
    const sceneAssets: SceneAssetBinding[] = [];
    const updatedScenes: YBScene[] = [];
    let currentOffset = 0;

    for (let i = 0; i < doc.scenes.length; i++) {
      const scene = doc.scenes[i]!;
      // Progress per-scene: TTS (10-45%), progress dipancarkan SEBELUM dan SESUDAH
      // setiap scene agar heartbeat interval 15s selalu mendapat update terbaru
      // bahkan saat Gemini image generation (yang bisa >30 detik per scene) sedang berlangsung.
      const sceneProgressPct = 10 + Math.round((i / doc.scenes.length) * 35);
      await options.onProgress?.(
        sceneProgressPct,
        `Menyiapkan audio & caption scene ${i + 1}/${doc.scenes.length}`,
      );

      // 1. Voiceover TTS synthesis
      const tts = await synthesizeVoiceover({
        text: scene.voiceover.text,
        locale: scene.voiceover.locale,
        voiceId: scene.voiceover.voiceId,
        providerKeys: {
          geminiApiKey: options.providerKeys?.geminiApiKey,
          googleCloudTtsApiKey: options.providerKeys?.googleCloudTtsApiKey,
        },
      });
      ttsProviders.add(tts.provider);
      warnings.push(...tts.warnings);

      const segWavPath = path.join(audioDir, `scene_${String(i).padStart(2, '0')}.wav`);
      await fs.writeFile(segWavPath, tts.wavBuffer);
      segmentWavPaths.push(segWavPath);

      const audioProbe = await probeMediaFile(segWavPath);
      const sceneDuration = Number(Math.max(2.5, audioProbe.durationSeconds + 0.3).toFixed(2));

      // 2. Groq Whisper word-level alignment (using scene offset so captions match concatenated timeline)
      const alignment = await alignWordCaptionsWithGroqWhisper({
        audioBuffer: tts.wavBuffer,
        filename: `scene_${i}.wav`,
        mimeType: 'audio/wav',
        locale: scene.voiceover.locale,
        fallbackText: scene.voiceover.text,
        fallbackDurationSeconds: sceneDuration,
        offsetSeconds: currentOffset,
        groqApiKey: options.providerKeys?.groqApiKey,
      });
      if (alignment.usedWhisper) whisperAlignedScenes++;
      if (alignment.warning) warnings.push(alignment.warning);

      // 3. Jalur B Visual asset generation if ai-image layer
      if (scene.backgroundLayer.kind === 'ai-image') {
        // Kirim progress mid-scene sebelum Gemini image call yang bisa lama (>30 detik)
        // Ini memastikan heartbeat mendapat lastProgress terbaru untuk memperpanjang lease
        await options.onProgress?.(
          sceneProgressPct,
          `Generating visual AI scene ${i + 1}/${doc.scenes.length}`,
        );
        const asset = await generateSceneVisualAsset({
          prompt: scene.backgroundLayer.prompt,
          sceneIndex: i,
          geminiApiKey: options.providerKeys?.geminiApiKey,
        });
        const assetFilename = `scene_${String(i).padStart(2, '0')}.${asset.extension}`;
        await fs.writeFile(path.join(assetsDir, assetFilename), asset.buffer);
        sceneAssets.push({
          sceneIndex: i,
          imageRelPath: `./assets/${assetFilename}`,
        });
      }

      updatedScenes.push({
        ...scene,
        durationSeconds: sceneDuration,
        wordCaptions: alignment.wordCaptions,
      });
      currentOffset += sceneDuration;
      // Kirim progress SETELAH scene selesai agar heartbeat punya data terbaru
      await options.onProgress?.(
        10 + Math.round(((i + 1) / doc.scenes.length) * 35),
        `Scene ${i + 1}/${doc.scenes.length} selesai`,
      );
    }

    await options.onProgress?.(50, 'Menggabungkan track voiceover & menyusun komposisi HyperFrames');
    const combinedMp3Path = path.join(audioDir, 'voiceover.mp3');
    const sceneDurationsSeconds = updatedScenes.map((s) => s.durationSeconds);
    const sfxCues: Array<{ timestampSeconds: number; kind: 'whoosh' | 'pop' | 'riser' }> = [];
    let sfxCursor = 0;
    for (let idx = 0; idx < updatedScenes.length; idx++) {
      if (idx > 0) {
        sfxCues.push({ timestampSeconds: Number(sfxCursor.toFixed(2)), kind: idx % 3 === 0 ? 'riser' : 'whoosh' });
      }
      sfxCursor += updatedScenes[idx]!.durationSeconds;
    }
    await concatAudioSegmentsToMp3(segmentWavPaths, combinedMp3Path, {
      sceneDurationsSeconds,
      sfxCues,
    });

    const updatedDocument: YBVideoDocument = YBVideoDocumentSchema.parse({
      ...doc,
      scenes: updatedScenes,
    });

    await compileYBVideoDocumentToHyperFrames({
      document: updatedDocument,
      workDir,
      voiceoverRelPath: './audio/voiceover.mp3',
      sceneAssets,
      repoRootDir: options.repoRootDir,
    });

    const lint = await lintHyperFramesProject(workDir, options.repoRootDir);
    if (!lint.passed) {
      const firstErr = lint.findings.find((f) => f.severity === 'error')?.message ?? lint.rawOutput;
      throw new Error(`HyperFrames lint failed: ${firstErr}`);
    }

    await options.onProgress?.(65, 'Merender frame video 1080x1920 via HyperFrames');
    const rawMp4Path = path.join(workDir, 'raw_render.mp4');
    const expectedTotalDuration = computeTotalDurationSeconds(updatedDocument);
    let lastPctReported = 65;
    let lastReportTimeMs = 0;

    await renderHyperFramesProject({
      workDir,
      outputMp4Path: rawMp4Path,
      fps: updatedDocument.project.fps,
      quality: options.quality ?? 'looks',
      expectedDurationSeconds: expectedTotalDuration,
      repoRootDir: options.repoRootDir,
      onFrameProgress: (done, total) => {
        const pct = Math.min(87, 65 + Math.round((done / Math.max(1, total)) * 22));
        const now = Date.now();
        if (pct >= lastPctReported + 2 || now - lastReportTimeMs >= 4000 || done >= total) {
          lastPctReported = pct;
          lastReportTimeMs = now;
          void options.onProgress
            ?.(pct, `Render frame ${done}/${total} (1080x1920)`)
            .catch(() => undefined);
        }
      },
    });

    await options.onProgress?.(88, 'Normalisasi audio -14 LUFS & validasi akhir FFmpeg');
    const finalTempMp4Path = path.join(workDir, 'final_shorts.mp4');
    const mediaProbe = await postProcessShortsMp4(rawMp4Path, finalTempMp4Path);

    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.copyFile(finalTempMp4Path, options.outputPath);

    const totalCaptions = updatedDocument.scenes.reduce((acc, s) => acc + s.wordCaptions.length, 0);
    const qualityGate = evaluateAutopilotGuardrails({
      workspaceKillSwitchActive: false,
      channelAutopilotEnabled: true,
      publishedTodayCount: 0,
      dailyPublishCap: 3,
      idempotencyKey: `render-verify-${Date.now()}`,
      alreadyPublishedWithKey: false,
      width: mediaProbe.width,
      height: mediaProbe.height,
      durationSeconds: mediaProbe.durationSeconds,
      hasAudioTrack: mediaProbe.hasAudioTrack,
      audioPeakDb: mediaProbe.audioPeakDb,
      captionsCount: totalCaptions,
    });

    await options.onProgress?.(100, 'Render video 1080x1920 selesai');

    return {
      outputPath: options.outputPath,
      updatedDocument,
      mediaProbe,
      qualityGate,
      ttsProviders: [...ttsProviders],
      whisperAlignedScenes,
      warnings: [...new Set(warnings)],
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
