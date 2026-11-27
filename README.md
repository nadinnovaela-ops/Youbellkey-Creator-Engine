# Youbellkey Creator Engine (Youbellkey Studio)

**AI Content Operating System** berbasis arsitektur **Hybrid Ringan**:
- **Control Plane (Online 24/7):** Next.js App Router PWA + API di **Vercel** + PostgreSQL/Auth/RLS/Atomic Job Lease Queue di **Supabase**
- **Media Storage:** **Cloudflare R2** (S3-compatible presigned URLs, $0 egress)
- **Universal Worker (PC V1, Docker/ARM64-ready):** Node.js ≥ 22 + **HyperFrames** + **Three.js** + **FFmpeg** + `yt-dlp` (eksternal opsional)
- **Target Konten V1:** Vertical 9:16 Short-Form multi-bahasa (**ID & EN**), dengan **YouTube Shorts Autopilot + Guardrails**

## Prioritas Utama V1 (Personal-First & Full-Gratis)
Fokus sekarang adalah aplikasi **harus bisa dipakai personal terlebih dahulu**, terbukti bekerja dengan banyak fitur, dan **semua berjalan full gratis tanpa perlu berlangganan API berbayar**. Yang dimaksud "gratis" memakai jalur default: Gemini/Groq/OpenRouter *free tier*, TTS/cloud yang ada free tier, Supabase free (termasuk Supabase Storage fallback ADR-0005), dan HyperFrames/Three.js/FFmpeg lokal. Tidak ada fitur yang mengunci pemakaian personal di balik API key berbayar; pembayaran API bersifat opsional (BYOK) hanya untuk pengguna yang butuh kuota lebih.

## Struktur Monorepo Target
- `apps/web` — Dashboard & PWA mobile control plane (Vercel). Ini satu-satunya aplikasi aktif yang dipakai untuk pemakaian personal.
- `apps/api`, `apps/desktop` — **Slot arsitektur (RESERVED, tidak diimplementasikan hingga Phase 7).** Keduanya hanya akan diisi bila diperlukan untuk skema komersial/pelanggan (mis. API publik multi-tenant atau desktop installer BYOK). Untuk pemakaian personal V1, keduanya **tidak dibutuhkan** dan sengaja dibiarkan kosong.
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

## ⚠️ Penting untuk Model AI yang Mengerjakan Proyek Ini

Proyek Youbellkey Studio dikerjakan oleh **banyak model AI berbeda** (Gemini Hydrogen 4, Claude Sonnet 4.6, Opus 4.6, dll.) melalui sesi obrolan yang berbeda. Sebelum melakukan perubahan apa pun:

1. Baca `WORK_HISTORY.md` untuk memahami riwayat pengerjakan terbaru.
2. Baca plan file (`.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md`) untuk memahami tujuan dan tugas yang ditetapkan.
3. Setelah mengedit file, tambahkan blok `## Riwayat Pengerjakan (Work History)` di akhir file yang diedit.
4. Catat entri baru di `WORK_HISTORY.md` (tanggal, model, sesi, instruksi, file yang diedit, aksi, status, waktu mulai dan selesai).
5. Jangan mengubah file tanpa mencatat riwayat terlebih dahulu.

## Riwayat Pengerjakan (Work History)
- [27-11-2026 11:35:22 WIB] Model: Kilo | Sesi: implementasi-plan | Aksi: Menambahkan instruksi multi-model AI dan blok riwayat ke README.md | File: README.md | Status: selesai
- [27-11-2026 15:10:00 WIB] Model: Kilo | Sesi: fase-b-pwa-cancel-k8 | Aksi: Perjelas `apps/api` & `apps/desktop` sebagai RESERVED hingga Phase 7; tambahkan bagian "Prioritas Utama V1 (Personal-First & Full-Gratis)" | File: README.md | Status: selesai
