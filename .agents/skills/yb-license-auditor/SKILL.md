---
name: yb-license-auditor
description: >-
  Audits repository, npm/pip dependency, AI model, font, asset, and external
  binary licenses against Youbellkey's commercial distribution rules. Use before
  adopting any new package, engine, asset, or repository.
---

# Youbellkey License Auditor

Use this skill before adding any dependency, model weight, font, media asset, or external tool.

## Steps
1. Read [LICENSE_POLICY.md](../../../docs/LICENSE_POLICY.md) and [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md).
2. Inspect the candidate's root `LICENSE`, `package.json` license field, transitive dependencies, and any bundled binary flags (for `ffmpeg`, check `ffmpeg -version` for `--enable-gpl` / `libx264`).
3. Classify the dependency:
   - **Green (`MIT`, `Apache-2.0`, `BSD`, `ISC`, `Unlicense`):** Approved; record attribution.
   - **Yellow (`LGPL`, `MPL-2.0`):** Allowed only with strict linking/subprocess boundaries and required notices.
   - **Red (`AGPL-3.0`, `GPL-3.0` embedding, mandatory `Remotion`):** Reject source embedding or linking; only external CLI invocation is allowed for personal local execution and must be flagged for Phase 7 commercial cleanup.
4. Run validation after updating dependencies:
   - `npm run test:license`
   - `npm run sbom`
