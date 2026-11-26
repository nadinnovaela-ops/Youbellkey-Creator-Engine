# Youbellkey Creator Engine (Youbellkey Studio)

**AI Content Operating System** berbasis arsitektur **Hybrid Ringan**:
- **Control Plane (Online 24/7):** Next.js App Router PWA + API di **Vercel** + PostgreSQL/Auth/RLS/Atomic Job Lease Queue di **Supabase**
- **Media Storage:** **Cloudflare R2** (S3-compatible presigned URLs, $0 egress)
- **Universal Worker (PC V1, Docker/ARM64-ready):** Node.js ≥ 22 + **HyperFrames** + **Three.js** + **FFmpeg** + `yt-dlp` (eksternal opsional)
- **Target Konten V1:** Vertical 9:16 Short-Form multi-bahasa (**ID & EN**), dengan **YouTube Shorts Autopilot + Guardrails**

## Struktur Monorepo Target
- `apps/web` — Dashboard & PWA mobile control plane (Vercel)
- `apps/api`, `apps/desktop` — Slot arsitektur target (tidak aktif di V1; lihat `docs/ADR/`)
- `workers/*` — Orkestrasi `local-worker`, `render-worker`, `research-worker`, `publish-worker`, dan `cloud-worker` (Docker ARM64/x64)
- `packages/*` — Kontrak domain, `YB Video Document`, template, TypeScript AI gateway, adapter storage/publishing, database migrations, dan license registry
- `engines/*` — Wrapper mesin `hyperframes`, `threejs`, `ffmpeg`, serta placeholder fase lanjut (`motion-canvas`, `manim`)
- `infrastructure/*` — Konfigurasi Docker, Vercel/Supabase/R2, backup, dan monitoring
- `docs/*` — Master plan, arsitektur, roadmap, kebijakan lisensi, keamanan, data model, API contracts, dan ADRs
- `tests/*` — Integration, E2E, security, dan license compliance tests

## Memulai (Phase 0 Baseline)
```bash
npm install
npm run typecheck
npm run test
npm run test:license
npm run doctor:hyperframes
```

Lihat [PROJECT_MASTER_PLAN.md](./docs/PROJECT_MASTER_PLAN.md) untuk cetak biru lengkap.
