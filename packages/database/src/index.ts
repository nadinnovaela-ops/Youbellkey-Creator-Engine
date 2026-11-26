import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const INITIAL_MIGRATION_PATH = 'supabase/migrations/0001_initial_schema.sql';

export interface ClaimJobParams {
  workerId: string;
  capabilities: string[];
  leaseSeconds: number;
}

export interface WorkspaceRow {
  id: string;
  owner_user_id: string;
  name: string;
  kill_switch_active: boolean;
  default_locale: 'id-ID' | 'en-US';
  default_timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelRow {
  id: string;
  workspace_id: string;
  platform: 'youtube_shorts' | 'instagram_reels' | 'facebook_reels';
  external_channel_id: string;
  title: string;
  locale: 'id-ID' | 'en-US';
  timezone: string;
  workflow_mode: 'AUTOPILOT' | 'MANUAL_REVIEW';
  daily_publish_cap: number;
  autopilot_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkerRow {
  id: string;
  workspace_id: string;
  worker_name: string;
  token_hash: string;
  platform_arch: string;
  capabilities: string[];
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  last_heartbeat_at: string | null;
  created_at: string;
}

export interface ProviderCredentialSummaryRow {
  id: string;
  workspace_id: string;
  provider: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  job_type: string;
  required_capability: 'render' | 'research' | 'publish';
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  progress: number;
  attempt_count: number;
  max_attempts: number;
  locked_by_worker_id: string | null;
  lease_expires_at: string | null;
  idempotency_key: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchSourceRow {
  id: string;
  workspace_id: string;
  platform: string;
  external_channel_id: string;
  niche: string;
  locale: 'id-ID' | 'en-US';
  rss_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ResearchItemRow {
  id: string;
  workspace_id: string;
  source_id: string | null;
  external_video_id: string;
  video_url: string;
  title: string;
  view_count: number;
  outlier_score: number;
  growth_velocity: number;
  viral_score: number;
  transcript_text: string | null;
  metadata: Record<string, unknown>;
  discovered_at: string;
}

export interface ContentProjectRow {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  source_item_id: string | null;
  title: string;
  locale: 'id-ID' | 'en-US';
  video_track: 'MOTION_EXPLAINER' | 'AI_STORYTELLING';
  script_text: string | null;
  yb_video_doc: Record<string, unknown> | null;
  originality_score: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CostLedgerRow {
  id: string;
  workspace_id: string;
  job_id: string | null;
  provider: string;
  model: string;
  input_units: number;
  output_units: number;
  estimated_cost_usd: number;
  created_at: string;
}

/**
 * Server-only Supabase Service Role client.
 * Never invoke from client/browser code.
 */
export function createSupabaseAdminClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseAdminClient must never be called in browser code.');
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseAnonClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): SupabaseClient {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
