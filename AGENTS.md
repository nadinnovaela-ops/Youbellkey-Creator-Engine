# Youbellkey Studio — Workspace Rules (`AGENTS.md`)

Aturan wajib untuk seluruh agen AI dan kontributor di repository `Youbellkey-Creator-Engine`:

1. **Sumber Kebenaran Arsitektur:**
   - Ikuti keputusan di `docs/PROJECT_MASTER_PLAN.md` dan `docs/ADR/*`. Jangan mengubah stack secara diam-diam (mis. menambah NestJS/Redis/Python LiteLLM/Remotion wajib) tanpa membuat ADR baru terlebih dahulu.
   - Control Plane berjalan di **Vercel (Next.js App Router PWA + API)** + **Supabase (PostgreSQL + RLS + Postgres Atomic Job Lease Queue)**.
   - Media & video final disimpan di **Cloudflare R2** sebagai backend utama, atau fallback otomatis **Supabase Storage private bucket** (`ADR-0005`, gratis tanpa kartu kredit, batas 50 MB/file) saat R2 belum aktif—bukan di server lokal tanpa backup.
   - **HyperFrames** adalah master timeline renderer; engine lain (`threejs`, dan kelak `manim`/`motion-canvas`) memproduksi aset atau layer di dalam `YB Video Document`.

2. **Keamanan, Isolasi Tenant & BYOK:**
   - Meskipun V1 dipakai pribadi, seluruh tabel data bisnis wajib menyertakan `workspace_id` dan aturan **Supabase RLS** agar siap berevolusi ke produk sekali beli (*Hybrid Ringan*).
   - Jangan pernah menaruh API key AI, `SUPABASE_SERVICE_ROLE_KEY`, atau OAuth `refresh_token` di kode frontend, log, maupun payload job publik.
   - Proses upload file MP4 berukuran besar ke YouTube dieksekusi oleh Worker memakai token akses jangka pendek—bukan melewati body request serverless Vercel.

3. **Kebijakan Lisensi Ketat:**
   - Jangan menyalin atau menanamkan kode berlisensi **AGPL-3.0** (mis. Postiz) atau **GPL-3.0** (mis. ComfyUI, Blender, Kdenlive) ke source proprietary.
   - **Remotion** dilarang menjadi dependency wajib.
   - Binary eksternal seperti `ffmpeg` (khususnya build `--enable-gpl` seperti `libx264`) dan `yt-dlp` hanya dipanggil sebagai subprocess CLI eksternal; pada tahap distribusi komersial wajib beralih ke build LGPL atau instalasi eksternal terpisah.
   - Sebelum menambah dependency baru, aktifkan skill `yb-license-auditor` dan perbarui `THIRD_PARTY_NOTICES.md`.

4. **Standar Audit & Pengujian:**
   - Gunakan status standar saat melaporkan hasil audit: `FIXED`, `PARTIALLY FIXED`, `NOT FIXED`, `NOT APPLICABLE`, `BLOCKED`.
   - Jangan pernah mengklaim tes lulus kecuali benar-benar dijalankan setelah edit terakhir dan hasilnya terverifikasi langsung.
   - Gunakan custom skills di `.agents/skills/yb-*/SKILL.md` sesuai domain tugas.
