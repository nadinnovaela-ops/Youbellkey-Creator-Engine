# Rencana Implementasi: Sinkronisasi Multi-Model AI & Perbaikan Youbellkey Studio (Logbook Format)

**Path plan:** `.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md`
**Target repo:** `/home/youbellkey/Documents/Youbellkey-Creator-Engine`
**Dibuat oleh:** Kilo
**Tanggal pembuatan:** 27 November 2026 | 11:33:59 WIB
**Status:** Siap dieksekusi (implementation-ready)

---

## 1. Latar Belakang & Konteks Proyek

Proyek **Youbellkey Studio / Youbellkey Creator Engine** adalah AI Content Operating System untuk konten vertical 9:16 (YouTube Shorts) bahasa Indonesia & Inggris. Arsitektur **Hybrid Ringan**:

- **Control Plane:** Next.js App Router PWA di Vercel + Supabase (PostgreSQL, Auth, RLS, Atomic Job Lease Queue)
- **Media Storage:** Cloudflare R2 (primary) + Supabase Storage private bucket (cardless fallback, ADR-0005)
- **Universal Worker:** PC pribadi / Docker Linux-ARM64 (Node ≥ 22 + HyperFrames + Three.js + FFmpeg + yt-dlp)
- **Renderer Master:** HyperFrames (Apache-2.0) dengan `YB Video Document` JSON v1.0

Dokumen referensi yang sudah ada (26 file `.md`): README, AGENTS.md, PROJECT_MASTER_PLAN, ARCHITECTURE, DATA_MODEL, API_CONTRACTS, ROADMAP, SECURITY, LICENSE_POLICY, THIRD_PARTY_NOTICES, ADR-0001 s/d ADR-0005, dan laporan graphify di `graphify-out/GRAPH_REPORT.md`.

Source code sudah diimplementasikan secara luas (tidak hanya dokumen): 5 worker, 11 paket domain, 2 engine (HyperFrames, FFmpeg), ~30 route API control plane, vault AES-256-GCM, SHA-256 worker token. Proyek berada di akhir **Phase 0**, menuju Phase 1.

---

## 2. Masalah Utama: Pengerjaan oleh Banyak Model AI (Multi-Model AI)

Proyek ini dikerjakan oleh **beberapa model AI berbeda** (Gemini Hydrogen 4, Claude Sonnet 4.6, Opus 4.6) melalui sesi obrolan yang berbeda. Akibatnya sinkronisasi pekerjaan menjadi kacau, ada risiko:

- Kedua model mengerjakan hal yang sama tanpa tahu satu sama lain (duplikasi)
- Satu model mengubah bagian yang sudah dikerjakan model lain tanpa mengetahui riwayat
- Tidak ada catatan siapa, kapan, dan apa yang sudah diubah
- Model baru memulai sesi tanpa konteks yang sama dengan model sebelumnya
- Dokumentasi tidak mencakup riwayat pengerjakan per model

### Kebutuhan wajib yang harus terpenuhi dalam rencana ini:

1. **Setiap model yang mengerjakan sesuatu harus memberi tanda ke bagian riwayat pengerjakan** (work history marker) pada file yang diedit.
2. **Setiap percakapan atau instruksi harus tercatat** dalam dokumen riwayat.
3. **Apa yang dikerjakan harus terdokumentasi** agar model lain (bahkan sesi baru) memahami dengan satu perspektif yang sama.
4. **README.md yang digunakan** harus memberi instruksi ke setiap model bahwa proyek ini dikerjakan oleh banyak model AI, sehingga model baru wajib mencatat riwayat pengerjakan sebelum/melakukan perubahan.
5. **File rencana (plan) ini harus jelas dan ada juga di graphify** (dapat diindeks/di-traverse oleh graphify).

---

## 3. Buku Logbook Pengerjakan (Buku Tamu Karyawan Proyek)

File ini berfungsi sebagai **buku tamu / logbook karyawan** proyek. Setiap aktivitas yang dilakukan oleh model AI harus dicatat di bawah dengan format tabel logbook:

| No | Model AI | Sesi Obrolan | Mulai Aktivitas | Selesai Aktivitas | File yang Dikerjakan | Aktivitas yang Dilakukan | Status |
|----|----------|--------------|-----------------|-------------------|----------------------|--------------------------|--------|
| 1 | Kilo | analisis-dokumen | 27-11-2026 11:13:42 | 27-11-2026 11:35:22 | `.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md` | Analisis 26 file .md, graphify, source code; buat rencana multi-model AI | selesai |
| 2 | Kilo | implementasi-plan | 27-11-2026 11:35:22 | 27-11-2026 11:35:22 | `WORK_HISTORY.md` (baru), `README.md` (diubah) | Buat WORK_HISTORY.md buku logbook; tambah instruksi multi-model AI + blok riwayat ke README.md | selesai |
| 3 | Kilo | implementasi-plan | 27-11-2026 11:35:22 | 27-11-2026 11:45:00 | `.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md` (sudah ada) | Verifikasi plan file terdeteksi graphify (lokasi `.kilo/plans/`) | selesai |
| 4 | Kilo | implementasi-plan | 27-11-2026 11:45:00 | 27-11-2026 11:55:00 | `graphify-out/GRAPH_REPORT.md`, `graphify-out/graphify-out/graph.json` | Jalankan ulang graphify; WORK_HISTORY.md dan plan file terindeks (work_history=6, WORK_HISTORY=2, sinkronisasi=8, multi-ai=2) | selesai |
| 5 | Kilo | audit-phase | 27-11-2026 12:00:00 | 27-11-2026 12:15:00 | `.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md` (bagian 6.5) | Audit 7 phase: bandingkan dokumen/ROADMAP vs kode nyata per phase (Phase 0-4 PARSE, Phase 5-7 BELUM ADA). Catat kesenjangan dan risiko kode danggal agar progres tidak mundur. | selesai |
| 6 | Kilo | fase-implementasi | 27-11-2026 12:30:00 | 27-11-2026 15:20:00 | `apps/web/vercel.json`, `packages/ai-gateway/src/index.ts`, `packages/job-contracts/src/index.ts`, `apps/web/src/app/api/worker/cancel/route.ts`, `apps/web/src/app/api/studio/jobs/[id]/cancel/route.ts`, `apps/web/src/components/StudioDashboard.tsx`, docs (ARCHITECTURE/API_CONTRACTS/monitoring), `THIRD_PARTY_NOTICES.md`, `README.md` | Fase A–D dieksekusi + verifikasi acceptance criteria (typecheck/test/test:license lulus); B1 (cron 2-menit + reclaim-on-overview + cancel worker & PWA + tombol Batalkan), B3 (edge-tts), K1–K5 (TTL sync, endpoint doc, acceptance, yellow licenses, isolated node), K7 (PWA cancel+monitoring), K8 (apps/api/desktop reserved). K6 & B2 pending (refactoring besar / Phase 7). | selesai (K6 & B2 pending) |
| 7 | Kilo | implementasi-visual-looks-remotion | 27-11-2026 16:20:00 | 27-11-2026 16:45:00 | `packages/video-schema/src/index.ts`, `packages/video-templates/src/index.ts`, `engines/threejs/src/index.ts`, `package.json`, `THIRD_PARTY_NOTICES.md`, `WORK_HISTORY.md` | Implementasi 30+ visual look baru (34 total), 10 Three.js preset baru (17 total), Remotion sebagai optionalDependencies (tidak wajib per AGENTS.md). Typecheck, test (23/23), test:license semua lulus. | selesai |
| 8 | Kilo | reorganisasi-studio-dashboard | 27-11-2026 16:50:00 | 27-11-2026 17:10:00 | `apps/web/src/components/StudioDashboard.tsx` | Tambah tab 'create' (Content Lab — Buat Video dari Ide) dengan selector 34 visual look, 10 caption style, 17 Three.js preset; rename tab 'lab' → 'Content Lab Recreate'; tambah handler generateFromCreateIdea. Typecheck, test (23/23) lulus. | selesai |

Format waktu: `DD-MM-YYYY HH:MM:SS` (detik, menit, jam, tanggal, bulan, tahun), zona waktu WIB.

Setiap baris baru ditambahkan di akhir tabel oleh model AI yang melaksanakan tugas.

---

## 4. Desain Solusi: Markering Riwayat Pengerjakan (Work History Marker)

Untuk mengatasi masalah multi-model AI, akan ditetapkan konvensi berikut yang harus diikuti oleh SEMUA model AI yang mengerjakan proyek ini:

### 4.1 Blok Riwayat di Setiap File yang Diedit

Setiap kali sebuah model AI mengedit file source code atau dokumentasi, model tersebut WAJIB menambahkan blok riwayat di bagian bawah file (atau di bagian yang relevan), dengan format:

```
## Riwayat Pengerjakan (Work History)
- [DD-MM-YYYY HH:MM:SS WIB] Model: <nama-model, contoh: Gemini Hydrogen 4 / Claude Sonnet 4.6 / Opus 4.6> | Sesi: <id-sesi-obrolan> | Aksi: <ringkasan singkat apa yang diubah> | File: <path-file> | Status: <selesai/belum-selesai>
```

Contoh:
```
## Riwayat Pengerjakan (Work History)
- 27-11-2026 14:00:00 WIB | Model: Kilo | Sesi: analisis-dokumen | Aksi: Membuat rencana sinkronisasi multi-model AI | File: .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
```

### 4.2 File Rekaman Pusat Riwayat Pengerjakan (`WORK_HISTORY.md`)

Buat file baru di root repo: `WORK_HISTORY.md`

Berfungsi sebagai catatan pusat semua percakapan, instruksi, dan pekerjaan yang dilakukan oleh setiap model AI (buku logbook terpusat). Format entri:

```
## [DD-MM-YYYY HH:MM:SS WIB] - Model: <nama> - Sesi: <id-sesi>
- Mulai: [DD-MM-YYYY HH:MM:SS WIB] | Selesai: [DD-MM-YYYY HH:MM:SS WIB]
- Instruksi/Percakapan: <ringkasan instruksi dari user>
- File yang diedit: <daftar path file>
- Aksi yang dilakukan: <ringkasan>
- Status: <selesai/belum-selesai/blokir>
- Catatan tambahan: <apa pun yang perlu diketahui model berikutnya>
```

### 4.3 Instruksi di README.md

README.md root harus diperbarui dengan bagian baru yang memberi instruksi ke setiap model AI baru:

```
## ⚠️ Penting untuk Model AI yang Mengerjakan Proyek Ini

Proyek Youbellkey Studio dikerjakan oleh **banyak model AI berbeda** (Gemini Hydrogen 4, Claude Sonnet 4.6, Opus 4.6, dll.) melalui sesi obrolan yang berbeda. Sebelum melakukan perubahan apa pun:

1. Baca `WORK_HISTORY.md` untuk memahami riwayat pengerjakan terbaru.
2. Baca plan file ini (`.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md`) untuk memahami tujuan dan tugas.
3. Setelah mengedit file, tambahkan blok `## Riwayat Pengerjakan (Work History)` di akhir file yang diedit.
4. Catat entri baru di `WORK_HISTORY.md` (tanggal, model, sesi, instruksi, file yang diedit, aksi, status, waktu mulai dan selesai).
5. Jangan mengubah file tanpa mencatat riwayat terlebih dahulu.
```

---

## 5. Integrasi Graphify

Rencana dan riwayat pengerjakan harus dapat diakses/diindeks oleh graphify:

- Simpan plan file di `.kilo/plans/` (direktori yang sudah ada dan diacakseby graphify).
- Pastikan `WORK_HISTORY.md` berada di root repo agar terdeteksi dalam corpus graphify.
- Setelah setiap perubahan signifikan, jalankan ulang graphify agar laporan `GRAPH_REPORT.md` mencakup node baru (plan + work history).
- Graphify harus menunjukkan `WORK_HISTORY.md` dan plan sebagai node yang terhubung ke komunitas dokumentasi.

---

## 6. Daftar Bug & Kekurangan yang Perlu Diperbaiki

Berikut adalah temuan dari analisis mendalam dokumen + source code + graphify yang akan dijadikan tugas dalam rencana ini.
### Bug Tinggi Prioritas

| ID | Area | Deskripsi | Dampak |
|----|------|-----------|--------|
| B1 | Worker lease | Tidak ada jadwal cron terjadwal untuk `reclaim_expired_leases()`. RPC ada, dipanggil hanya saat register/claim. Jika worker mati di tengah job dan tidak ada aktivitas baru, lease expired bisa terjebak selamanya. | Job tidak pernah dikembalikan ke antrean |
| B2 | Lisensi komersial (Phase 7) | FFmpeg lokal build dengan `--enable-gpl --enable-libx264 --enable-libx265`. Tidak boleh dibundel dalam installer komersial Phase 7. Harus beralih ke build LGPL-only atau unduhan eksternal. | Melanggar kebijakan lisensi saat komersial |
| B3 | Lisensi TTS | `edge-tts-personal` ditandai `commercialSafe: false`. Harus dinonaktifkan sebelum rilis komersial Phase 7. | Tidak aman untuk produk jualan |

### Kekurangan Sedang Prioritas

| ID | Area | Deskripsi |
|----|------|-----------|
| K1 | Dokumen vs kode | Lease TTL dalam dokumen (120 detik + 30 detik heartbeat) tidak sinkron dengan implementasi aktual (900 detik standard / 1500 detik heavy, heartbeat 10 detik untuk heavy job). |
| K2 | Duplikasi endpoint | Dua route `document/route.ts`: `apps/web/src/app/api/projects/[id]/document/route.ts` dan `apps/web/src/app/api/studio/projects/[id]/document/route.ts`. Potensi inkonsistensi. |
| K3 | Tes acceptance criteria | Phase 0 menyebut `typecheck`, `test`, `test:license`, `doctor:hyperframes` harus lulus, tetapi belum diverifikasi langsung setelah edit terakhir. |
| K4 | Yellow findings lisensi | `@img/sharp-libvips-linux-x64` (LGPL-3.0-or-later) dan `lightningcss` (MPL-2.0) perlu review atributi/boundary sebelum komersial. |

### Kekurangan Rendah Prioritas (Peningkatan Kualitas)

| ID | Area | Deskripsi |
|----|------|-----------|
| K5 | Graphify isolated node | `ADR-0005` dan `../../tsconfig.base.json` adalah isolated node (≤1 koneksi). Perlu disambungkan ke alur sistem atau diberi konteks jelas. |
| K6 | Graphify cohesi rendah | Community 0 (cohesion 0.06) dan Community 1 (cohesion 0.07) terlalu banyak node yang saling kurang terkait. Perlu dipecah menjadi modul lebih kecil. |
| K7 | Dashboard PWA | Hanya `login/page.tsx` dan `StudioDashboard.tsx`. UI monitoring yang disebutkan dokumen masih minimal. |
| K8 | apps/api & apps/desktop | Kosong, hanya slot arsitektur (by design ADR-0001), tapi perlu diklarifikasi apakah akan diimplementasikan. |

---

## 6.5 Audit 7 Phase: Status Nyata vs Dokumen (Sebelum Memperbaiki Bug)

Sebelum memperbaiki bug apa pun, WAJIB dilakukan audit 7 phase untuk mencegah progres mundur. Berikut perbandingan antara **yang dikatakan dokumen/ROADMAP**, **kode nyata yang ada** (berdasarkan bacaan source code), dan **status aktual** per phase. Audit ini bertujuan agar kode yang sudah ada (bahkan kualitasnya dangkal) tidak dihapus atau dianggap dead code oleh model AI baru yang tidak tahu riwayatnya.

### Metode Audit
- Setiap phase dicek terhadap file source code yang nyata di repo (bukan hanya dokumen).
- Status: `SELESAI` (kode lengkap & terverifikasi), `PARSE` (kode ada tapi kualitas dangkal/belum terverifikasi end-to-end), `BELUM ADA` (hanya placeholder/README, kode nyata belum ada), `TIDAK DOKUMENTASI` (ada instruksi perubahan tapi tidak tercantum di dokumen phase).
- Setiap model AI yang melakukan audit phase WAJIB mencatat entri di WORK_HISTORY.md dan blok riwayat di plan file ini.

| Phase | Dokumen/ROADMAP mengatakan | Kode nyata yang ada (evidence) | Status aktual | Risiko kualitas danggal | Tanda riwayat pengerjakan |
|-------|---------------------------|--------------------------------|---------------|-------------------------|---------------------------|
| **Phase 0** Foundation, License Audit & Governance | Monorepo, npm workspaces, TS strict, semua dokumen + ADR, skema Supabase 0001+0002, license-registry, THIRD_PARTY_NOTICES, Acceptance Criteria: typecheck/test/test:license/doctor:hyperframes | `packages/database/supabase/migrations/0001_initial_schema.sql`, `0002_add_reclaim_cron_and_indexes.sql`, `packages/license-registry/src/*`, `THIRD_PARTY_NOTICES.md`, semua dokumen + ADR | **PARSE** | Acceptance criteria belum diverifikasi langsung (K3). Typecheck/test belum dijalankan setelah edit terakhir. | Belum ada (multi-model AI baru mulai mencatat) |
| **Phase 1** Control Plane & Worker Core | Dashboard PWA (apps/web), Supabase Auth, worker registry, claim/heartbeat/progress, local-worker runner, BYOK vault, R2 storage adapter | `workers/local-worker/src/{runner,cli,index}.ts`, `workers/render-worker/src/index.ts`, `apps/web/src/app/api/worker/{register,claim,heartbeat,complete,publish-token,reclaim}`, `apps/web/src/lib/{vault,crypto,worker-auth}.ts`, `packages/storage/src/index.ts`, `apps/web/src/components/StudioDashboard.tsx`, `apps/web/src/app/login/page.tsx` | **PARSE** | Worker loop & API route lengkap, tapi dashboard PWA minimal (hanya login + StudioDashboard, belum ada halaman monitoring job/kill switch/preview lengkap). Belum diverifikasi end-to-end dari HP PWA. | Belum ada |
| **Phase 2** Viral Research & AI Content Lab | research-worker (RSS + Data API, outlier/velocity score), transkrip via yt-dlp + Groq Whisper, Content Regen multi-bahasa, originality check, YB Video Document v1.0 generator | `workers/research-worker/src/{core,transcript,index}.ts`, `packages/ai-gateway/src/{index,tts}.ts`, `packages/originality-engine/src/index.ts`, `packages/video-schema/src/index.ts`, `packages/video-templates/src/index.ts`, route API research | **PARSE** | Research worker & AI gateway lengkap, tapi belum teruji end-to-end dari URL referensi sampai 3-5 variasi skrip yang diedit di PWA. Originality engine hanya trigram (lexical), belum ada verifikasi kualitas LLM. | Belum ada |
| **Phase 3** Video Factory | Adapter Cloud TTS (Google/Azure/edge-tts), Groq Whisper word-level, template kinetic-typography/data-threejs-explainer/ai-visual-storytelling, render 1080x1920 MP4 via HyperFrames + FFmpeg loudness normalization, upload ke R2, preview di PWA | `workers/render-worker/src/index.ts` (executeRenderPipeline lengkap), `engines/hyperframes/src/{compiler,diorama-runtime,character-svg,index,doctor}.ts`, `engines/ffmpeg/src/index.ts`, `packages/ai-gateway/src/tts.ts` | **PARSE** | Render pipeline lengkap (TTS → Whisper → AI image → HyperFrames compile/lint/render → FFmpeg -14 LUFS), tapi belum diverifikasi menghasilkan MP4 9:16 yang putar dari smartphone. FFmpeg build --enable-gpl (B2) risiko lisensi komersial. | Belum ada |
| **Phase 4** Publishing & YouTube Shorts Autopilot | YouTube OAuth2 + short-lived token broker, pre-publish guardrails, resumable upload, publishAt scheduler, retry tanpa double-upload | `workers/publish-worker/src/index.ts`, `packages/publishing-adapters/src/index.ts` (evaluateAutopilotGuardrails, uploadYoutubeResumableVideo, buildYoutubeShortsMetadata), route API publish-token, projects/[id]/publish | **PARSE** | Guardrails & resumable upload lengkap, tapi belum teruji siklus Autopilot end-to-end (termasuk retry tanpa double-upload). Meta Reels (4.2) hanya validate fungsi, belum ada implementasi penuh. | Belum ada |
| **Phase 5** Advanced Research, Analytics & Character Studio | Dashboard YouTube Analytics (CTR, retention, views), Character Studio (reference image & consistency presets), AI recommendation loop | Hanya README placeholder di `engines/manim/README.md`, `engines/motion-canvas/README.md`. Tidak ada source code analytics atau character studio nyata. | **BELUM ADA** | Tidak ada kode. Jika model AI baru menganggap ada kode karakter/analytics dan menghapusnya, tidak ada dampak (kosong). Namun risiko: model baru bisa menambahkan kode danggal tanpa landasan. | Belum ada |
| **Phase 6** Analytics & Optimasi | Integrasi bertahap setelah YouTube Shorts V1 stabil | Tidak ada source code nyata. | **BELUM ADA** | Sama seperti Phase 5. | Belum ada |
| **Phase 7** Commercial Packaging | Paketisasi Hybrid Ringan, portal terpusat + BYO-R2/Drive + installer/Docker worker, pembersihan FFmpeg boundary (LGPL-only), license key activation, installer UX | Tidak ada source code installer. Hanya `apps/desktop/README.md` (reserved), `docs/ADR/0005`, `LICENSE_POLICY.md` (kewajiban Phase 7). | **BELUM ADA** (dokumen saja) | FFmpeg --enable-gpl tidak boleh dibundel (B2). edge-tts harus dimatikan (B3). Belum ada installer code yang bisa dihapus, tapi dokumentasi kebutuhan komersial sudah ada. | Belum ada |

### Temuan Krusial dari Audit
1. **Kesenjangan dokumen vs kode nyata**: Dokumen menyebut proyek di akhir Phase 0, tetapi kode nyata sudah mencakup implementasi Phase 1–4 yang besar. Ini berarti **beberapa model AI sebelumnya telah mengimplementasikan kode melebihi fase yang tercatat di dokumen**, tanpa mengupdate status phase.
2. **Kualitas kode tidak terverifikasi**: Semua kode Phase 1–4 adalah "PARSE" — ada tapi belum diverifikasi end-to-end (typecheck/test belum dijalankan, belum menghasilkan MP4 nyata, belum teruji Autopilot end-to-end).
3. **Tidak ada tanda riwayat pengerjakan**: Belum ada model AI yang mencatat siapa yang mengimplementasikan Phase 1–4, kapan, dan di file mana. Model AI baru berisiko menghapus kode yang sebenarnya sudah ada karena mengira belum ada.
4. **Phase 5–7 hanya dokumentasi**: Tidak ada kode nyata, aman untuk dibangun dari nol, tapi butuh landasan dokumen agar tidak ada duplikasi dengan kode yang sudah ada di Phase 1–4.

### Tindakan Wajib Sebelum Memperbaiki Bug
1. **Jangan menghapus kode Phase 1–4** karena mengira "belum ada" atau "dead code". Kode itu sudah ada (workers, packages, engines, API routes).
2. **Verifikasi dulu** Phase 0 acceptance criteria (typecheck, test, test:license, doctor:hyperframes) sebelum entri ke Fase B (perbaikan bug).
3. **Catat setiap temuan audit** di WORK_HISTORY.md dan blok riwayat di plan file ini agar model AI berikutnya tahu status aktual setiap phase.
4. **Jika model AI baru menemukan instruksi perubahan phase** (misal: "seharusnya fase X sudah selesai"), harus mencatat instruksi tersebut di WORK_HISTORY.md sebelum menindaklanjuti, agar tidak ada instruksi perubahan phase yang tidak terdokumentasi.


## 7. Daftar Tugas (Actionable, Terurut Prioritas)

Setiap tugas harus dilengkapi tanda riwayat pengerjakan dan entri logbook saat dieksekusi oleh model AI.

### Fase A: Infrastruktur Multi-Model AI (Pertama Kali Dilakukan)

1. **A1** — Buat file `WORK_HISTORY.md` di root repo dengan format entri riwayat pengerjakan.
   - Validasi: File ada, format entri jelas, minimal 1 entri contoh.
   - Tanda riwayat: Model yang membuat file harus mencatat di `WORK_HISTORY.md` dan blok akhir file.

2. **A2** — Perbarui `README.md` root: tambahkan bagian "Penting untuk Model AI yang Mengerjakan Proyek Ini" (lihat bagian 4.3 di atas).
   - Validasi: README.md membaca jelas bahwa proyek dikerjakan banyak model AI dan setiap model wajib mencatat riwayat.

3. **A3** — Simpan rencana ini (plan file) di `.kilo/plans/` dan pastikan terdeteksi graphify.
   - Validasi: Plan file ada, bisa dibaca, berada di direktori yang diacakseby graphify.

4. **A4** — Jalankan ulang graphify untuk mencakup `WORK_HISTORY.md` dan plan file di `GRAPH_REPORT.md`.
   - Validasi: Graph report mencakup node WORK_HISTORY.md dan plan sebagai bagian corpus.

### Fase B: Perbaikan Bug Tinggi Prioritas

5. **B1** — Tambahkan jadwal cron / pemicu berkala untuk `reclaim_expired_leases()` di control plane (Vercel) atau worker, sehingga expired lease selalu dikembalikan ke antrean meskipun tidak ada register/claim baru.
   - Validasi: Ada mekanisme terjadwal, lease expired worker mati dikembalikan ke RETRY_PENDING/QUEUED.
   - Status: SELESAI — (a) `apps/web/vercel.json` cron `/api/worker/reclaim` diubah dari `"0 0 * * *"` (harian) menjadi `"*/2 * * * *"` (setiap 2 menit). (b) `apps/web/src/app/api/worker/cancel/route.ts` (baru) — endpoint POST /api/worker/cancel untuk membatalkan job RUNNING yang dipunch worker atau antrean QUEUED/RETRY_PENDING dalam workspace. Skema `CancelJobRequestSchema` ditambahkan ke `packages/job-contracts/src/index.ts`. Verifikasi: typecheck (semua workspace lulus), test (23/23), test:license (passed: true).

6. **B2** — Dokumentasikan dan siapkan strategi penggantian FFmpeg `--enable-gpl` menjadi build LGPL-only atau instalasi eksternal terpisah untuk Phase 7 komersial. Tidak melakukan bundling GPL binary di installer.
   - Validasi: Dokumentasi Phase 7 mencakup keterbatasan FFmpeg GPL dan alternatif LGPL.
   - Status: PARSE (Phase 7 BELUM ADA kode installer) — Engine `engines/ffmpeg/src/index.ts` sudah memanggil ffmpeg sebagai external subprocess CLI (ADR-kompatibel) dan `inspectFfmpegBinary()` melaporkan `commercialBundlingSafe`. Bundling GPL di Phase 7 installer masih harus dicegah saat pengempaan Phase 7.

7. **B3** — Nonaktifkan `edge-tts-personal` sebelum rilis komersial (pastikan `commercialSafe: false` dihormati, jangan dimasukkan ke build komersial).
   - Validasi: edge-tts tidak ada di daftar provider yang digunakan dalam mode komersial.
   - Status: SELESAI — `packages/ai-gateway/src/index.ts` baris 55: `'edge-tts-personal'` dihapus dari `tts_voiceover` preferredProviders (tinggal `google-cloud-tts`, `azure-speech-f0`). Provider tetap terdaftar di registry dengan `commercialSafe: false` agar tidak terpilih secara tidak sengaja.

### Fase C

8. **K1** — Sinkronkan dokumentasi lease TTL (dokumen ARCHITECTURE/ROADMAP) dengan implementasi aktual (900s standard / 1500s heavy), atau sebaliknya, agar tidak menyesatkan.
   - Validasi: Dokumen dan kode sebut angka TTL yang sama.
   - Status: SELESAI — `docs/ARCHITECTURE.md` baris 41-42 diubah dari 120 detik menjadi 900 detik standar / 1500 detik heavy, `docs/API_CONTRACTS.md` baris 8 `lease_ttl_seconds` diubah dari 120 menjadi 900, `infrastructure/monitoring/README.md` baris 4 diubah dari 120 detik menjadi 900/1500 detik.

9. **K2** — Unifikasi atau hapus duplikasi endpoint `projects/[id]/document` vs `studio/projects/[id]/document`. Pilih satu kanonis, arahkan yang lain ke kanonis atau hapus.
   - Validasi: Hanya satu endpoint kanonis untuk edit YB Video Document.
   - Status: SELESAI — `apps/web/src/app/api/projects/[id]/document/route.ts` hanya re-export (`export { PATCH } from '../../../studio/projects/[id]/document/route'`). Implementasi kanonis tunggal ada di `apps/web/src/app/api/studio/projects/[id]/document/route.ts`. Tidak ada duplikasi logika.

10. **K3** — Jalankan `npm run typecheck`, `npm run test`, `npm run test:license`, `npm run doctor:hyperframes` dan verifikasi seluruhnya lulus. Catat hasil di WORK_HISTORY.md.
    - Validasi: Semua perintah acceptance criteria Phase 0 lulus dan tercatat.
    - Status: SELESAI — typecheck (semua workspace lulus), test (23/23 lulus), test:license (passed: true, 168 green / 3 yellow / 0 red), doctor:hyperframes (FFmpeg/Chrome/Docker OK; whisper-cpp, Kokoro TTS, MusicGen opsional tidak terinstal). Hasil tercatat WORK_HISTORY.md Entri 7.

11. **K4** — Lakukan review atributi/boundary untuk yellow findings (`sharp-libvips-linux-x64` LGPL, `lightningcss` MPL). Perbarui `THIRD_PARTY_NOTICES.md` jika diperlukan.
    - Validasi: NOTICES mencakup atributi yellow findings, test:license lulus.
   - Status: SELESAI — `THIRD_PARTY_NOTICES.md` bagian 3 diperbarui dengan ringkasan boundary/atribusi untuk 3 yellow findings (`@img/sharp-libvips-linux-x64` LGPL-3.0-or-later, `lightningcss` MPL-2.0, `lightningcss-linux-x64-gnu` MPL-2.0). Kesimpulan review: tidak ada kewajiban copyleft terpicu (tidak dimodifikasi, tidak didistribusikan dalam bentuk sumber), test:license lulus (passed: true, 168 green / 3 yellow / 0 red).

### Fase D: Peningkatan Kualitas (Rendah Prioritas)

12. **K5** — Sambungkan isolated node `ADR-0005` dan `../../tsconfig.base.json` ke komunitas dokumentasi yang relevan (referensi dari dokumen utama atau komentar di file).
    - Validasi: Graphify menunjukkan node tersebut tidak lagi isolated (lebih dari 1 koneksi).
    - Status: SELESAI — `docs/ARCHITECTURE.md` diagram Layer 3 menambahkan referensi ke ADR-0005 (Supabase Storage fallback). `tsconfig.base.json` sudah terhubung melalui `tsconfig.json` root (`extends: "./tsconfig.base.json"`). `PROJECT_MASTER_PLAN.md:27` sudah mereferensikan ADR-0005.

13. **K6** — Pecah Community 0 dan Community 1 (menurut saran graphify) menjadi modul lebih kecil dan terfokus agar cohesi meningkat.
    - Validasi: Graph report berikutnya menunjukkan cohesi yang lebih baik untuk komunitas terkait.
    - Status: PENDING — Refactoring besar, butuh analisis komunitas graphify lanjutan dan pemutusan modul. Jadwalkan di sesi refactoring terpisah.

14. **K7** — Lengkapi halaman PWA monitoring dashboard (selain login + StudioDashboard) agar monitoring job, kill switch, dan preview berfungsi sesuai dokumen.
    - Validasi: Dashboard PWA menampilkan daftar job, status worker, dan tombol kill switch.
    - Status: SELESAI — `StudioDashboard.tsx` sudah memiliki tab Jobs (daftar job + progress + status worker + retry), Kill Switch banner, tab Workers, preview MP4, plus kini tombol "Batalkan Job" (via `/api/studio/jobs/[id]/cancel` auth-user). Menutup keluhan user tidak bisa membatalkan running/antrean dari PWA.

15. **K8** — `apps/api` & `apps/desktop` kosong, hanya slot arsitektur (by design ADR-0001), tapi perlu diklarifikasi apakah akan diimplementasikan.
    - Validasi: Keputusan dokumentasi apakah apps/api dan apps/desktop akan diimplementasikan atau dihapus.
    - Status: SELESAI — README diperjelas: `apps/api` & `apps/desktop` RESERVED hingga Phase 7 (hanya diisi bila perlu untuk skema komersial/pelanggan), tidak dibutuhkan untuk personal V1. Ditambahkan pernyataan "Prioritas Utama V1 (Personal-First & Full-Gratis)".

---

## 8. Aturan Kerja untuk Setiap Model AI (Wajib Dibaca Sebelum Mengedit)

Setiap model AI yang akan bekerja pada repo ini, terlepas dari sesi obrolan, WAJIB:

1. **Baca `WORK_HISTORY.md` terlebih dahulu** untuk memahami apa yang sudah dilakukan dan apa yang masih pending.
2. **Baca plan file ini** (`.kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md`) untuk memahami tujuan dan tugas yang ditetapkan.
3. **Tambahkan blok riwayat** di akhir setiap file yang diedit:
   ```
   ## Riwayat Pengerjakan (Work History)
   - [DD-MM-YYYY HH:MM:SS WIB] Model: <nama-model> | Sesi: <id-sesi> | Aksi: <ringkasan> | File: <path> | Status: <selesai/belum-selesai>
   ```
4. **Catat entri baru di `WORK_HISTORY.md`** dengan tanggal, model, sesi, instruksi user, file yang diedit, aksi, status, waktu mulai dan selesai.
5. **Tambahkan baris baru di tabel logbook di bagian 3** dari plan file ini (jika plan file diedit oleh model yang sama).
6. **Jangan mengedit file** tanpa mencatat riwayat terlebih dahulu di WORK_HISTORY.md.
7. **Jika ada tugas yang sudah dikerjakan model lain**, periksa WORK_HISTORY.md sebelum mulai untuk menghindari duplikasi.
8. **Jika menemukan inkonsistensi atau bug baru**, tambahkan entri di WORK_HISTORY.md dan, jika perlu, perbarui plan file ini.

---

## 9. Definisi Selesai (Definition of Done) untuk Rencana Ini

Rencana ini dianggap selesai ketika:

- `WORK_HISTORY.md` dibuat dan diformat dengan benar di root repo.
- Tabel logbook di bagian 3 plan file diisi oleh setiap model yang bekerja.
- `README.md` sudah memiliki instruksi multi-model AI.
- Plan file ada di `.kilo/plans/` dan terindeks graphify.
- Graphify dijalankan ulang dan mencakup WORK_HISTORY.md + plan.
- Cron/jadwal reclaim lease diterapkan (B1).
- Strategi FFmpeg non-GPL untuk Phase 7 didokumentasi (B2).
- edge-tts dinonaktifkan untuk komersial (B3).
- Lease TTL disinkronkan antara dokumen dan kode (K1).
- Duplikasi endpoint document diunifikasi (K2).
- `typecheck`, `test`, `test:license`, `doctor:hyperframes` semua lulus dan tercatat (K3).
- Yellow findings ditinjau dan NOTICES diperbarui (K4).
- Isolated node ADR-0005 dan tsconfig.base.json disambungkan (K5).
- Setiap tugas yang dilakukan dilengkapi tanda riwayat pengerjakan di file terkait dan WORK_HISTORY.md.

---

## 10. Pertanyaan Terbuka (Belum Dioptimalkan) — DIRISOLVEDI

| No | Pertanyaan | Jawaban / Keputusan | Dampak ke Rencana |
|----|-----------|---------------------|-------------------|
| 1 | Apakah model AI yang akan melanjutkan bekerja dalam sesi yang sama atau selalu sesi baru? | **Selalu sesi baru.** Anggap setiap percakapan adalah sesi baru tanpa konteks bawaan. | `WORK_HISTORY.md` berfungsi sebagai **memori proyek tunggal** yang harus dibaca oleh setiap model baru sebelum mengedit apa pun. Plan file ini juga harus selalu dibaca. |
| 2 | Apakah ada ID sesi obrolan yang harus digunakan secara konsisten, atau setiap model boleh generate sendiri? | **Tidak ada ID wajib.** Setiap model boleh generate sendiri (contoh: `analisis-dokumen`, `implementasi-plan`, `audit-phase`). ID wajib hanya jika dirasa perlu di kemudian hari. | Tidak perlu generate ID konsisten. Tabel logbook di bagian 3 pakai nama sesi bebas yang deskriptif. |
| 3 | Untuk B1 (cron reclaim lease), apakah user prefers pemicu melalui Vercel Cron, worker internal, atau Supabase pg_cron? | **Belum diketahui preferensi user.** Namun dikonfirmasi bug sangat mengganggu: antrean kadang selalu 0% padahal tidak ada yang running/dikerjakan, dan tidak bisa membatalkan running atau antrean → memicu celah bug baru. | **TUNTAS (kini).** (1) Vercel Cron `apps/web/vercel.json`: `*/2 * * * *` (setiap 2 menit). (2) Auto-reclaim saat overview dimuat (`/api/studio/overview` memanggil `reclaim_expired_leases`). (3) Endpoint cancel worker `/api/worker/cancel` (worker token) + endpoint cancel PWA `/api/studio/jobs/[id]/cancel` (Supabase Auth) untuk membatalkan QUEUED/RUNNING/RETRY_PENDING/PUBLISHING. (4) Tombol "Batalkan Job" di StudioDashboard. Worker RUNNING yang dibatalkan berhenti otomatis pada heartbeat berikutnya (runner.ts abort pada 409/JOB_LEASE_LOST). |
| 4 | Apakah `apps/api` dan `apps/desktop` harus diimplementasikan segera atau tetap reserved hingga Phase 7? | **Tetap reserved hingga Phase 7.** Prioritas sekarang: aplikasi bisa digunakan personal dengan banyak fitur, semua full gratis tanpa langganan API tertentu. Jika `apps/api` dan `apps/desktop` berkaitan dengan pelanggan komersial, diperjelas dalam dokumentasi. | `apps/api` & `apps/desktop` ditandai reserved (by design ADR-0001). Tidak ada implementasi segera. Dokumentasi diubah untuk menjelaskan ini hanya slot arsitektur, akan diisi di Phase 7 jika diperlukan untuk pelanggan komersial. |

### Catatan Tambahan dari User
- **Bug B1 tetap mencolok meskipun cron sudah diatur setiap 2 menit:** antrean kadang selalu 0% padahal tidak ada job yang RUNNING, dan user tidak bisa membatalkan running atau antrean. Ini celah bug baru yang perlu ditangani selain cron reclaim.
- **Komunikasi resolusi bug:** User meminta agar setiap bug yang diselesaikan diberitahukan dengan jelas (tidak tersirat).

## Riwayat Pengerjakan (Work History)
- [27-11-2026 11:13:42 WIB] Model: Kilo | Sesi: analisis-dokumen | Aksi: Analisis 26 file .md, graphify, source code; buat rencana multi-model AI | File: .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
- [27-11-2026 11:35:22 WIB] Model: Kilo | Sesi: implementasi-plan | Aksi: Buat WORK_HISTORY.md buku logbook; tambah instruksi multi-model AI + blok riwayat ke README.md; perbarui tabel logbook plan file | File: WORK_HISTORY.md, README.md, .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
- [27-11-2026 11:45:00 WIB] Model: Kilo | Sesi: implementasi-plan | Aksi: Verifikasi plan file terdeteksi graphify di `.kilo/plans/` | File: .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
- [27-11-2026 11:55:00 WIB] Model: Kilo | Sesi: implementasi-plan | Aksi: Jalankan ulang graphify; WORK_HISTORY.md dan plan file terindeks dalam graph.json | File: graphify-out/GRAPH_REPORT.md, graphify-out/graphify-out/graph.json | Status: selesai
- [27-11-2026 12:00:00 WIB] Model: Kilo | Sesi: audit-phase | Aksi: Audit 7 phase (bagian 6.5): bandingkan dokumen/ROADMAP vs kode nyata. Temuan: Phase 0-4 PARSE (kode ada tapi belum diverifikasi end-to-end), Phase 5-7 BELUM ADA (hanya dokumen). Tidak ada tanda riwayat pengerjakan sebelumnya. | File: .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
- [27-11-2026 12:30:00 WIB] Model: Kilo | Sesi: fase-b-bugfix | Aksi: B1 (vercel.json cron harian → setiap 2 menit), B3 (hapus edge-tts-personal dari tts_voiceover preferredProviders) | File: apps/web/vercel.json, packages/ai-gateway/src/index.ts | Status: selesai
- [27-11-2026 13:00:00 WIB] Model: Kilo | Sesi: verifikasi-acceptance-criteria | Aksi: typecheck (lulus semua workspace), test (23/23), test:license (passed: true), doctor:hyperframes (OK) | File: (tidak ada, hanya menjalankan perintah) | Status: selesai
- [27-11-2026 13:20:00 WIB] Model: Kilo | Sesi: fase-c-k1-k2 | Aksi: K1 (sync TTL docs: 120s → 900/1500s di ARCHITECTURE, API_CONTRACTS, monitoring README), K2 (verifikasi re-export document endpoint) | File: docs/ARCHITECTURE.md, docs/API_CONTRACTS.md, infrastructure/monitoring/README.md | Status: selesai
- [27-11-2026 13:40:00 WIB] Model: Kilo | Sesi: fase-c-k4 | Aksi: K4 (review yellow findings: sharp-libvips LGPL, lightningcss MPL; perbarui THIRD_PARTY_NOTICES.md) | File: THIRD_PARTY_NOTICES.md | Status: selesai
- [27-11-2026 14:00:00 WIB] Model: Kilo | Sesi: fase-d-k5 | Aksi: K5 (tambah referensi ADR-0005 di ARCHITECTURE.md diagram; tsconfig.base.json sudah terhubung via root tsconfig.json) | File: docs/ARCHITECTURE.md | Status: selesai
- [27-11-2026 14:30:00 WIB] Model: Kilo | Sesi: resolve-open-questions | Aksi: Resolvahkan 4 pertanyaan terbuka di Section 10; catat B1 bug mencolok (antrean 0%, tidak bisa cancel); keputusan apps/api & apps/desktop reserved; klarifikasi WORK_HISTORY.md sebagai memori proyek untuk sesi baru | File: .kilo/plans/1795778022835-multi-ai-sinkronisasi-proyek.md | Status: selesai
- [27-11-2026 14:55:00 WIB] Model: Kilo | Sesi: fase-b-b1-cancel | Aksi: B1 selesai sepenuhnya — endpoint POST /api/worker/cancel untuk membatalkan job RUNNING/QUEUED/RETRY_PENDING; skema CancelJobRequestSchema ditambahkan ke job-contracts | File: apps/web/src/app/api/worker/cancel/route.ts, packages/job-contracts/src/index.ts | Status: selesai
- [27-11-2026 15:20:00 WIB] Model: Kilo | Sesi: fase-b-pwa-cancel-k8 | Aksi: Endpoint cancel PWA auth-user /api/studio/jobs/[id]/cancel + tombol "Batalkan Job" di StudioDashboard (menutup keluhan stuck 0% & tidak bisa cancel dari PWA); README: apps/api & apps/desktop RESERVED + prioritas V1 Personal-First Full-Gratis; K7 & K8 → SELESAI | File: apps/web/src/app/api/studio/jobs/[id]/cancel/route.ts, apps/web/src/components/StudioDashboard.tsx, README.md | Status: selesai
- [27-11-2026 16:45:00 WIB] Model: Kilo | Sesi: implementasi-visual-looks-remotion | Aksi: 30+ visual look baru (34 total di VISUAL_LOOKS_CATALOG), 10 Three.js preset baru (17 total di THREEJS_PRESETS), Remotion sebagai optionalDependencies (tidak wajib per AGENTS.md). Perbarui VisualStyleSchema, CaptionStyleSchema, ThreeJsPresetEnum di video-schema; CAPTION_STYLE_PRESETS di video-templates; exportYBVideoDocumentToMotionMd; THIRD_PARTY_NOTICES.md. Verifikasi: typecheck (lulus semua workspace), test (23/23), test:license (passed: true, 168 green / 3 yellow / 0 red). | File: packages/video-schema/src/index.ts, packages/video-templates/src/index.ts, engines/threejs/src/index.ts, package.json, THIRD_PARTY_NOTICES.md | Status: selesai
- [27-11-2026 17:10:00 WIB] Model: Kilo | Sesi: reorganisasi-studio-dashboard | Aksi: Tambah tab 'create' (Content Lab — Buat Video dari Ide) dengan selector 34 visual look, 10 caption style, 17 Three.js preset; rename tab 'lab' → 'Content Lab Recreate'; tambah handler generateFromCreateIdea. Typecheck (lulus semua workspace), test (23/23). | File: apps/web/src/components/StudioDashboard.tsx | Status: selesai

