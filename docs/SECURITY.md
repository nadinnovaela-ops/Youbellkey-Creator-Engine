# Youbellkey Studio — Security & Threat Model

## 1. Boundary Keamanan Sistem
- **Frontend (`apps/web` PWA):** Hanya berkomunikasi dengan API Control Plane via Supabase Auth JWT. Tidak pernah memiliki akses langsung ke `SUPABASE_SERVICE_ROLE_KEY`, `YB_SECRETS_MASTER_KEY`, OAuth `refresh_token`, atau BYOK API keys mentah.
- **Database (`Supabase PostgreSQL`):** Seluruh tabel bisnis memakai `workspace_id` + **Row Level Security (RLS)**. Operasi sensitif worker (claim job, update status, ambil short-lived access token) dilakukan lewat Vercel server routes menggunakan Service Role setelah memverifikasi token worker terenkripsi (SHA-256 hash di tabel `workers`).
- **Secrets Vault:** API key AI (Gemini, Groq, OpenRouter, Azure/Google TTS), kredensial R2, dan OAuth `refresh_token` YouTube/Meta dienkripsi dengan **AES-256-GCM** (`iv + authTag + ciphertext`) menggunakan `YB_SECRETS_MASTER_KEY` di sisi server Vercel.

## 2. Threat Model & Mitigasi Utama

| Ancaman | Dampak | Mitigasi Wajib |
| :--- | :--- | :--- |
| **Kebocoran API Key AI / OAuth Token** | Penyalahgunaan kuota AI & pembajakan channel YouTube | Enkripsi AES-256-GCM di DB; masking di UI; dilarang log token; worker hanya menerima *short-lived OAuth access token* per job publish dan tidak menyimpan `refresh_token` permanen. |
| **Cross-Tenant Data Leak (Persiapan Komersial)** | Pembeli A membaca aset/channel/key milik Pembeli B | Kolom `workspace_id` + Supabase RLS aktif sejak Phase 0 pada semua tabel; path R2 diprefix `workspaces/{workspace_id}/`. |
| **Double Upload Akibat Retry Worker** | Video kembar ter-upload ke YouTube -> risiko spam policy | `idempotency_key` unik pada tabel `publications` dan pengecekan status sebelum memanggil `videos.insert`. |
| **Autopilot Merusak Channel** | Video rusak/bisu/tanpa subtitle atau spam upload berlebih | Pre-publish gate memblokir upload jika durasi < 5s, audio silent, subtitle kosong, atau kuota harian channel terlampaui; plus **Kill Switch** global/per-channel di PWA. |
| **Eksekusi Kode HTML/JS Berbahaya di HyperFrames** | SSRF / akses file lokal PC oleh HTML hasil LLM | V1 memakai **Template-Driven `YB Video Document`** (bukan HTML bebas dari LLM); worker merender di direktori temp terisolasi tanpa kredensial env. |
| **Worker Token Dicuri** | Penyerang memalsukan hasil render / mencuri job | Token worker disimpan sebagai hash SHA-256 di DB, memiliki rotasi/revokasi 1-klik dari PWA, dan hanya berhak atas job dalam `workspace_id` miliknya. |
