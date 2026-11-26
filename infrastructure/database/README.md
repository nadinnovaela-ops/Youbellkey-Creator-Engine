# Database Migrations & Backup Runbook

- Lokasi migrasi utama: `packages/database/supabase/migrations/`
- Seluruh tabel wajib memiliki `workspace_id` + RLS sebelum rilis fase baru.
- Aktifkan backup otomatis Supabase atau ekspor pg_dump berkala sebelum migrasi skema besar.
