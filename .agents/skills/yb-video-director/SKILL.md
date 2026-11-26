---
name: yb-video-director
description: >-
  Converts research insights, topics, and multi-language (ID & EN) scripts into
  structured Template-Driven YB Video Document v1.0 plans. Use when designing
  hooks, storyboards, or video template schemas.
---

# Youbellkey Video Director

Use this skill when generating or validating a storyboard and `YB Video Document` JSON (`packages/video-schema`).

## Guidelines
1. Target **9:16 vertical short-form (`1080x1920`, `30fps`)** unless a project explicitly requests another profile.
2. Respect the project's `locale` (`id-ID` or `en-US`)—do not default Indonesian channels to US English idioms or timezones.
3. Produce structured scenes targeting one of the two V1 tracks:
   - `MOTION_EXPLAINER`: Kinetic Typography, Data Visualization Charts, or parameterized Three.js 3D props.
   - `AI_STORYTELLING`: AI-generated scene illustrations with explicit camera motion (`ken-burns`, `pan`, `zoom`) and mood directives.
4. Keep the opening hook within the first 2.5 seconds and validate the JSON output with `YBVideoDocumentSchema` from `packages/video-schema`.
