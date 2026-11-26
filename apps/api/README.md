# apps/api (Reserved Architectural Boundary — ADR-0001)

Per ADR-0001, the standalone NestJS API server was replaced by Next.js App Router
Route Handlers (`apps/web/src/app/api/*`) + Supabase PostgreSQL RPCs so the
Control Plane deploys serverless-first at $0 backend VPS cost.
