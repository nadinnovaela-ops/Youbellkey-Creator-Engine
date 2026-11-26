# Youbellkey Studio — API Contracts

Seluruh endpoint HTTP berada di Next.js App Router (`apps/web/src/app/api/...`) di Vercel. Validasi payload memakai Zod dari `packages/job-contracts`.

## 1. Worker Control Plane Protocol (Bearer Worker Token)
- `POST /api/worker/register`
  - **Input:** `{ worker_name, platform_arch, capabilities: ('render' | 'research' | 'publish')[] }`
  - **Output:** `{ worker_id, heartbeat_interval_seconds: 30, lease_ttl_seconds: 120 }`
- `POST /api/worker/claim`
  - **Input:** `{ worker_id, capabilities }`
  - **Output:** `{ job: JobDispatch | null }` (berisi `job_id`, `job_type`, `payload`, dan presigned R2 URLs bila perlu; **tidak pernah** menyertakan secret mentah permanen).
- `POST /api/worker/heartbeat`
  - **Input:** `{ worker_id, job_id?, progress?: number, message?: string }`
  - **Output:** `{ ok: true, lease_expires_at, kill_switch_active: boolean }`
- `POST /api/worker/complete`
  - **Input:** `{ worker_id, job_id, status: 'SUCCEEDED' | 'FAILED', result?, error_code?, error_message?, usage_metrics? }`
  - **Output:** `{ ok: true, next_job_created?: boolean }`
- `POST /api/worker/publish-token`
  - **Input:** `{ worker_id, job_id, channel_id }`
  - **Output:** `{ access_token, expires_at, channel_guardrails }` (diberikan hanya saat job `publish` sah berstatus `RUNNING` untuk worker tersebut dan `kill_switch_active === false`).

## 2. Storage Presigned Broker (Auth User / Worker)
- `POST /api/storage/presign-upload` -> mengembalikan presigned `PUT` URL Cloudflare R2 untuk path `workspaces/{workspace_id}/projects/{project_id}/...`
- `POST /api/storage/presign-download` -> mengembalikan presigned `GET` URL berumur pendek untuk preview PWA atau penarikan Meta Graph API.

## 3. Studio Control & Autopilot Endpoints (Supabase Auth User)
- `POST /api/workspaces/kill-switch` -> toggle penghentian darurat seluruh publikasi otomatis dari HP PWA.
- `POST /api/projects/:id/generate` -> memicu pipeline skrip + `YB Video Document` + enqueue job render.
- `PATCH /api/projects/:id/document` -> mengedit scene/teks/caption pada `YB Video Document` JSON langsung dari browser/HP.
