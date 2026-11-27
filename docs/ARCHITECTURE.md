# Youbellkey Studio — Architecture Specification

## 1. High-Level Topology (`Hybrid Ringan`)

```text
+-------------------------------------------------------------------+
| Layer 1: User Interface (Smartphone PWA & Desktop Browser)       |
| - Next.js App Router PWA (apps/web)                              |
| - Monitoring job, edit YB Video Document JSON, Kill Switch       |
+---------------------------------+---------------------------------+
                                  | HTTPS / Supabase Auth
                                  v
+-------------------------------------------------------------------+
| Layer 2: Cloud Control Plane (Vercel + Supabase, 24/7 Online)     |
| - Next.js API Route Handlers (/api/worker/*, /api/channels/*)     |
| - Supabase PostgreSQL + RLS (workspace_id isolation)              |
| - Postgres Atomic Job Lease Queue (claim_next_job RPC)            |
| - Encrypted Secrets Vault (BYOK AI Keys & OAuth Refresh Tokens)   |
+---------------------------------+---------------------------------+
           |                                          ^
           | HTTPS Poll / Claim Lease                 | Presigned PUT/GET
           v                                          |
+---------------------------------+      +--------------------------+
| Layer 3: Universal Worker (PC   |      | Cloudflare R2            |
| V1 / Docker ARM64 Oracle/VPS)   |----->| - Assets (images/audio)  |
| - workers/local-worker          |      | - Rendered MP4 (9:16)    |
| - workers/render-worker         |      | - Auto-cleanup policy    |
|   -> engines/hyperframes        |      +--------------------------+ (Fallback: Supabase Storage, lihat ADR-0005)|
|   -> engines/threejs            |                   |
|   -> engines/ffmpeg             |                   v
| - workers/research-worker       |      +--------------------------+
|   -> YouTube RSS + Data API     |      | Publishing Destinations  |
|   -> Optional yt-dlp + Whisper  |      | - YouTube Shorts (V1)    |
| - workers/publish-worker        |----->| - IG / FB Reels (Phase 4)|
+---------------------------------+      +--------------------------+
```

## 2. Alur Eksekusi Hybrid Worker (Lease & Heartbeat)
1. Control Plane membuat job di tabel `jobs` (`status = 'QUEUED'`).
2. `local-worker` (atau `cloud-worker`) memanggil `POST /api/worker/claim` dengan daftar kapabilitasnya (`['render', 'research', 'publish']`).
3. Supabase RPC `claim_next_job` memakai `SELECT ... FOR UPDATE SKIP LOCKED` untuk mengunci 1 job yang cocok, mengubah status menjadi `'RUNNING'`, dan mengisi `lease_expires_at = now() + interval '900 seconds'` (standar) atau `'1500 seconds'` untuk job berat (`RENDER_HYPERFRAMES`, `PUBLISH_YOUTUBE_SHORTS`).
4. Selama eksekusi (render HyperFrames, encoding FFmpeg, upload YouTube), worker mengirim heartbeat setiap 30 detik ke `POST /api/worker/heartbeat` untuk memperpanjang lease (rolling window 1500 detik) dan melaporkan progress (`0..100%`).
5. Jika laptop mati/tidur mendadak, fungsi pemulihan `reclaim_expired_leases` mendeteksi `lease_expires_at < now()`, menaikkan `attempt_count`, dan mengembalikan job ke `RETRY_PENDING` / `QUEUED` (atau `FAILED` jika melewati `max_attempts`).

## 3. Master Timeline & Clip Layering (`YB Video Document`)
- **HyperFrames** adalah satu-satunya master timeline renderer di V1.
- `YB Video Document` adalah kontrak JSON berversi (`schema_version: "1.0"`) yang berisi metadata proyek (`9:16`, `1080x1920`, `fps: 30`, `locale: 'id-ID' | 'en-US'`), daftar scene terstruktur, gaya template (`kinetic-typography`, `data-threejs-explainer`, `ai-visual-storytelling`), track voiceover, dan array word-level caption timestamps.
- Engine eksternal di masa depan (**Manim**, **Motion Canvas**, **ComfyUI**, **AI Video API**) menghasilkan aset media (`.mp4` / `.png`) yang disisipkan sebagai background/overlay layer di dalam `YB Video Document`, sehingga tidak memerlukan abstraksi silang yang rapuh.

## 4. Batas Vercel Serverless vs Worker
- **Dijalankan di Vercel API:** Auth, manajemen channel, CRUD proyek/naskah, pemanggilan LLM teks singkat (script generation & originality check), penandatanganan presigned URL R2, pencatatan job/heartbeat, dan YouTube/Meta lightweight metadata/analytics.
- **Wajib Dijalankan di Worker:** Rendering `hyperframes` (Node ≥ 22 + headless Chromium + Three.js), pemrosesan `ffmpeg`, upload MP4 berukuran besar (`videos.insert` resumable upload ke YouTube), serta ekstraksi media `yt-dlp` untuk URL referensi yang dipilih pengguna.
