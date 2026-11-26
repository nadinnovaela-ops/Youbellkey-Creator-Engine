# ADR-0004: Hybrid Research & YouTube Shorts Autopilot dengan Guardrail Wajib

- **Status:** Accepted (2026-11-26)
- **Konteks:** YouTube Data API v3 membatasi `search.list` pada 100 panggilan/hari dan melarang `captions.download` untuk video milik channel lain, sementara `videos.insert` berjalan pada bucket 100 panggilan/hari. Selain itu, pengguna memilih Mode Autopilot Langsung untuk YouTube Shorts V1, dan upload file MP4 lewat serverless Vercel terkena batas payload/timeout.
- **Keputusan:**
  1. **Research Engine V1** memakai **YouTube RSS gratis + `videos.list` batching** (pool 10.000 unit/hari) pada daftar channel/niche terkurasi, serta ekstraksi transkrip referensi di worker (`yt-dlp` + Groq Whisper) hanya untuk URL referensi yang dipilih pengguna.
  2. **Publishing V1** menargetkan **YouTube Shorts Autopilot** terlebih dahulu (Meta Reels di Phase 4.2). Upload MP4 dijalankan oleh `workers/publish-worker` langsung ke YouTube Resumable Upload API memakai short-lived access token dari Control Plane.
  3. Autopilot wajib melewati **Pre-Publish Guardrails**: verifikasi integritas MP4 (`1080x1920`, durasi > 5s, audio non-silent, subtitle valid), batas upload harian channel, `idempotency_key` unik, dan pemeriksaan status *Kill Switch* workspace.
- **Konsekuensi:** Risiko double-upload, upload video rusak/bisu, dan pelanggaran kuota API YouTube diminimalkan secara sistemik.
