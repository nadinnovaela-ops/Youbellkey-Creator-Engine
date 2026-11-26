---
name: yb-security-auditor
description: >-
  Audits Supabase RLS tenant isolation, AES-256-GCM BYOK secret encryption,
  worker token hashing, OAuth token handling, and R2 presigned URL scoping. Use
  when touching auth, secrets, API routes, or database migrations.
---

# Youbellkey Security Auditor

Use this skill to verify security boundaries across `apps/web`, `packages/database`, and `workers/*`.

## Audit Checklist
1. Confirm every table containing user/channel/asset/job data has `workspace_id` and active Supabase RLS policies.
2. Confirm BYOK AI keys, R2 secrets, and OAuth `refresh_token` values are encrypted server-side (AES-256-GCM) and never returned in client responses, job claim payloads, or logs.
3. Confirm worker authentication compares SHA-256 hashed tokens and scopes `claim`/`complete`/`publish-token` calls strictly to the worker's own `workspace_id`.
4. Confirm template rendering in `engines/hyperframes` cannot execute arbitrary unvalidated LLM HTML/JS in V1 (enforce `YBVideoDocumentSchema` validation).
5. Run `npm run test:security` after edits.
