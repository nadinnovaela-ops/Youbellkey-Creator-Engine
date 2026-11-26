# Youbellkey Studio — Data Model

Seluruh tabel bisnis berada di PostgreSQL (Supabase) dan memakai **UUID primary key**, `created_at` / `updated_at`, serta `workspace_id` untuk isolasi tenant sejak Phase 0.

## Tabel Inti (Migrasi `0001_initial_schema.sql`)
1. `workspaces` — Ruang kerja pengguna (`id`, `owner_user_id`, `name`, `kill_switch_active`, `default_locale`, `default_timezone`).
2. `workspace_members` — Keanggotaan workspace (`workspace_id`, `user_id`, `role`).
3. `channels` — Channel YouTube/Meta terhubung (`workspace_id`, `platform`, `external_channel_id`, `title`, `locale`, `timezone`, `workflow_mode`: `'AUTOPILOT' | 'MANUAL_REVIEW'`, `daily_publish_cap`, `autopilot_enabled`, `oauth_tokens_encrypted`).
4. `provider_credentials` — BYOK AI/TTS/Storage credentials terenkripsi AES-256-GCM (`workspace_id`, `provider`, `label`, `encrypted_payload`, `is_active`).
5. `workers` — Registry worker (`workspace_id`, `worker_name`, `token_hash`, `platform_arch`, `capabilities` JSONB, `status`, `last_heartbeat_at`).
6. `research_sources` & `research_items` — Channel/niche pantauan (RSS + Data API) dan video referensi dengan `outlier_score`, `growth_velocity`, `viral_score`, serta ringkasan/transkrip.
7. `content_projects` — Proyek konten (`workspace_id`, `channel_id`, `source_item_id`, `locale`, `video_track`: `'MOTION_EXPLAINER' | 'AI_STORYTELLING'`, `script_text`, `yb_video_doc` JSONB, `originality_score`, `status`).
8. `media_assets` — Metadata objek di Cloudflare R2 (`workspace_id`, `project_id`, `asset_type`, `r2_key`, `mime_type`, `size_bytes`, `expires_at` untuk auto-cleanup).
9. `jobs` — Antrean pekerjaan tahan-restart berbasis **Atomic Postgres Lease** (`id`, `workspace_id`, `project_id`, `job_type`, `status`, `priority`, `payload`, `progress`, `attempt_count`, `max_attempts`, `locked_by_worker_id`, `lease_expires_at`, `idempotency_key`, `error_message`).
10. `publications` — Catatan unggahan dengan `idempotency_key` unik (`workspace_id`, `channel_id`, `project_id`, `platform`, `external_video_id`, `publish_at`, `status`, `guardrail_report`).
11. `cost_ledger` — Pelacakan pemakaian token AI, karakter TTS, detik audio Whisper, dan estimasi biaya per job (`workspace_id`, `job_id`, `provider`, `model`, `input_units`, `output_units`, `estimated_cost_usd`).

## Fungsi RPC Penting
- `claim_next_job(p_worker_id UUID, p_capabilities TEXT[], p_lease_seconds INT)`: Mengambil 1 job berprioritas tertinggi dengan `SELECT ... FOR UPDATE SKIP LOCKED` secara atomik.
- `reclaim_expired_leases()`: Mengembalikan job `RUNNING` yang `lease_expires_at < now()` ke `RETRY_PENDING` atau `FAILED` jika batas retry habis.
