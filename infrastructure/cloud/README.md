# Cloud Control Plane Infrastructure (Vercel + Supabase + Cloudflare R2)

1. **Vercel (`apps/web`):** Deploy Next.js App Router PWA + API Route Handlers.
2. **Supabase (`packages/database`):** Apply `supabase/migrations/0001_initial_schema.sql`.
3. **Cloudflare R2 (`packages/storage`):** Create private bucket (`youbellkey-media`) with lifecycle auto-cleanup rule for expired staging assets.
