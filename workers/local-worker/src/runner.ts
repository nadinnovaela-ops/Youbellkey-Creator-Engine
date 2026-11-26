import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { JobDispatch, WorkerCapability } from '@youbellkey/job-contracts';
import { publishYoutubeShortFromWorker } from '@youbellkey/publish-worker';
import { executeRenderPipeline } from '@youbellkey/render-worker';
import {
  extractReferenceTranscript,
  fetchYoutubeChannelRssFeed,
  fetchYoutubeVideoStatsBatch,
  scoreResearchEntries,
} from '@youbellkey/research-worker';

export interface WorkerRuntimeConfig {
  controlPlaneUrl: string;
  workerName: string;
  workerToken: string;
  capabilities: WorkerCapability[];
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
}

export function stripSurroundingQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadLocalEnvFile(cwd = process.cwd()): void {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const val = stripSurroundingQuotes(line.slice(eq + 1));
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
}

export function createDefaultWorkerConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  return {
    controlPlaneUrl: (env.YB_CONTROL_PLANE_URL ?? env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    workerName: env.YB_WORKER_ID ?? 'local-pc-01',
    workerToken: env.YB_WORKER_TOKEN ?? '',
    capabilities: ['render', 'research', 'publish'],
    pollIntervalMs: 5000,
    heartbeatIntervalMs: 30000,
  };
}

async function postWorkerJson<T>(
  config: WorkerRuntimeConfig,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${config.controlPlaneUrl}${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.workerToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err ? String((err as { cause?: unknown }).cause) : '';
    throw new Error(`Network error calling ${url}: ${err instanceof Error ? err.message : String(err)} ${cause}`.trim());
  }

  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`${endpoint} failed (${res.status}): ${json?.error?.message ?? res.statusText}`);
  }
  return json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeClaimedJob(
  config: WorkerRuntimeConfig,
  workerId: string,
  job: JobDispatch,
  sendProgress: (progress: number, message: string) => Promise<void>,
): Promise<Record<string, unknown>> {

  if (job.jobType === 'PHASE1_SMOKE') {
    await sendProgress(25, 'Worker claimed smoke job');
    await sleep(600);
    await sendProgress(65, 'Checking local worker environment');
    await sleep(600);
    await sendProgress(100, 'Smoke job completed');
    return {
      executedBy: config.workerName,
      platformArch: `${os.platform()}-${os.arch()}`,
      nodeVersion: process.version,
      note: job.payload.note ?? null,
    };
  }

  if (job.jobType === 'RESEARCH_SYNC') {
    const rawSources = Array.isArray(job.payload.sources) ? job.payload.sources : [];
    const sources = rawSources.filter(
      (s): s is { id: string; externalChannelId: string; niche?: string } =>
        Boolean(s && typeof s === 'object' && 'id' in s && 'externalChannelId' in s),
    );
    if (sources.length === 0) {
      throw new Error('Payload RESEARCH_SYNC tidak memiliki daftar research source.');
    }

    const discoveredItems: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    const ytApiKey = process.env.YOUTUBE_API_KEY?.trim();

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!;
      const progress = Math.round(((i + 0.5) / sources.length) * 90);
      await sendProgress(progress, `Polling RSS channel ${source.externalChannelId}`);

      try {
        const rssEntries = await fetchYoutubeChannelRssFeed(source.externalChannelId);
        let apiStats: Awaited<ReturnType<typeof fetchYoutubeVideoStatsBatch>> | undefined;
        if (ytApiKey && rssEntries.length > 0) {
          try {
            apiStats = await fetchYoutubeVideoStatsBatch(
              rssEntries.map((e) => e.videoId),
              ytApiKey,
            );
          } catch (apiErr) {
            errors.push(`YouTube API enrichment skipped: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`);
          }
        }

        const scored = scoreResearchEntries(rssEntries, {
          niche: source.niche,
          apiStats,
        });

        for (const item of scored.slice(0, 15)) {
          discoveredItems.push({
            sourceId: source.id,
            ...item,
          });
        }
      } catch (srcErr) {
        errors.push(`Channel ${source.externalChannelId}: ${srcErr instanceof Error ? srcErr.message : String(srcErr)}`);
      }
    }

    await sendProgress(100, `Synced ${sources.length} source(s), ${discoveredItems.length} item(s)`);
    return {
      syncedSourcesCount: sources.length,
      discoveredItems,
      warnings: errors,
    };
  }

  if (job.jobType === 'REFERENCE_TRANSCRIPT') {
    const researchItemId = typeof job.payload.researchItemId === 'string' ? job.payload.researchItemId : '';
    const videoUrl = typeof job.payload.videoUrl === 'string' ? job.payload.videoUrl : '';
    const preferredLocale =
      job.payload.preferredLocale === 'en-US' || job.payload.preferredLocale === 'id-ID'
        ? job.payload.preferredLocale
        : undefined;

    if (!researchItemId || !videoUrl) {
      throw new Error('Payload REFERENCE_TRANSCRIPT memerlukan researchItemId dan videoUrl.');
    }

    await sendProgress(25, `Mengekstrak transkrip referensi via yt-dlp: ${videoUrl}`);
    const extraction = await extractReferenceTranscript({
      videoUrl,
      preferredLocale,
      groqApiKey: process.env.GROQ_API_KEY,
    });

    await sendProgress(100, `Transkrip selesai (${extraction.method})`);
    return {
      researchItemId,
      transcriptText: extraction.transcriptText,
      method: extraction.method,
      language: extraction.language,
      durationSeconds: extraction.durationSeconds ?? null,
    };
  }

  if (job.jobType === 'RENDER_HYPERFRAMES') {
    const projectId = String(job.payload.projectId ?? job.projectId ?? job.jobId);
    const quality =
      job.payload.quality === 'draft' || job.payload.quality === 'delivery' || job.payload.quality === 'looks'
        ? job.payload.quality
        : 'looks';
    const rendersRoot = path.join(os.homedir(), '.youbellkey', 'renders');
    const localOutputPath = path.join(rendersRoot, `${projectId}.mp4`);

    const renderRes = await executeRenderPipeline({
      document: job.payload.document,
      outputPath: localOutputPath,
      quality,
      repoRootDir: process.cwd(),
      providerKeys: {
        geminiApiKey: process.env.GEMINI_API_KEY,
        groqApiKey: process.env.GROQ_API_KEY,
        googleCloudTtsApiKey: process.env.GOOGLE_CLOUD_TTS_API_KEY,
      },
      onProgress: sendProgress,
    });

    let r2Key: string | null = null;
    const presign = await postWorkerJson<{
      ok: boolean;
      r2Configured: boolean;
      r2Key: string | null;
      uploadUrl: string | null;
    }>(config, '/api/worker/presign-render-upload', {
      workerId,
      jobId: job.jobId,
      projectId,
      filename: `${projectId}.mp4`,
      contentType: 'video/mp4',
    });

    if (presign.r2Configured && presign.uploadUrl && presign.r2Key) {
      await sendProgress(94, 'Mengunggah MP4 ke Cloudflare R2');
      const mp4Bytes = await fsp.readFile(localOutputPath);
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4' },
        body: new Blob([new Uint8Array(mp4Bytes)], { type: 'video/mp4' }),
      });
      if (!putRes.ok) {
        throw new Error(`Cloudflare R2 upload failed (${putRes.status})`);
      }
      r2Key = presign.r2Key;
    }

    await sendProgress(100, r2Key ? 'Render & upload R2 selesai' : 'Render lokal selesai');
    return {
      projectId,
      r2Key,
      localOutputPath,
      updatedDocument: renderRes.updatedDocument,
      mediaProbe: renderRes.mediaProbe,
      qualityGate: renderRes.qualityGate,
      ttsProviders: renderRes.ttsProviders,
      whisperAlignedScenes: renderRes.whisperAlignedScenes,
      warnings: renderRes.warnings,
    };
  }

  if (job.jobType === 'PUBLISH_YOUTUBE_SHORTS') {
    const channelId = typeof job.payload.channelId === 'string' ? job.payload.channelId : '';
    const projectId = String(job.payload.projectId ?? job.projectId ?? '');
    if (!channelId || !projectId) {
      throw new Error('Payload PUBLISH_YOUTUBE_SHORTS memerlukan channelId dan projectId.');
    }

    await sendProgress(15, 'Meminta short-lived OAuth access token dari Control Plane');
    const broker = await postWorkerJson<{
      ok: boolean;
      accessToken: string;
      downloadUrl: string | null;
      channelGuardrails: {
        publishedTodayCount: number;
        dailyPublishCap: number;
        autopilotEnabled: boolean;
      };
      idempotencyKey: string;
      alreadyPublishedWithKey: boolean;
    }>(config, '/api/worker/publish-token', {
      workerId,
      jobId: job.jobId,
      channelId,
    });

    let videoBytes: Uint8Array | null = null;
    if (broker.downloadUrl) {
      await sendProgress(35, 'Mengunduh MP4 tervalidasi dari Cloudflare R2');
      const dlRes = await fetch(broker.downloadUrl);
      if (!dlRes.ok) throw new Error(`Gagal mengunduh MP4 dari R2 (${dlRes.status})`);
      videoBytes = new Uint8Array(await dlRes.arrayBuffer());
    } else {
      const localPath = path.join(os.homedir(), '.youbellkey', 'renders', `${projectId}.mp4`);
      if (fs.existsSync(localPath)) {
        videoBytes = new Uint8Array(await fsp.readFile(localPath));
      }
    }

    if (!videoBytes) {
      throw new Error('File MP4 hasil render tidak ditemukan di R2 maupun di lokal worker.');
    }

    await sendProgress(55, 'Mengunggah ke YouTube Shorts (Resumable Upload)...');
    const mediaMeta = (job.payload.mediaProbe ?? {}) as {
      width?: number;
      height?: number;
      durationSeconds?: number;
      hasAudioTrack?: boolean;
      audioPeakDb?: number;
      captionsCount?: number;
    };

    const uploadResult = await publishYoutubeShortFromWorker({
      accessToken: broker.accessToken,
      videoBytes,
      guardrailsInput: {
        workspaceKillSwitchActive: false,
        channelAutopilotEnabled: broker.channelGuardrails.autopilotEnabled,
        publishedTodayCount: broker.channelGuardrails.publishedTodayCount,
        dailyPublishCap: broker.channelGuardrails.dailyPublishCap,
        idempotencyKey: broker.idempotencyKey,
        alreadyPublishedWithKey: broker.alreadyPublishedWithKey,
        width: Number(mediaMeta.width ?? 1080),
        height: Number(mediaMeta.height ?? 1920),
        durationSeconds: Number(mediaMeta.durationSeconds ?? 15),
        hasAudioTrack: Boolean(mediaMeta.hasAudioTrack ?? true),
        audioPeakDb: Number(mediaMeta.audioPeakDb ?? -14),
        captionsCount: Number(mediaMeta.captionsCount ?? 10),
      },
      metadata: {
        title: String(job.payload.title ?? 'Youbellkey Short'),
        description: String(job.payload.description ?? ''),
        tags: Array.isArray(job.payload.tags) ? (job.payload.tags as string[]) : undefined,
        privacyStatus:
          job.payload.privacyStatus === 'private' ||
          job.payload.privacyStatus === 'unlisted' ||
          job.payload.privacyStatus === 'public'
            ? job.payload.privacyStatus
            : 'public',
        publishAtIso: typeof job.payload.publishAt === 'string' ? job.payload.publishAt : undefined,
        defaultLanguage: job.payload.locale === 'en-US' ? 'en' : 'id',
      },
    });

    await sendProgress(100, `Terupload ke YouTube (${uploadResult.externalVideoId})`);
    return {
      projectId,
      channelId,
      publicationId: job.payload.publicationId ?? null,
      externalVideoId: uploadResult.externalVideoId,
      privacyStatus: uploadResult.privacyStatus,
      publishAt: uploadResult.publishAt,
    };
  }

  throw new Error(`Job type ${job.jobType} tidak dikenal.`);
}

export async function startWorkerLoop(config: WorkerRuntimeConfig): Promise<void> {
  if (!config.workerToken) {
    throw new Error('Missing YB_WORKER_TOKEN. Run bash infrastructure/local/sync-env.sh or generate a token in Studio.');
  }

  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log('[youbellkey-worker] Shutdown signal received, stopping gracefully...');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const platformArch = `${os.platform()}-${os.arch()}`;
  let reg: { ok: boolean; workerId: string; workspaceId: string; heartbeatIntervalSeconds: number } | null = null;
  let retryDelayMs = 5000;

  while (!stopping && !reg) {
    try {
      reg = await postWorkerJson(config, '/api/worker/register', {
        workerName: config.workerName,
        platformArch,
        capabilities: config.capabilities,
      });
    } catch (err) {
      console.error(
        `[youbellkey-worker] Register retry in ${retryDelayMs / 1000}s:`,
        err instanceof Error ? err.message : err,
      );
      await sleep(retryDelayMs);
      retryDelayMs = Math.min(30_000, retryDelayMs * 2);
    }
  }

  if (!reg) return;

  console.log(
    `[youbellkey-worker] Registered worker=${config.workerName} id=${reg.workerId} arch=${platformArch} controlPlane=${config.controlPlaneUrl}`,
  );

  while (!stopping) {
    try {
      const { job } = await postWorkerJson<{ job: JobDispatch | null }>(config, '/api/worker/claim', {
        workerId: reg.workerId,
        capabilities: config.capabilities,
      });

      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      console.log(`[youbellkey-worker] Claimed job=${job.jobId} type=${job.jobType} attempt=${job.attemptCount}`);

      // Render jobs can take 10–15 minutes (11 scenes × TTS + Chrome headless + FFmpeg).
      // Use aggressive 15-second heartbeat so the 15-min rolling lease never expires.
      const isHeavyJob = job.jobType === 'RENDER_HYPERFRAMES' || job.jobType === 'PUBLISH_YOUTUBE_SHORTS';
      const heartbeatMs = isHeavyJob ? 15_000 : Math.max(10_000, reg.heartbeatIntervalSeconds * 1000);
      let lastProgressForHeartbeat = 0;

      const heartbeatTimer = setInterval(() => {
        void postWorkerJson(config, '/api/worker/heartbeat', {
          workerId: reg!.workerId,
          jobId: job.jobId,
          progress: lastProgressForHeartbeat,
        }).catch((err) => console.error('[youbellkey-worker] Heartbeat error:', err));
      }, heartbeatMs);

      // Wrap sendProgress so heartbeat timer always knows latest progress
      const origSendProgress = async (progress: number, message: string) => {
        lastProgressForHeartbeat = progress;
        const hb = await postWorkerJson<{ ok: boolean; killSwitchActive: boolean }>(
          config,
          '/api/worker/heartbeat',
          { workerId: reg!.workerId, jobId: job.jobId, progress, message },
        );
        if (hb.killSwitchActive && job.jobType === 'PUBLISH_YOUTUBE_SHORTS') {
          throw new Error('Aborted due to workspace kill switch.');
        }
      };

      try {
        const result = await executeClaimedJob(config, reg.workerId, job, origSendProgress);
        await postWorkerJson(config, '/api/worker/complete', {
          workerId: reg.workerId,
          jobId: job.jobId,
          status: 'SUCCEEDED',
          result,
        });
        console.log(`[youbellkey-worker] Completed job=${job.jobId}`);
      } catch (jobError) {
        const message = jobError instanceof Error ? jobError.message : 'Unknown worker error';
        await postWorkerJson(config, '/api/worker/complete', {
          workerId: reg.workerId,
          jobId: job.jobId,
          status: 'FAILED',
          errorCode: 'WORKER_EXECUTION_ERROR',
          errorMessage: message,
        });
        console.error(`[youbellkey-worker] Failed job=${job.jobId}: ${message}`);
      } finally {
        clearInterval(heartbeatTimer);
      }
    } catch (loopError) {
      console.error(
        '[youbellkey-worker] Poll error:',
        loopError instanceof Error ? loopError.message : loopError,
      );
      await sleep(config.pollIntervalMs);
    }
  }
}
