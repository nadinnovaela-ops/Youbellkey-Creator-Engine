# Monitoring & Observability Baseline

- Endpoint health Control Plane: `GET /api/health`
- Worker heartbeat interval: 30 detik (lease TTL 120 detik).
- Seluruh log terstruktur wajib menyamarkan API key, worker token, dan OAuth refresh token.
