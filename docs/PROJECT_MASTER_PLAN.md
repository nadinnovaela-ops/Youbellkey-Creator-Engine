# YOUBELLKEY STUDIO — PROJECT MASTER PLAN (FINAL ALIGNED BLUEPRINT)

## 1. Project Identity & Product Strategy
- **Project Name:** Youbellkey Studio (`Youbellkey Creator Engine`)
- **Product Category:** End-to-End AI Content Operating System (bukan sekadar video generator)
- **Target Tahap Sekarang (V1):** Pemakaian **pribadi** sampai seluruh workflow produksi, kualitas video, dan publikasi matang secara nyata.
- **Target Komersial Masa Depan:** **Produk sekali beli (one-time purchase / beli putus)** dengan arsitektur **Hybrid Ringan** dan **BYOK** (pembeli menanggung API key AI, storage Cloudflare R2/Drive, serta compute render mereka sendiri; portal web/DB ringan tetap di-host secara hemat biaya).
- **Target Konten V1:** **Vertical Short-Form (9:16)** untuk **Bahasa Indonesia & Bahasa Inggris (ID & EN)**, dengan konfigurasi bahasa, locale, dan zona waktu per channel (bukan hardcoded pasar AS saja).

### Kemampuan Inti Sistem
1. **Viral Research & Reference Intelligence:** Pemantauan channel/niche terkurasi (YouTube RSS + YouTube Data API v3 `videos.list`), Outlier Score, Growth Velocity, dan ekstraksi transkrip referensi via worker pribadi (`yt-dlp` + Groq Whisper) pada URL yang dipilih.
2. **AI Content Lab & Originality Engine:** Analisis hook & struktur cerita, generasi skrip multi-bahasa (ID/EN), multi-variasi sudut pandang original, storyboard JSON, dan review risiko hak cipta/repetitif.
3. **Video Factory (2 Jalur Inti V1):**
   - **Jalur A — Code-Driven Motion/Data/3D Explainer:** Kinetic Typography, Data Visualization Charts, dan scene Three.js berparameter ($0 biaya visual).
   - **Jalur B — AI Visual Storytelling / Documentary:** AI Image Generation + animasi kamera HyperFrames + word-synced dynamic subtitles.
4. **Voiceover & Word-Level Captions:** TTS Adapter full-gratis V1 (Google Cloud TTS / Azure Speech F0 + fallback `edge-tts` pribadi) + **Groq Whisper Free API** untuk word-level alignment akurat di ID & EN.
5. **Publishing & Autopilot with Guardrails:** YouTube Shorts V1 dengan mode **Autopilot Langsung** (plus toggle `MANUAL_REVIEW` per channel), validasi media pra-upload, batas kuota harian, *idempotency key*, *kill switch* 1-klik dari smartphone PWA, dan native `publishAt` scheduling.
6. **Analytics & Optimization (Phase 6) + Meta Reels (Phase 4.2):** Integrasi bertahap setelah siklus YouTube Shorts V1 stabil.

---

## 2. Final Architecture Decisions (Aligned Stack)
| Layer | Keputusan Final | Catatan Teknis |
| :--- | :--- | :--- |
| **Control Plane UI & API** | **Next.js App Router + TypeScript (PWA)** di **Vercel** | Menggantikan NestJS terpisah; full online dari HP & PC, biaya server awal $0 |
| **Database, Auth & Queue** | **Supabase (PostgreSQL + Auth + RLS)** + **Atomic Postgres Job Lease Queue** | Menggantikan Redis/BullMQ; worker di balik Wi-Fi rumah mengambil job via HTTPS (`FOR UPDATE SKIP LOCKED`) |
| **Object Storage** | **Cloudflare R2** (S3-compatible, 10 GB gratis + $0 egress) | Presigned URLs langsung untuk preview HP PWA, upload YouTube, dan Meta Reels API; auto-cleanup render lama |
| **Universal Worker (V1)** | **PC/Laptop Pribadi** (Node.js ≥ 22 + HyperFrames + FFmpeg) | Dikemas **Docker / Linux-ARM64-ready** agar siap dipindah ke Oracle Ampere A1 (2 OCPU/12 GB) atau VPS kapan saja |
| **Master Video Renderer** | **HyperFrames** (`Apache-2.0`) + **Three.js** (`MIT`) + **FFmpeg** CLI | **Template-Driven `YB Video Document` JSON + Clip Layering**; Manim/ComfyUI nanti menyuplai klip `.mp4/.png` ke layer HyperFrames |
| **AI Provider Gateway** | **TypeScript-Native AI Adapter** (tanpa Python LiteLLM proxy) | Mendukung BYOK: Gemini, OpenRouter, Groq, OpenAI, Anthropic + Ollama worker di masa depan; pelacakan token & biaya per job |
| **TTS & Word Alignment** | **Cloud TTS Adapter** + **Groq Whisper Free API** | Groq Whisper gratis tanpa kartu kredit (2.000 RPD / 8 jam audio/hari) + Google/Azure TTS free tier + fallback `edge-tts` pribadi |
| **Publishing V1** | **YouTube Data API v3** via Worker Resumable Upload | Worker upload MP4 langsung ke Google (melewati batas payload/timeout Vercel) memakai short-lived access token dari Control Plane |

---

## 3. Architecture Principles
1. **Tenant-Ready Sejak Hari Pertama:** Seluruh tabel bisnis memiliki `workspace_id` + RLS Supabase meskipun V1 hanya dipakai satu pemilik.
2. **Secret Hygiene Mutlak:** BYOK API keys dan OAuth `refresh_token` dienkripsi di database (AES-256-GCM dengan `YB_SECRETS_MASTER_KEY`). Jangan pernah membocorkan secret ke frontend, payload job, atau log.
3. **Resilient Worker Lifecycle:** Worker mendaftar, mengirim heartbeat, mengambil job dengan lease berbatas waktu (*lease TTL*), dan melaporkan progress. Jika laptop mati/tidur mendadak, job otomatis dikembalikan ke antrean setelah lease kedaluwarsa.
4. **Idempotent Publishing & Autopilot Safety:** Setiap publikasi wajib memiliki `idempotency_key` unik, lolos pengecekan media gate (resolusi 9:16, durasi, audio non-silent, subtitle valid), mematuhi batas harian channel, dan menghormati *kill switch* workspace.
5. **No Hidden Stack Drift:** Perubahan arsitektur besar wajib melalui ADR baru di `docs/ADR/`.

---

## 4. Licensing Policy (Ringkasan Wajib)
- **Hijau (Core Allowed):** `MIT`, `Apache-2.0`, `BSD-2/3-Clause`, `ISC`, `Unlicense`.
- **Kuning (Subprocess Boundary Only):** `LGPL` / `GPL` CLI tools (`FFmpeg`, `yt-dlp`) hanya dipanggil sebagai binary eksternal terpisah via subprocess. Untuk distribusi komersial beli putus nanti, dilarang membundel binary FFmpeg berflag `--enable-gpl` (seperti `libx264`).
- **Merah (Dilarang Di-embed):** `AGPL-3.0` (`Postiz`), `GPL-3.0` source embedding (`ComfyUI`, `Blender`, `Kdenlive`), dan `Remotion` sebagai dependency wajib.
- Seluruh dependency wajib tercatat di `THIRD_PARTY_NOTICES.md` dan diverifikasi dengan `npm run test:license`.

---

## 5. Development Rules & Standard Audit Statuses
Setiap audit/tinjauan implementasi memakai status baku:
- `FIXED`
- `PARTIALLY FIXED`
- `NOT FIXED`
- `NOT APPLICABLE`
- `BLOCKED`

Setiap fase wajib memiliki test otomatis yang dijalankan ulang setelah edit terakhir sebelum dinyatakan lulus.

---

## 6. Target Monorepo Structure
Struktur penuh 25+ folder blueprint tetap dipertahankan sebagai peta arsitektur resmi; modul fase lanjut diberi README batas arsitektur yang jelas agar tidak menumpuk kode mati di V1:
- `apps/`: `web/` (Active), `api/` (Reserved ADR-0001), `desktop/` (Reserved Phase 7)
- `workers/`: `local-worker/`, `render-worker/`, `research-worker/`, `publish-worker/`, `cloud-worker/`
- `packages/`: `database/`, `shared-types/`, `job-contracts/`, `ai-gateway/`, `provider-adapters/`, `video-schema/`, `video-templates/`, `originality-engine/`, `publishing-adapters/`, `storage/`, `license-registry/`
- `engines/`: `hyperframes/`, `threejs/`, `ffmpeg/`, `motion-canvas/` (Reserved), `manim/` (Reserved)
- `infrastructure/`: `docker/`, `cloud/`, `local/`, `database/`, `monitoring/`
- `docs/`: Master plan, architecture, roadmap, license policy, security, data model, API contracts, `ADR/`
- `tests/`: `integration/`, `e2e/`, `security/`, `license/`
