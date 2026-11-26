# Youbellkey Studio — Development Roadmap

## Phase 0 — Foundation, License Audit & Governance (Aktif)
- Setup monorepo 25+ folder target + `npm` workspaces + TypeScript strict baseline.
- `docs/PROJECT_MASTER_PLAN.md` revisi final, ADRs (`0001`–`0004`), `LICENSE_POLICY.md`, `SECURITY.md`, `DATA_MODEL.md`, `API_CONTRACTS.md`.
- 9 custom Antigravity workspace skills (`.agents/skills/yb-*`) + `AGENTS.md`.
- Skema awal Supabase (`packages/database/supabase/migrations/0001_initial_schema.sql`) dengan `workspace_id`, RLS, dan Postgres atomic job lease RPC.
- `packages/license-registry` + `THIRD_PARTY_NOTICES.md` + inspeksi binary lokal (`hyperframes`, `ffmpeg`).
- **Acceptance Criteria:** `npm run typecheck`, `npm run test`, `npm run test:license`, dan `npm run doctor:hyperframes` seluruhnya terverifikasi berjalan dan lulus.

## Phase 1 — Control Plane & Universal Worker Core
- Dashboard Next.js PWA (`apps/web`) dengan Supabase Auth & mobile-first monitoring UI + 1-tap Kill Switch.
- Worker Registry, HTTPS job claim/heartbeat/progress endpoints, dan `workers/local-worker` runner.
- Encrypted BYOK Provider Vault (Gemini, OpenRouter, Groq, OpenAI) & Cloudflare R2 presigned storage adapter.
- **Acceptance Criteria:** Job uji coba dapat dibuat dari HP PWA, diambil oleh `local-worker`, mengirim progress realtime ke PWA, dan pulih otomatis jika worker dimatikan paksa.

## Phase 2 — Viral Research & AI Content Lab (ID & EN)
- `workers/research-worker`: YouTube RSS poller + YouTube Data API batching (`videos.list`) + Outlier/Velocity score.
- Ekstraksi transkrip referensi aman di worker (`yt-dlp` + Groq Whisper) khusus URL pilihan pengguna.
- Content Regen multi-bahasa (`id` & `en`), originality risk check, dan generator `YB Video Document` v1.0.
- **Acceptance Criteria:** Dari 1 URL/ide referensi, sistem menghasilkan 3–5 variasi skrip & `YB Video Document` JSON yang dapat diedit di PWA.

## Phase 3 — Video Factory (HyperFrames + 2 Core V1 Tracks + Free TTS/Captions)
- Adapter Cloud TTS gratis (Google Cloud TTS / Azure F0 / fallback `edge-tts` pribadi) + **Groq Whisper** word-level alignment.
- Implementasi template V1:
  1. `kinetic-typography` & `data-threejs-explainer` (Jalur A — kode murni)
  2. `ai-visual-storytelling` (Jalur B — AI Image + gerak kamera + subtitle dinamis)
- Render `1080x1920` MP4 via HyperFrames + FFmpeg loudness normalization, upload ke R2, preview di PWA.
- **Acceptance Criteria:** 1 konsep ID dan 1 konsep EN berhasil dirender menjadi MP4 9:16 dengan voiceover & subtitle sinkron per kata, tersimpan di R2, dan dapat diputar dari smartphone.

## Phase 4 — Publishing & YouTube Shorts Autopilot (+ Meta Reels Fase 4.2)
- YouTube OAuth2 + short-lived access token broker untuk `workers/publish-worker`.
- Pre-publish Autopilot Guardrails (cek durasi, audio non-silent, subtitle, daily cap, idempotency key, kill switch).
- Upload resumable ke YouTube Shorts + `publishAt` timezone scheduler (WIB/US/global).
- **Phase 4.2:** Instagram Reels & Facebook Reels via Meta Graph API (memanfaatkan presigned URL R2).
- **Acceptance Criteria:** Siklus penuh Autopilot end-to-end teruji (termasuk skenario retry tanpa double-upload).

## Phase 5 & 6 — Advanced Research, Analytics & Character Studio
- Dashboard YouTube Analytics (CTR, retention, views, estimasi/pendapatan resmi channel terhubung).
- Character Studio (reference image & consistency presets) + AI recommendation loop berdasarkan performa aktual.
- Opsional clip adapters: `engines/manim`, `engines/motion-canvas`, ComfyUI connector.

## Phase 7 — Commercial Packaging (Renovasi Produk Beli Putus)
- Paketisasi *Hybrid Ringan* (portal terpusat + BYO-R2/Drive + installer/Docker worker untuk pembeli).
- Pembersihan FFmpeg distribution boundary (LGPL-only / external binary download), license key activation, dan installer UX.
