import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildFallbackToneWavBuffer,
  estimateWordCaptionsFromScript,
  pcmL16ToWavBuffer,
} from '@youbellkey/ai-gateway/tts';
import {
  compileYBVideoDocumentToHyperFrames,
  lintHyperFramesProject,
} from '@youbellkey/engine-hyperframes';
import {
  buildYoutubeShortsMetadata,
  validateMetaReelsPublishInput,
} from '@youbellkey/publishing-adapters';
import { WordCaptionSchema, YBVideoDocumentSchema } from '@youbellkey/video-schema';
import { publishYoutubeShortFromWorker } from '../../workers/publish-worker/src/index.js';

describe('Phase 3 Video Factory & Phase 4 Publishing Guardrails', () => {
  it('builds valid RIFF PCM WAV headers and proportional word caption timings', () => {
    const pcm = Buffer.alloc(4800);
    const wav = pcmL16ToWavBuffer(pcm, 24000, 1, 16);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(40)).toBe(4800);

    const tone = buildFallbackToneWavBuffer(3);
    expect(tone.length).toBeGreaterThan(44);

    const captions = estimateWordCaptionsFromScript('Fakta menarik tentang atmosfer bumi kita', 4.5, 2.0);
    expect(captions.length).toBe(6);
    expect(captions[0]?.startSeconds).toBeGreaterThanOrEqual(2.0);
    for (const c of captions) {
      expect(() => WordCaptionSchema.parse(c)).not.toThrow();
    }
  });

  it('compiles self-contained HyperFrames composition without CDN fetches and passes hyperframes lint', async () => {
    const doc = YBVideoDocumentSchema.parse({
      schemaVersion: '1.0',
      project: {
        title: 'Test XSS <script>alert(1)</script> Shorts',
        locale: 'id-ID',
        videoTrack: 'MOTION_EXPLAINER',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        fps: 30,
      },
      scenes: [
        {
          id: 's1',
          durationSeconds: 3.5,
          templateId: 'kinetic-typography',
          backgroundLayer: {
            kind: 'typography',
            headline: 'Kenapa Langit Biru?',
            accentColor: '#38BDF8',
          },
          voiceover: {
            text: 'Mari kita pelajari fenomena cahaya.',
            locale: 'id-ID',
          },
          captionsEnabled: true,
          wordCaptions: [
            { word: 'Mari', startSeconds: 0.1, endSeconds: 0.5 },
            { word: 'pelajari', startSeconds: 0.6, endSeconds: 1.2 },
          ],
        },
        {
          id: 's2',
          durationSeconds: 4.0,
          templateId: 'data-threejs-explainer',
          backgroundLayer: {
            kind: 'threejs',
            preset: 'orbital-particles',
            params: { density: 120 },
          },
          voiceover: {
            text: 'Partikel menyebarkan gelombang pendek.',
            locale: 'id-ID',
          },
          captionsEnabled: true,
          wordCaptions: [{ word: 'Partikel', startSeconds: 3.6, endSeconds: 4.3 }],
        },
      ],
      render: { engine: 'hyperframes', format: 'mp4', safeZoneOverlay: true },
    });

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yb-lint-test-'));
    try {
      const compiled = await compileYBVideoDocumentToHyperFrames({
        document: doc,
        workDir,
      });
      expect(compiled.totalDurationSeconds).toBe(7.5);

      const html = await fs.readFile(compiled.indexHtmlPath, 'utf8');
      expect(html).toContain('./vendor/gsap.min.js');
      expect(html).not.toContain('cdn.jsdelivr.net');
      expect(html).not.toContain('<script>alert(1)</script>');

      const lint = await lintHyperFramesProject(workDir);
      expect(lint.errorCount).toBe(0);
      expect(lint.passed).toBe(true);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }, 30_000);

  it('enforces YouTube Shorts metadata rules, idempotency/kill-switch gates, and Meta Reels HTTPS rule', async () => {
    const ytMeta = buildYoutubeShortsMetadata({
      title: 'Rahasia Cahaya Biru Atmosfer',
      description: 'Penjelasan ringkas fisika atmosfer.',
      tags: ['sains', 'fisika'],
      publishAtIso: '2026-12-01T10:00:00.000Z',
    });
    expect(ytMeta.snippet.title).toContain('#Shorts');
    expect(ytMeta.status.privacyStatus).toBe('private');
    expect(ytMeta.status.publishAt).toBe('2026-12-01T10:00:00.000Z');

    await expect(
      publishYoutubeShortFromWorker({
        accessToken: 'fake-token',
        videoBytes: new Uint8Array([1, 2, 3]),
        guardrailsInput: {
          workspaceKillSwitchActive: true,
          channelAutopilotEnabled: true,
          publishedTodayCount: 0,
          dailyPublishCap: 3,
          idempotencyKey: 'pub-test-1234',
          alreadyPublishedWithKey: false,
          width: 1080,
          height: 1920,
          durationSeconds: 15,
          hasAudioTrack: true,
          audioPeakDb: -12,
          captionsCount: 12,
        },
        metadata: { title: 'Test', description: 'Desc' },
      }),
    ).rejects.toThrow(/Autopilot publish blocked by guardrails/);

    expect(
      validateMetaReelsPublishInput({
        platform: 'instagram_reels',
        r2PresignedGetUrl: 'http://insecure.local/video.mp4',
        caption: 'Hello',
      }).valid,
    ).toBe(false);

    expect(
      validateMetaReelsPublishInput({
        platform: 'instagram_reels',
        r2PresignedGetUrl: 'https://r2.cloudflarestorage.com/signed.mp4',
        caption: 'Hello Shorts',
      }).valid,
    ).toBe(true);
  });
});
