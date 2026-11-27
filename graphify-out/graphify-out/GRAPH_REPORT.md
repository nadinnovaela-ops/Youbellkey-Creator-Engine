# Graph Report - graphify-out  (2026-11-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 968 nodes · 1841 edges · 72 communities (63 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f1d874fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- jsonError
- runner.ts
- ai-gateway/src/index.ts
- contracts.test.ts
- compiler.ts
- package.json
- StudioDashboard
- license-registry/src/index.ts
- web/package.json
- local-worker/package.json
- render-worker/src/index.ts
- ai-gateway/package.json
- paths
- render-worker/package.json
- hyperframes/package.json
- threejs/package.json
- steps
- compilerOptions
- tts.ts
- storage/package.json
- database/package.json
- publish-worker/package.json
- phase3-and-phase4.test.ts
- hyperframes/src/index.ts
- job-contracts/package.json
- publishing-adapters/package.json
- video-schema/package.json
- research-worker/package.json
- compilerOptions
- ffmpeg/package.json
- youbellkey-worker
- sync-env.sh
- license-registry/package.json
- originality-engine/package.json
- provider-adapters/package.json
- shared-types/package.json
- video-templates/package.json
- cloud-worker/package.json
- tsconfig.base.json
- tsconfig.json
- hyperframes/tsconfig.json
- threejs/tsconfig.json
- ai-gateway/tsconfig.json
- database/tsconfig.json
- job-contracts/tsconfig.json
- license-registry/tsconfig.json
- originality-engine/tsconfig.json
- provider-adapters/tsconfig.json
- publishing-adapters/tsconfig.json
- shared-types/tsconfig.json
- storage/tsconfig.json
- video-schema/tsconfig.json
- video-templates/tsconfig.json
- cloud-worker/tsconfig.json
- local-worker/tsconfig.json
- publish-worker/tsconfig.json
- render-worker/tsconfig.json
- research-worker/tsconfig.json
- scripts
- Youbellkey Studio — Workspace Rules
- ADR-0001: Hybrid Ringan
- Architecture Specification
- Rencana Implementasi: Sinkronisasi Multi-Model AI
- Skill: yb-license-auditor
- Skill: yb-security-auditor
- vercel.json
- ADR-0002: HyperFrames Master Renderer
- ADR-0003: TS AI Gateway
- ADR-0004: YouTube Autopilot Guardrails
- API Contracts
- Development Roadmap
- Third-Party Notices and SBOM

## God Nodes (most connected - your core abstractions)
1. `jsonError()` - 54 edges
2. `parseJsonBody()` - 45 edges
3. `getAuthenticatedWorkspace()` - 42 edges
4. `next` - 36 edges
5. `createSupabaseAdminClient()` - 32 edges
6. `StudioDashboard()` - 21 edges
7. `paths` - 19 edges
8. `authenticateWorker()` - 16 edges
9. `compilerOptions` - 15 edges
10. `executeRenderPipeline()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `@youbellkey/video-schema@*` --declares--> `@youbellkey/video-schema`  [EXTRACTED]
  engines/hyperframes/package.json → apps/web/package.json
- `@youbellkey/video-schema@*` --declares--> `@youbellkey/video-schema`  [EXTRACTED]
  workers/local-worker/package.json → apps/web/package.json
- `@youbellkey/video-schema@*` --declares--> `@youbellkey/video-schema`  [EXTRACTED]
  workers/render-worker/package.json → apps/web/package.json
- `@youbellkey/publishing-adapters@*` --declares--> `@youbellkey/publishing-adapters`  [EXTRACTED]
  workers/render-worker/package.json → apps/web/package.json
- `@youbellkey/publishing-adapters@*` --declares--> `@youbellkey/publishing-adapters`  [EXTRACTED]
  workers/local-worker/package.json → apps/web/package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hybrid Ringan Architecture Components** — apps_web, docs_adr_0001, docs_adr_0005, workers_local_worker [EXTRACTED 1.00]
- **Multi-Model AI Synchronization Flow** — readme, work_history, kilo_plans_1795778022835_multi_ai_sinkronisasi_proyek [EXTRACTED 1.00]
- **Core Governance Documentation** — docs_project_master_plan, docs_license_policy, docs_security, docs_roadmap [INFERRED 0.85]

## Communities (72 total, 9 thin omitted)

### Community 0 - "jsonError"
Cohesion: 0.06
Nodes (84): nextConfig, POST(), PresignDownloadSchema, POST(), PresignUploadSchema, POST(), POST(), POST() (+76 more)

### Community 1 - "runner.ts"
Cohesion: 0.08
Nodes (40): maxDuration, POST(), maxDuration, POST(), enqueueResearchSyncJob(), runQuickResearchSync(), ResearchSourceRow, JobDispatch (+32 more)

### Community 2 - "ai-gateway/src/index.ts"
Cohesion: 0.07
Nodes (40): AIProviderAdapter, AITaskKind, ANGLE_PRESETS, buildDeterministicVariations(), buildLongFormScenes(), ContentLabGenerationInput, ContentLabGenerationOutput, DEFAULT_FREE_ROUTING_RULES (+32 more)

### Community 3 - "contracts.test.ts"
Cohesion: 0.09
Nodes (36): GET(), dynamic, HomePage(), isWorkerRecentlyActive(), createMediaUploadTarget(), encodeSupabaseStorageKey(), ensureSupabaseMediaBucket(), getActiveStorageProvider() (+28 more)

### Community 4 - "compiler.ts"
Cohesion: 0.08
Nodes (39): buildConsistentCharacterDockHtml(), escapeAttr(), buildAiImageScene(), buildCalloutBadgeHtml(), buildCaptionCss(), buildChartScene(), buildDioramaBackdropSvg(), buildSceneMarkup() (+31 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (37): devDependencies, @types/node@^25.0.0, @types/react@^19.3.3, @types/react-dom@^19.3.0, typescript@^7.0.2, description, devDependencies, givemotion@^0.1.6 (+29 more)

### Community 6 - "StudioDashboard"
Cohesion: 0.07
Nodes (13): react@^19.3.1, metadata, LoginPage(), handleSubmit(), btnPrimary, btnSecondary, cardStyle, inputStyle (+5 more)

### Community 7 - "license-registry/src/index.ts"
Cohesion: 0.14
Nodes (16): args, ffmpegConfig, repoRoot, report, auditInstalledNodeModules(), classifyLicense(), collectPackageJsonFiles(), FORBIDDEN_PACKAGES (+8 more)

### Community 8 - "web/package.json"
Cohesion: 0.12
Nodes (19): dependencies, next@^16.4.6, react-dom@^19.3.1, @supabase/ssr@^0.12.7, @youbellkey/database@*, @youbellkey/provider-adapters@*, @youbellkey/storage@*, zod@^4.6.7 (+11 more)

### Community 9 - "local-worker/package.json"
Cohesion: 0.11
Nodes (21): @youbellkey/job-contracts@*, @youbellkey/research-worker@*, @youbellkey/job-contracts, @youbellkey/research-worker, @youbellkey/publish-worker, @youbellkey/render-worker, dependencies, @youbellkey/job-contracts@* (+13 more)

### Community 10 - "render-worker/src/index.ts"
Cohesion: 0.17
Nodes (20): ConcatAudioOptions, concatAudioSegmentsToMp3(), execFileAsync, FfmpegInspection, inspectFfmpegBinary(), MediaProbeResult, postProcessShortsMp4(), probeMediaFile() (+12 more)

### Community 11 - "ai-gateway/package.json"
Cohesion: 0.11
Nodes (20): @youbellkey/originality-engine@*, @youbellkey/shared-types@*, @youbellkey/video-schema@*, @youbellkey/originality-engine, @youbellkey/shared-types, @youbellkey/video-schema, dependencies, @youbellkey/originality-engine@* (+12 more)

### Community 12 - "paths"
Cohesion: 0.10
Nodes (21): compilerOptions, noEmit, paths, @youbellkey/ai-gateway, @youbellkey/ai-gateway/tts, @youbellkey/database, @youbellkey/engine-ffmpeg, @youbellkey/engine-hyperframes (+13 more)

### Community 13 - "render-worker/package.json"
Cohesion: 0.12
Nodes (18): @youbellkey/ai-gateway@*, @youbellkey/ai-gateway, @youbellkey/engine-ffmpeg, @youbellkey/engine-hyperframes, dependencies, @youbellkey/ai-gateway@*, @youbellkey/engine-ffmpeg@*, @youbellkey/engine-hyperframes@* (+10 more)

### Community 14 - "hyperframes/package.json"
Cohesion: 0.12
Nodes (18): @youbellkey/video-templates@*, @youbellkey/video-templates, dependencies, hyperframes@^0.9.98, @youbellkey/engine-threejs@*, @youbellkey/video-schema@*, @youbellkey/video-templates@*, main (+10 more)

### Community 15 - "threejs/package.json"
Cohesion: 0.15
Nodes (14): dependencies, three@^0.187.0, devDependencies, @types/three@^0.187.0, main, name, private, scripts (+6 more)

### Community 16 - "steps"
Cohesion: 0.13
Nodes (14): jobs, verify, name, on, pull_request, push, branches, run (+6 more)

### Community 17 - "compilerOptions"
Cohesion: 0.13
Nodes (15): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+7 more)

### Community 18 - "tts.ts"
Cohesion: 0.25
Nodes (13): alignWordCaptionsWithGroqWhisper(), buildDeterministicEditorialSvg(), buildFallbackToneWavBuffer(), callGeminiTts(), callGoogleCloudTts(), escapeXml(), estimateSpeechDurationSeconds(), estimateWordCaptionsFromScript() (+5 more)

### Community 19 - "storage/package.json"
Cohesion: 0.16
Nodes (13): dependencies, @aws-sdk/client-s3@^3.1178.0, @aws-sdk/s3-request-presigner@^3.1178.0, main, name, private, scripts, typecheck (+5 more)

### Community 20 - "database/package.json"
Cohesion: 0.17
Nodes (12): @supabase/supabase-js@^2.119.2, @supabase/supabase-js, dependencies, @supabase/supabase-js@^2.119.2, main, name, private, scripts (+4 more)

### Community 21 - "publish-worker/package.json"
Cohesion: 0.17
Nodes (12): @youbellkey/publishing-adapters@*, @youbellkey/publishing-adapters, dependencies, @youbellkey/publishing-adapters@*, main, name, private, scripts (+4 more)

### Community 22 - "phase3-and-phase4.test.ts"
Cohesion: 0.33
Nodes (10): AutopilotGuardrailResult, AutopilotMediaCheckInput, buildYoutubeShortsMetadata(), evaluateAutopilotGuardrails(), uploadYoutubeResumableVideo(), validateMetaReelsPublishInput(), YoutubeResumableUploadResult, YoutubeUploadMetadataInput (+2 more)

### Community 23 - "hyperframes/src/index.ts"
Cohesion: 0.29
Nodes (9): chooseSafeWorkerCount(), execFileAsync, HyperFramesDoctorResult, HyperFramesLintResult, lintHyperFramesProject(), renderHyperFramesProject(), resolveHyperFramesBinary(), runHyperFramesDoctor() (+1 more)

### Community 24 - "job-contracts/package.json"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 25 - "publishing-adapters/package.json"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 26 - "video-schema/package.json"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 27 - "research-worker/package.json"
Cohesion: 0.17
Nodes (11): exports, ./core, ./transcript, main, name, private, scripts, typecheck (+3 more)

### Community 28 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, module, moduleResolution, noEmit, plugins (+2 more)

### Community 29 - "ffmpeg/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 30 - "youbellkey-worker"
Cohesion: 0.22
Nodes (8): context, dockerfile, services, youbellkey-worker, build, env_file, restart, shm_size

### Community 31 - "sync-env.sh"
Cohesion: 0.53
Nodes (8): ensure_defaults_and_secrets(), get_env_val(), is_placeholder(), merge_missing_from_example(), prompt_if_needed(), push_to_vercel(), set_env_val(), sync-env.sh script

### Community 32 - "license-registry/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 33 - "originality-engine/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 34 - "provider-adapters/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 35 - "shared-types/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 36 - "video-templates/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 37 - "cloud-worker/package.json"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 38 - "tsconfig.base.json"
Cohesion: 0.25
Nodes (6): compilerOptions, outDir, rootDir, extends, include, exclude

### Community 39 - "tsconfig.json"
Cohesion: 0.29
Nodes (5): THREEJS_PRESETS, ThreeJsPresetId, ThreeJsScenePresetConfig, extends, include

### Community 40 - "hyperframes/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 41 - "threejs/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 42 - "ai-gateway/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 43 - "database/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 44 - "job-contracts/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 45 - "license-registry/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 46 - "originality-engine/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 47 - "provider-adapters/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 48 - "publishing-adapters/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 49 - "shared-types/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 50 - "storage/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 51 - "video-schema/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 52 - "video-templates/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 53 - "cloud-worker/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 54 - "local-worker/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 55 - "publish-worker/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 56 - "render-worker/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 57 - "research-worker/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 58 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, typecheck

### Community 59 - "Youbellkey Studio — Workspace Rules"
Cohesion: 0.50
Nodes (4): Youbellkey Studio — Workspace Rules, Skill: yb-architect, ADR-0005: Supabase Storage Fallback, Project Master Plan

### Community 60 - "ADR-0001: Hybrid Ringan"
Cohesion: 0.67
Nodes (3): Control Plane (Next.js), ADR-0001: Hybrid Ringan, Local Worker

### Community 61 - "Architecture Specification"
Cohesion: 0.67
Nodes (3): Architecture Specification, Data Model, HyperFrames Engine

### Community 62 - "Rencana Implementasi: Sinkronisasi Multi-Model AI"
Cohesion: 1.00
Nodes (3): Rencana Implementasi: Sinkronisasi Multi-Model AI, Youbellkey Creator Engine, WORK_HISTORY — Logbook

## Knowledge Gaps
- **19 isolated node(s):** `ADR-0005`, `ADR-0005`, `ADR-0005`, `Skill: yb-architect`, `ADR-0005: Supabase Storage Fallback` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `jsonError` to `web/package.json`, `runner.ts`, `contracts.test.ts`, `StudioDashboard`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **What connects `ADR-0005`, `ADR-0005`, `ADR-0005` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `jsonError` be split into smaller, more focused modules?**
  _Cohesion score 0.06028993361333153 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `package.json` to `jsonError`, `ai-gateway/src/index.ts`, `contracts.test.ts`, `license-registry/src/index.ts`, `tsconfig.json`, `phase3-and-phase4.test.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `runner.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08235294117647059 - nodes in this community are weakly interconnected._
- **Why does `@youbellkey/video-schema` connect `ai-gateway/package.json` to `web/package.json`, `local-worker/package.json`, `render-worker/package.json`, `hyperframes/package.json`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `ai-gateway/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07439613526570048 - nodes in this community are weakly interconnected._