# ADR-0001: Arsitektur Hybrid Ringan (Vercel + Supabase + Cloudflare R2 + Universal Worker)

- **Status:** Accepted (2026-11-26)
- **Konteks:** Blueprint awal mengusulkan `NestJS + Redis + BullMQ + Tauri Desktop + Cloud VPS` sejak hari pertama. Sementara arah produk ditetapkan untuk: (1) matang dipakai pribadi dulu dengan biaya infra awal $0 dan akses full online dari smartphone & PC, lalu (2) berevolusi ke produk **sekali beli (beli putus)** di mana pembeli membayar API key, storage, dan render compute mereka sendiri.
- **Keputusan:**
  1. Control Plane dijalankan di **Vercel (Next.js App Router PWA + API)** + **Supabase (PostgreSQL, Auth, RLS)**.
  2. Mengganti **NestJS + Redis + BullMQ** dengan **Postgres Atomic Job Lease Queue** (`SELECT ... FOR UPDATE SKIP LOCKED`) yang diakses worker via HTTPS.
  3. Media dan video hasil render disimpan di **Cloudflare R2** (10 GB gratis, $0 egress, presigned HTTPS URLs).
  4. Render Worker V1 dijalankan di **PC/Laptop pribadi** sebagai Universal Node Worker (`workers/local-worker`) yang kompatibel Docker/Linux-ARM64 agar kelak dapat dipindah ke Oracle Ampere A1 atau VPS tanpa mengubah kontrak Control Plane.
  5. Folder `apps/api` dan `apps/desktop` tetap dicatat di struktur target sebagai slot arsitektur masa depan (tidak diimplementasikan sebagai NestJS/Tauri di V1).
- **Konsekuensi:** Biaya server tetap $0 pada fase awal, worker aman di balik NAT rumah tanpa ekspos port Redis, dan jalur migrasi ke produk beli putus tetap bersih berkat kolom `workspace_id` + RLS.
