import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { JobDispatch, WorkerCapability } from '@youbellkey/job-contracts';
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
): Promise<Record<string, unknown>> {
  const sendProgress = async (progress: number, message: string) => {
    const hb = await postWorkerJson<{ ok: boolean; killSwitchActive: boolean }>(
      config,
      '/api/worker/heartbeat',
      { workerId, jobId: job.jobId, progress, message },
    );
    if (hb.killSwitchActive && job.jobType === 'PUBLISH_YOUTUBE_SHORTS') {
      throw new Error('Aborted due to workspace kill switch.');
    }
  };

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

  throw new Error(`Job type ${job.jobType} will be implemented in Phase 3-4.`);
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
      const heartbeatTimer = setInterval(() => {
        void postWorkerJson(config, '/api/worker/heartbeat', {
          workerId: reg!.workerId,
          jobId: job.jobId,
        }).catch((err) => console.error('[youbellkey-worker] Heartbeat error:', err));
      }, Math.max(10_000, reg.heartbeatIntervalSeconds * 1000));

      try {
        const result = await executeClaimedJob(config, reg.workerId, job);
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
