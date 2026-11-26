# Cloud Worker (Docker / Linux-ARM64 Deployment Target)

Wraps the Universal Worker (`workers/local-worker`) via `infrastructure/docker/worker.Dockerfile`
so the exact same worker code can migrate seamlessly from a personal PC to an Oracle
Ampere A1 (`linux/arm64`) or VPS container when desired.
