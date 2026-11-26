import type { ChannelRow, JobRow, ProviderCredentialSummaryRow, WorkerRow } from '@youbellkey/database';
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
}

export async function loadStudioOverview(ctx: AuthenticatedContext): Promise<StudioOverviewPayload> {
  const { supabase, workspace } = ctx;

  const [channelsRes, workersRes, providersRes, jobsRes] = await Promise.all([
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
    },
    channels,
    workers,
    providers,
    availableProviders: REGISTERED_PROVIDERS,
    jobs,
  };
}
