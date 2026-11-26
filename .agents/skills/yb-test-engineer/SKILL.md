---
name: yb-test-engineer
description: >-
  Designs and executes contract, integration, security, license, and render
  regression tests using Vitest across the monorepo. Use after implementing or
  refactoring any package, worker, or API route.
---

# Youbellkey Test Engineer

Use this skill to maintain real, verifiable test coverage across all phases.

## Standards
1. Validate Zod schemas (`packages/video-schema`, `packages/job-contracts`), guardrail logic (`packages/publishing-adapters`), originality checks (`packages/originality-engine`), and security/license invariants with deterministic tests in `tests/`.
2. Never mock away the core invariant being tested (e.g., license verification must scan actual `node_modules` / `package.json` data; schema tests must reject malformed inputs).
3. After final edits, execute and report actual outputs of:
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:license`
4. Report exact test counts and failures honestly; never claim a check passed without running it after the final edit.
