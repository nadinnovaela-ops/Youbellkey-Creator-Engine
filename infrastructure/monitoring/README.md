# Monitoring & Observability Baseline

- Endpoint health Control Plane: `GET /api/health`
- Worker heartbeat interval: 30 detik (lease TTL 900 detik standar / 1500 detik job berat).
- Seluruh log terstruktur wajib menyamarkan API key, worker token, dan OAuth refresh token.
