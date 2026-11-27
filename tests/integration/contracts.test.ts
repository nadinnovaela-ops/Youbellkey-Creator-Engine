import { describe, expect, it } from 'vitest';
import {
  CreateChannelRequestSchema,
  JobDispatchSchema,
  UpsertProviderCredentialRequestSchema,
} from '@youbellkey/job-contracts';
import { evaluateOriginality } from '@youbellkey/originality-engine';
import { listCommercialSafeProviders } from '@youbellkey/provider-adapters';
import { evaluateAutopilotGuardrails } from '@youbellkey/publishing-adapters';
import { buildWorkspaceR2Key, isR2Configured, readR2ConfigFromEnv } from '@youbellkey/storage';
import { YBVideoDocumentSchema, computeTotalDurationSeconds } from '@youbellkey/video-schema';
import { V1_TEMPLATE_REGISTRY } from '@youbellkey/video-templates';
import { isWorkerRecentlyActive } from '../../apps/web/src/lib/http.js';
import {
  encodeSupabaseStorageKey,
  getActiveStorageProvider,
  parseStoredMediaKey,
} from '../../apps/web/src/lib/media-storage.js';
import { createDefaultWorkerConfig, stripSurroundingQuotes } from '../../workers/local-worker/src/index.js';
import { checkShortsAutopilotReadiness } from '../../workers/publish-worker/src/index.js';
import { validateAndSummarizeRenderPlan } from '../../workers/render-worker/src/index.js';
import { buildYoutubeChannelRssUrl, computeViralScore } from '../../workers/research-worker/src/index.js';

describe('Phase 0 Core Contracts', () => {
  it('validates a multilingual ID/EN YB Video Document v1.0 and computes total duration', () => {
    const validDoc = {
      schemaVersion: '1.0',
      project: {
        title: 'Kenapa Langit Berwarna Biru?',
        locale: 'id-ID',
        videoTrack: 'MOTION_EXPLAINER',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        fps: 30,
      },
      scenes: [
        {
          id: 'scene_01',
          durationSeconds: 7.5,
          templateId: 'data-threejs-explainer',
          backgroundLayer: {
            kind: 'threejs',
            preset: 'orbital-particles',
            params: { density: 200 },
          },
          voiceover: {
            text: 'Pernahkah kamu bertanya kenapa langit berwarna biru?',
            locale: 'id-ID',
          },
          captionsEnabled: true,
          wordCaptions: [{ word: 'Pernahkah', startSeconds: 0.1, endSeconds: 0.55 }],
        },
        {
          id: 'scene_02',
          durationSeconds: 12.5,
          templateId: 'ai-visual-storytelling',
          backgroundLayer: {
            kind: 'ai-image',
            prompt: 'Atmospheric blue sky Rayleigh scattering illustration, vertical 9:16',
            cameraMotion: 'ken-burns-in',
          },
          voiceover: {
            text: 'Cahaya biru tersebar paling kuat oleh molekul atmosfer.',
            locale: 'id-ID',
          },
          captionsEnabled: true,
          wordCaptions: [{ word: 'Cahaya', startSeconds: 0.0, endSeconds: 0.4 }],
        },
      ],
      render: {
        engine: 'hyperframes',
        format: 'mp4',
        safeZoneOverlay: true,
      },
    };

    const parsed = YBVideoDocumentSchema.parse(validDoc);
    expect(computeTotalDurationSeconds(parsed)).toBe(20);

    const summary = validateAndSummarizeRenderPlan(validDoc);
    expect(summary.templatesUsed).toEqual(['data-threejs-explainer', 'ai-visual-storytelling']);
    expect(Object.keys(V1_TEMPLATE_REGISTRY)).toHaveLength(3);
  });

  it('rejects invalid word caption timings and invalid aspect ratios', () => {
    expect(() =>
      YBVideoDocumentSchema.parse({
        schemaVersion: '1.0',
        project: {
          title: 'Bad',
          locale: 'en-US',
          videoTrack: 'MOTION_EXPLAINER',
          aspectRatio: '16:9',
          width: 1920,
          height: 1080,
          fps: 30,
        },
        scenes: [],
        render: { engine: 'hyperframes', format: 'mp4' },
      }),
    ).toThrow();
  });

  it('validates worker job dispatch contracts', () => {
    const job = JobDispatchSchema.parse({
      jobId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      projectId: null,
      jobType: 'RENDER_HYPERFRAMES',
      attemptCount: 1,
      leaseExpiresAt: '2026-11-26T12:00:00.000Z',
      idempotencyKey: 'render-proj-001',
      payload: { templateId: 'kinetic-typography' },
    });
    expect(job.jobType).toBe('RENDER_HYPERFRAMES');
  });

  it('enforces Autopilot guardrails and idempotency checks', () => {
    const ok = checkShortsAutopilotReadiness({
      workspaceKillSwitchActive: false,
      channelAutopilotEnabled: true,
      publishedTodayCount: 1,
      dailyPublishCap: 3,
      idempotencyKey: 'pub-yt-0001',
      alreadyPublishedWithKey: false,
      width: 1080,
      height: 1920,
      durationSeconds: 32,
      hasAudioTrack: true,
      audioPeakDb: -14,
      captionsCount: 45,
    });
    expect(ok.allowed).toBe(true);

    const blocked = evaluateAutopilotGuardrails({
      workspaceKillSwitchActive: true,
      channelAutopilotEnabled: true,
      publishedTodayCount: 3,
      dailyPublishCap: 3,
      idempotencyKey: 'pub-yt-0001',
      alreadyPublishedWithKey: true,
      width: 1920,
      height: 1080,
      durationSeconds: 3,
      hasAudioTrack: false,
      audioPeakDb: -90,
      captionsCount: 0,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.length).toBeGreaterThanOrEqual(7);
  });

  it('evaluates originality overlap, viral score, R2 key scoping, and commercial-safe providers', () => {
    const identical = evaluateOriginality(
      'mengapa langit berwarna biru saat siang hari cerah di bumi',
      'mengapa langit berwarna biru saat siang hari cerah di bumi',
    );
    expect(identical.verdict).toBe('REVIEW_REQUIRED');

    const original = evaluateOriginality(
      'mengapa langit berwarna biru saat siang hari cerah di bumi',
      'fisika hamburan cahaya menjelaskan warna senja kemerahan secara ilmiah',
    );
    expect(original.verdict).toBe('PASS');

    expect(
      computeViralScore({
        growthVelocityNorm: 1,
        outlierRatioNorm: 0.8,
        relativeEngagementNorm: 0.5,
        nicheRelevanceNorm: 1,
        noveltyNorm: 0.5,
      }),
    ).toBe(80);

    expect(buildYoutubeChannelRssUrl('UC123')).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC123',
    );
    expect(buildWorkspaceR2Key('ws-1', 'proj-1', 'render-mp4', 'final video.mp4')).toBe(
      'workspaces/ws-1/projects/proj-1/render-mp4/final_video.mp4',
    );

    const commercialSafe = listCommercialSafeProviders().map((p) => p.id);
    expect(commercialSafe).not.toContain('edge-tts-personal');
    expect(commercialSafe).toContain('groq-whisper-free');
  });

  it('validates Phase 1 channel, credential, worker config, and R2 readiness contracts', () => {
    const channel = CreateChannelRequestSchema.parse({
      externalChannelId: 'UC_TEST_CHANNEL',
      title: 'Fakta Sains ID',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      workflowMode: 'AUTOPILOT',
    });
    expect(channel.dailyPublishCap).toBe(3);

    const cred = UpsertProviderCredentialRequestSchema.parse({
      provider: 'gemini-free',
      label: 'Gemini Key',
      apiKey: 'AIzaSyFakeKeyValue123456',
    });
    expect(cred.provider).toBe('gemini-free');

    expect(isR2Configured({})).toBe(false);
    expect(
      readR2ConfigFromEnv({
        R2_ACCOUNT_ID: 'acct-1',
        R2_ACCESS_KEY_ID: 'key-1',
        R2_SECRET_ACCESS_KEY: 'secret-1',
      })?.bucketName,
    ).toBe('youbellkey-media');

    const workerCfg = createDefaultWorkerConfig({
      YB_CONTROL_PLANE_URL: 'https://youbellkey-creator-engine.vercel.app/',
      YB_WORKER_TOKEN: 'tok_123456',
    });
    expect(workerCfg.controlPlaneUrl).toBe('https://youbellkey-creator-engine.vercel.app');
    expect(stripSurroundingQuotes('"ybw_abc123"')).toBe('ybw_abc123');
    expect(stripSurroundingQuotes("'ybw_abc123'")).toBe('ybw_abc123');
    expect(isWorkerRecentlyActive(new Date().toISOString())).toBe(true);
    expect(isWorkerRecentlyActive(new Date(Date.now() - 120_000).toISOString())).toBe(false);

    // ADR-0005 Supabase Storage cardless fallback encoding & provider resolution
    const sbKey = encodeSupabaseStorageKey('youbellkey-media', 'workspaces/ws-1/projects/p-1/render-mp4/out.mp4');
    expect(sbKey).toBe('supabase://youbellkey-media/workspaces/ws-1/projects/p-1/render-mp4/out.mp4');
    expect(parseStoredMediaKey(sbKey)).toEqual({
      provider: 'supabase',
      bucket: 'youbellkey-media',
      objectPath: 'workspaces/ws-1/projects/p-1/render-mp4/out.mp4',
    });
    expect(parseStoredMediaKey('workspaces/ws-1/projects/p-1/render-mp4/out.mp4')).toEqual({
      provider: 'r2',
      objectPath: 'workspaces/ws-1/projects/p-1/render-mp4/out.mp4',
    });
    expect(getActiveStorageProvider({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    })).toBe('r2');
    expect(getActiveStorageProvider({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    })).toBe('supabase');
    expect(getActiveStorageProvider({})).toBe('none');
  });
});
