---
name: yb-publishing-auditor
description: >-
  Validates YouTube Shorts (and future Meta Reels) pre-publish guardrails,
  OAuth scopes, quota hygiene, idempotency keys, and Autopilot safety gates. Use
  when implementing or testing workers/publish-worker or packages/publishing-adapters.
---

# Youbellkey Publishing Auditor

Use this skill before enabling or modifying automated publishing code.

## Pre-Publish Checklist
1. Verify `kill_switch_active === false` at both workspace and channel levels immediately before token brokerage and before `videos.insert`.
2. Enforce media integrity checks on the final MP4:
   - Resolution matches target (`1080x1920` for 9:16), duration > 5s and <= 180s (Shorts limits), non-silent audio track present, subtitle stream/burned captions present when required.
3. Verify `idempotency_key` uniqueness in `publications` to prevent duplicate uploads across retries.
4. Ensure large MP4 resumable uploads run inside `workers/publish-worker` using short-lived access tokens—never through Vercel serverless request bodies—and respect channel `daily_publish_cap` and YouTube quota limits (`videos.insert` 100/day bucket).
