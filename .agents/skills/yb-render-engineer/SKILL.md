---
name: yb-render-engineer
description: >-
  Builds, optimizes, and debugs HyperFrames templates, Three.js 3D scenes,
  word-synced captions, and FFmpeg post-processing pipelines. Use when modifying
  packages/video-templates, engines/hyperframes, engines/threejs, or workers/render-worker.
---

# Youbellkey Render Engineer

Use this skill when working on HyperFrames rendering, Three.js presets, subtitle timing, or FFmpeg encoding.

## Rules
1. HyperFrames (`engines/hyperframes`) is the master deterministic frame-by-frame renderer; keep templates self-contained without fragile external CDN runtime fetches that can hang headless Chrome.
2. Sync word-level captions (`id-ID` and `en-US`) strictly from alignment timestamps (Groq Whisper or native TTS word boundaries); verify safe margins for YouTube Shorts UI overlays (top/bottom/right action buttons).
3. Enforce clean resource cleanup: close headless Chromium pages/browsers and clean temp directories after every job, including failure paths.
4. Run `npm run doctor:hyperframes` and render verification tests whenever modifying renderer or template code.
