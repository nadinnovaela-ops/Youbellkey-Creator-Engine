-- Migration: 0002_add_reclaim_cron_and_indexes.sql
-- Indexes for fast atomic claim/reclaim and cleaner job claim state resets.

CREATE INDEX IF NOT EXISTS idx_jobs_reclaim
  ON public.jobs (status, lease_expires_at)
  WHERE status = 'RUNNING' AND lease_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_claim
  ON public.jobs (workspace_id, status, required_capability, priority, created_at)
  WHERE status IN ('QUEUED', 'RETRY_PENDING');

CREATE OR REPLACE FUNCTION public.claim_next_job(
  p_worker_id UUID,
  p_capabilities TEXT[],
  p_lease_seconds INT DEFAULT 900
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
    progress = 0,
    error_message = NULL,
    locked_by_worker_id = p_worker_id,
    lease_expires_at = now() + make_interval(
      secs => CASE
        WHEN job_type IN ('RENDER_HYPERFRAMES', 'PUBLISH_YOUTUBE_SHORTS') THEN GREATEST(p_lease_seconds, 1500)
        ELSE p_lease_seconds
      END
    ),
    attempt_count = attempt_count + 1,
    updated_at = now()
  WHERE id = v_job_id
  RETURNING *;
END;
$$;
