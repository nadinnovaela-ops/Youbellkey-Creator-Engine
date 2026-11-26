import type {
  ChannelRow,
  ContentProjectRow,
  JobRow,
  ProviderCredentialSummaryRow,
  ResearchItemRow,
  ResearchSourceRow,
  WorkerRow,
} from '@youbellkey/database';
import { REGISTERED_PROVIDERS } from '@youbellkey/provider-adapters';
import { isR2Configured } from '@youbellkey/storage';
import type { AuthenticatedContext } from './auth';
import { isWorkerRecentlyActive } from './http';

export interface StudioOverviewPayload {
  userEmail: string | null;
  workspace: {
    id: string;
    name: string;
    killSwitchActive: boolean;
    defaultLocale: string;
    defaultTimezone: string;
  };
  readiness: {
    r2Configured: boolean;
    secretsMasterKeyConfigured: boolean;
    geminiEnvConfigured: boolean;
    groqEnvConfigured: boolean;
    youtubeApiConfigured: boolean;
  };
  channels: Array<{
    id: string;
    platform: string;
    externalChannelId: string;
    title: string;
    locale: string;
    timezone: string;
    workflowMode: string;
    dailyPublishCap: number;
    autopilotEnabled: boolean;
  }>;
  workers: Array<{
    id: string;
    workerName: string;
    platformArch: string;
    capabilities: string[];
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';
    lastHeartbeatAt: string | null;
  }>;
  providers: Array<{
    id: string;
    provider: string;
    label: string;
    isActive: boolean;
    updatedAt: string;
  }>;
  availableProviders: typeof REGISTERED_PROVIDERS;
  jobs: Array<{
    id: string;
    jobType: string;
    requiredCapability: string;
    status: string;
    progress: number;
    attemptCount: number;
    maxAttempts: number;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  researchSources: Array<{
    id: string;
    platform: string;
    externalChannelId: string;
    niche: string;
    locale: string;
    rssUrl: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  researchItems: Array<{
    id: string;
    sourceId: string | null;
    externalVideoId: string;
    videoUrl: string;
    title: string;
    viewCount: number;
    outlierScore: number;
    growthVelocity: number;
    viralScore: number;
    hasTranscript: boolean;
    transcriptPreview: string | null;
    transcriptText: string | null;
    discoveredAt: string;
  }>;
  projects: Array<{
    id: string;
    channelId: string | null;
    sourceItemId: string | null;
    title: string;
    locale: 'id-ID' | 'en-US';
    videoTrack: 'MOTION_EXPLAINER' | 'AI_STORYTELLING';
    scriptText: string | null;
    ybVideoDoc: Record<string, unknown> | null;
    originalityScore: number | null;
    status: string;
    hasR2Asset: boolean;
    publishedVideoId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function loadStudioOverview(ctx: AuthenticatedContext): Promise<StudioOverviewPayload> {
  const { supabase, workspace } = ctx;

  const [channelsRes, workersRes, providersRes, jobsRes, sourcesRes, itemsRes, projectsRes, assetsRes, pubsRes] =
    await Promise.all([
      supabase
        .from('channels')
        .select('id, workspace_id, platform, external_channel_id, title, locale, timezone, workflow_mode, daily_publish_cap, autopilot_enabled, created_at, updated_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workers')
        .select('id, workspace_id, worker_name, platform_arch, capabilities, status, last_heartbeat_at, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('provider_credentials')
        .select('id, workspace_id, provider, label, is_active, created_at, updated_at')
        .eq('workspace_id', workspace.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('jobs')
        .select('id, workspace_id, project_id, job_type, required_capability, status, priority, payload, progress, attempt_count, max_attempts, locked_by_worker_id, lease_expires_at, idempotency_key, error_message, created_at, updated_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('research_sources')
        .select('id, workspace_id, platform, external_channel_id, niche, locale, rss_url, is_active, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('research_items')
        .select('id, workspace_id, source_id, external_video_id, video_url, title, view_count, outlier_score, growth_velocity, viral_score, transcript_text, metadata, discovered_at')
        .eq('workspace_id', workspace.id)
        .order('viral_score', { ascending: false })
        .order('discovered_at', { ascending: false })
        .limit(30),
      supabase
        .from('content_projects')
        .select('id, workspace_id, channel_id, source_item_id, title, locale, video_track, script_text, yb_video_doc, originality_score, status, created_at, updated_at')
        .eq('workspace_id', workspace.id)
        .order('updated_at', { ascending: false })
        .limit(25),
      supabase
        .from('media_assets')
        .select('project_id')
        .eq('workspace_id', workspace.id)
        .eq('asset_type', 'render-mp4'),
      supabase
        .from('publications')
        .select('project_id, external_video_id, status')
        .eq('workspace_id', workspace.id),
    ]);

  const channels = ((channelsRes.data ?? []) as ChannelRow[]).map((c) => ({
    id: c.id,
    platform: c.platform,
    externalChannelId: c.external_channel_id,
    title: c.title,
    locale: c.locale,
    timezone: c.timezone,
    workflowMode: c.workflow_mode,
    dailyPublishCap: c.daily_publish_cap,
    autopilotEnabled: c.autopilot_enabled,
  }));

  const workers = ((workersRes.data ?? []) as Omit<WorkerRow, 'token_hash'>[]).map((w) => {
    const active = isWorkerRecentlyActive(w.last_heartbeat_at);
    const status: 'ONLINE' | 'BUSY' | 'OFFLINE' = active
      ? w.status === 'BUSY'
        ? 'BUSY'
        : 'ONLINE'
      : 'OFFLINE';
    return {
      id: w.id,
      workerName: w.worker_name,
      platformArch: w.platform_arch,
      capabilities: w.capabilities,
      status,
      lastHeartbeatAt: w.last_heartbeat_at,
    };
  });

  const providers = ((providersRes.data ?? []) as ProviderCredentialSummaryRow[]).map((p) => ({
    id: p.id,
    provider: p.provider,
    label: p.label,
    isActive: p.is_active,
    updatedAt: p.updated_at,
  }));

  const jobs = ((jobsRes.data ?? []) as JobRow[]).map((j) => ({
    id: j.id,
    jobType: j.job_type,
    requiredCapability: j.required_capability,
    status: j.status,
    progress: Number(j.progress ?? 0),
    attemptCount: j.attempt_count,
    maxAttempts: j.max_attempts,
    errorMessage: j.error_message,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  }));

  const researchSources = ((sourcesRes.data ?? []) as ResearchSourceRow[]).map((s) => ({
    id: s.id,
    platform: s.platform,
    externalChannelId: s.external_channel_id,
    niche: s.niche,
    locale: s.locale,
    rssUrl: s.rss_url,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));

  const researchItems = ((itemsRes.data ?? []) as ResearchItemRow[]).map((item) => ({
    id: item.id,
    sourceId: item.source_id,
    externalVideoId: item.external_video_id,
    videoUrl: item.video_url,
    title: item.title,
    viewCount: Number(item.view_count ?? 0),
    outlierScore: Number(item.outlier_score ?? 0),
    growthVelocity: Number(item.growth_velocity ?? 0),
    viralScore: Number(item.viral_score ?? 0),
    hasTranscript: Boolean(item.transcript_text?.trim()),
    transcriptPreview: item.transcript_text ? item.transcript_text.slice(0, 180) : null,
    transcriptText: item.transcript_text,
    discoveredAt: item.discovered_at,
  }));

  const assetProjectIds = new Set(
    ((assetsRes.data ?? []) as Array<{ project_id: string | null }>)
      .map((a) => a.project_id)
      .filter((id): id is string => Boolean(id)),
  );
  const pubMap = new Map<string, string>();
  for (const pub of (pubsRes.data ?? []) as Array<{
    project_id: string;
    external_video_id: string | null;
    status: string;
  }>) {
    if (pub.status === 'PUBLISHED' && pub.external_video_id) {
      pubMap.set(pub.project_id, pub.external_video_id);
    }
  }

  const projects = ((projectsRes.data ?? []) as ContentProjectRow[]).map((p) => ({
    id: p.id,
    channelId: p.channel_id,
    sourceItemId: p.source_item_id,
    title: p.title,
    locale: p.locale,
    videoTrack: p.video_track,
    scriptText: p.script_text,
    ybVideoDoc: p.yb_video_doc,
    originalityScore: p.originality_score === null ? null : Number(p.originality_score),
    status: p.status,
    hasR2Asset: assetProjectIds.has(p.id),
    publishedVideoId: pubMap.get(p.id) ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return {
    userEmail: ctx.userEmail,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      killSwitchActive: workspace.kill_switch_active,
      defaultLocale: workspace.default_locale,
      defaultTimezone: workspace.default_timezone,
    },
    readiness: {
      r2Configured: isR2Configured(),
      secretsMasterKeyConfigured: /^[0-9a-fA-F]{64}$/.test(process.env.YB_SECRETS_MASTER_KEY ?? ''),
      geminiEnvConfigured: Boolean(process.env.GEMINI_API_KEY),
      groqEnvConfigured: Boolean(process.env.GROQ_API_KEY),
      youtubeApiConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    },
    channels,
    workers,
    providers,
    availableProviders: REGISTERED_PROVIDERS,
    jobs,
    researchSources,
    researchItems,
    projects,
  };
}
