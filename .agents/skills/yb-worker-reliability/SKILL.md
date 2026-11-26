---
name: yb-worker-reliability
description: >-
  Ensures Postgres atomic job leasing, worker heartbeats, lease expiration
  recovery, bounded backoff retries, and clean disconnects across PC and Docker
  ARM64 workers. Use when modifying job queues or workers/*.
---

# Youbellkey Worker Reliability

Use this skill when designing or debugging job state transitions, leases, and retry behavior.

## Guarantees to Enforce
1. Jobs must use explicit states: `QUEUED`, `RUNNING`, `REVIEW_REQUIRED`, `APPROVED`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `RETRY_PENDING`.
2. `claim_next_job` in Supabase must remain atomic (`FOR UPDATE SKIP LOCKED`) so concurrent workers never claim the same job.
3. Workers must send periodic heartbeats with progress (`0..100`) and abort gracefully if the workspace kill switch flips or lease ownership is lost.
4. Reclaim expired leases cleanly so sudden laptop sleep/power loss never leaves orphan `RUNNING` jobs stuck forever, while respecting `max_attempts` and bounded exponential backoff.
