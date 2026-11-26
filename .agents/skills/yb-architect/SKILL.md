---
name: yb-architect
description: >-
  Enforces Youbellkey Studio's aligned Hybrid Ringan architecture across Vercel,
  Supabase, Cloudflare R2, and the Universal Worker. Use whenever proposing or
  reviewing new modules, stack changes, database migrations, or ADRs.
---

# Youbellkey Architect

Use this skill to keep every implementation strictly aligned with [PROJECT_MASTER_PLAN.md](../../../docs/PROJECT_MASTER_PLAN.md) and `docs/ADR/*`.

## Workflow
1. Read `docs/PROJECT_MASTER_PLAN.md`, `docs/ARCHITECTURE.md`, and relevant `docs/ADR/*.md` files before designing changes.
2. Verify all constraints:
   - Control Plane stays in `apps/web` (Next.js App Router on Vercel) + `packages/database` (Supabase PostgreSQL + RLS + Postgres job lease).
   - Never reintroduce separate NestJS, Redis/BullMQ, Python LiteLLM proxy, or mandatory Remotion without writing a new ADR first.
   - All business tables must include `workspace_id` and RLS policies so the codebase stays ready for future one-time commercial packaging.
   - Media binaries belong in Cloudflare R2 (`packages/storage`), never in Supabase Storage or Vercel serverless request bodies.
3. Verify module boundaries across `apps/`, `workers/`, `packages/`, and `engines/`.
4. Report status using `FIXED`, `PARTIALLY FIXED`, `NOT FIXED`, `NOT APPLICABLE`, or `BLOCKED`.
