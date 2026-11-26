-- Youbellkey Studio — Phase 0 Initial Supabase Schema
-- Tenant-ready from Day 1 via workspace_id + Row Level Security (RLS)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Workspaces & Membership
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kill_switch_active BOOLEAN NOT NULL DEFAULT FALSE,
  default_locale TEXT NOT NULL DEFAULT 'id-ID' CHECK (default_locale IN ('id-ID', 'en-US')),
  default_timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Helper for RLS membership check
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = target_workspace_id AND w.owner_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id AND wm.user_id = auth.uid()
  );
$$;

-- 2. Connected Channels
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube_shorts', 'instagram_reels', 'facebook_reels')),
  external_channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id-ID' CHECK (locale IN ('id-ID', 'en-US')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  workflow_mode TEXT NOT NULL DEFAULT 'AUTOPILOT' CHECK (workflow_mode IN ('AUTOPILOT', 'MANUAL_REVIEW')),
  daily_publish_cap INT NOT NULL DEFAULT 3 CHECK (daily_publish_cap BETWEEN 1 AND 25),
  autopilot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  oauth_tokens_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, external_channel_id)
);

-- 3. Encrypted BYOK Provider Credentials
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Hybrid Worker Registry
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  platform_arch TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY['render', 'research', 'publish'],
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'BUSY', 'OFFLINE')),
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Viral Research Sources & Items
CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'youtube',
  external_channel_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id-ID',
  rss_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.research_sources(id) ON DELETE SET NULL,
  external_video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  title TEXT NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  outlier_score NUMERIC(8, 3) NOT NULL DEFAULT 0,
  growth_velocity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  viral_score NUMERIC(8, 3) NOT NULL DEFAULT 0,
  transcript_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_video_id)
);

-- 6. Content Projects & YB Video Document
CREATE TABLE IF NOT EXISTS public.content_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  source_item_id UUID REFERENCES public.research_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id-ID' CHECK (locale IN ('id-ID', 'en-US')),
  video_track TEXT NOT NULL CHECK (video_track IN ('MOTION_EXPLAINER', 'AI_STORYTELLING')),
  script_text TEXT,
  yb_video_doc JSONB,
  originality_score NUMERIC(5, 4),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. R2 Media Assets
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.content_projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Postgres Atomic Job Lease Queue
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.content_projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  required_capability TEXT NOT NULL CHECK (required_capability IN ('render', 'research', 'publish')),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (
    status IN ('QUEUED', 'RUNNING', 'REVIEW_REQUIRED', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'RETRY_PENDING')
  ),
  priority INT NOT NULL DEFAULT 100,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  locked_by_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  lease_expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_jobs_claimable
  ON public.jobs (status, priority, created_at)
  WHERE status IN ('QUEUED', 'RETRY_PENDING');

-- 9. Publications (Idempotent Upload Tracking)
CREATE TABLE IF NOT EXISTS public.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  external_video_id TEXT,
  publish_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  guardrail_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. AI Cost & Usage Ledger
CREATE TABLE IF NOT EXISTS public.cost_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_units BIGINT NOT NULL DEFAULT 0,
  output_units BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_ledger ENABLE ROW LEVEL SECURITY;

-- Workspace RLS Policies
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY workspaces_insert ON public.workspaces
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY workspaces_update ON public.workspaces
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY workspace_members_all ON public.workspace_members
  FOR ALL USING (public.is_workspace_member(workspace_id));

CREATE POLICY channels_all ON public.channels
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY provider_credentials_all ON public.provider_credentials
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY workers_all ON public.workers
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY research_sources_all ON public.research_sources
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY research_items_all ON public.research_items
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY content_projects_all ON public.content_projects
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY media_assets_all ON public.media_assets
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY jobs_all ON public.jobs
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY publications_all ON public.publications
  FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY cost_ledger_all ON public.cost_ledger
  FOR ALL USING (public.is_workspace_member(workspace_id));

-- Atomic Worker Job Claim RPC (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_next_job(
  p_worker_id UUID,
  p_capabilities TEXT[],
  p_lease_seconds INT DEFAULT 120
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_job_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.workers
  WHERE id = p_worker_id;

  IF v_workspace_id IS NULL THEN
    RETURN;
  END IF;

  SELECT j.id INTO v_job_id
  FROM public.jobs j
  WHERE j.workspace_id = v_workspace_id
    AND j.status IN ('QUEUED', 'RETRY_PENDING')
    AND j.required_capability = ANY(p_capabilities)
  ORDER BY j.priority ASC, j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.jobs
  SET
    status = 'RUNNING',
    locked_by_worker_id = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = attempt_count + 1,
    updated_at = now()
  WHERE id = v_job_id
  RETURNING *;
END;
$$;

-- Lease Recovery RPC when local PC sleeps or disconnects
CREATE OR REPLACE FUNCTION public.reclaim_expired_leases()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH updated AS (
    UPDATE public.jobs
    SET
      status = CASE WHEN attempt_count >= max_attempts THEN 'FAILED' ELSE 'RETRY_PENDING' END,
      locked_by_worker_id = NULL,
      lease_expires_at = NULL,
      error_message = COALESCE(error_message, 'Worker lease expired before completion'),
      updated_at = now()
    WHERE status = 'RUNNING'
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;
