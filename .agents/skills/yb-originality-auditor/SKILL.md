---
name: yb-originality-auditor
description: >-
  Checks generated scripts, hooks, visuals, and variation batches for excessive
  similarity to source references or repetitive mass-produced patterns. Use when
  building or reviewing Content Regen outputs.
---

# Youbellkey Originality Auditor

Use this skill when generating Content Regen variations or checking scripts in `packages/originality-engine`.

## Checks
1. Compare the generated script against the reference transcript/metadata:
   - Flag excessive n-gram overlap or line-by-line paraphrasing without a fresh angle.
   - Require each variation (when generating 3–5+ concepts) to change structure, hook mechanism, or examples—not just synonyms.
2. Verify YouTube monetization compliance (avoid repetitive mass-produced template spam):
   - Require meaningful narrative or visual value-add per video.
   - Verify media/music/character assets do not copy copyrighted studio IP or unverified audio tracks.
3. Output a structured originality score and clear `PASS` / `REVIEW_REQUIRED` verdict before queuing rendering.
