# Graph Report - Youbellkey-Creator-Engine  (2026-11-27)

## Corpus Check
- 163 files · ~52,475 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .woff2 14, (none) 3, .example 1)

## Summary
- 1080 nodes · 1871 edges · 99 communities (71 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98

## God Nodes (most connected - your core abstractions)
1. `jsonError()` - 49 edges
2. `parseJsonBody()` - 45 edges
3. `getAuthenticatedWorkspace()` - 40 edges
4. `next` - 34 edges
5. `createSupabaseAdminClient()` - 25 edges
6. `StudioDashboard()` - 21 edges
7. `paths` - 19 edges
8. `authenticateWorker()` - 16 edges
9. `compilerOptions` - 15 edges
10. `executeRenderPipeline()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `yb-license-auditor Skill` --conceptually_related_to--> `Bebas Neue Font License (SIL OFL-1.1)`  [INFERRED]
  .agents/skills/yb-license-auditor/SKILL.md → engines/hyperframes/fonts/BebasNeue-OFL.txt
- `yb-license-auditor Skill` --conceptually_related_to--> `Inter Font License (SIL OFL-1.1)`  [INFERRED]
  .agents/skills/yb-license-auditor/SKILL.md → engines/hyperframes/fonts/Inter-OFL.txt
- `yb-license-auditor Skill` --conceptually_related_to--> `JetBrains Mono Font License (SIL OFL-1.1)`  [INFERRED]
  .agents/skills/yb-license-auditor/SKILL.md → engines/hyperframes/fonts/JetBrainsMono-OFL.txt
- `yb-license-auditor Skill` --conceptually_related_to--> `Space Grotesk Font License (SIL OFL-1.1)`  [INFERRED]
  .agents/skills/yb-license-auditor/SKILL.md → engines/hyperframes/fonts/SpaceGrotesk-OFL.txt
- `POST()` --calls--> `createPresignedDownloadUrl()`  [EXTRACTED]
  apps/web/src/app/api/storage/presign-download/route.ts → packages/storage/src/index.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hybrid Ringan Execution Topology (PWA Control Plane + Atomic Postgres Queue + Universal Worker + Cloudflare R2)** — docs_architecture_layer1_pwa, docs_architecture_layer2_control_plane, docs_architecture_layer3_universal_worker, docs_adr_0001_hybrid_ringan_vercel_supabase_cloudflare_r2, docs_data_model_jobs_and_lease_rpcs [EXTRACTED 1.00]
- **Autopilot Safety & Tenant Secret Hygiene (AES-256-GCM Vault + RLS + Worker SHA-256 + Pre-Publish Guardrails + Kill Switch)** — docs_security_aes256_gcm_secrets_vault, docs_security_rls_and_worker_auth, docs_adr_0004_youtube_autopilot_guardrails_pre_publish_guardrails, docs_data_model_channels_and_publications, docs_api_contracts_studio_control_endpoints [EXTRACTED 1.00]
- **HyperFrames Bundled SIL OFL-1.1 Font Families** — engines_hyperframes_fonts_bebasneue_ofl_license, engines_hyperframes_fonts_inter_ofl_license, engines_hyperframes_fonts_jetbrainsmono_ofl_license, engines_hyperframes_fonts_nunito_ofl_license, engines_hyperframes_fonts_spacegrotesk_ofl_license [EXTRACTED 1.00]
- **Youbellkey Studio Domain Skills Governance** — agents_skills_yb_architect_skill_yb_architect, agents_skills_yb_license_auditor_skill_yb_license_auditor, agents_skills_yb_originality_auditor_skill_yb_originality_auditor, agents_skills_yb_publishing_auditor_skill_yb_publishing_auditor, agents_skills_yb_render_engineer_skill_yb_render_engineer, agents_skills_yb_security_auditor_skill_yb_security_auditor, agents_skills_yb_test_engineer_skill_yb_test_engineer, agents_skills_yb_video_director_skill_yb_video_director, agents_skills_yb_worker_reliability_skill_yb_worker_reliability [INFERRED 0.95]
- **Template-Driven Video Factory (HyperFrames Master + YB Video Document + Three.js/Manim/Motion Canvas + SSRF Mitigation)** — docs_adr_0002_template_yb_video_doc_hyperframes_hyperframes_renderer, docs_adr_0002_template_yb_video_doc_hyperframes_yb_video_document, third_party_notices_threejs, engines_manim_readme_clip_producer, engines_motion_canvas_readme_clip_producer, docs_security_template_driven_ssrf_mitigation [INFERRED 0.95]
- **Hybrid Ringan Infrastructure & Worker Deployment Topology** — infrastructure_cloud_readme_cloud_control_plane, infrastructure_database_readme_migration_runbook, infrastructure_local_readme_local_pc_worker, infrastructure_monitoring_readme_observability_baseline, workers_cloud_worker_readme_cloud_worker [INFERRED 0.95]

## Communities (99 total, 28 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (83): nextConfig, POST(), PresignDownloadSchema, POST(), POST(), POST(), GET(), maxDuration (+75 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (44): buildConsistentCharacterDockHtml(), escapeAttr(), buildAiImageScene(), buildCalloutBadgeHtml(), buildCaptionCss(), buildChartScene(), buildDioramaBackdropSvg(), buildSceneMarkup() (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (40): AIProviderAdapter, AITaskKind, ANGLE_PRESETS, buildDeterministicVariations(), buildLongFormScenes(), ContentLabGenerationInput, ContentLabGenerationOutput, DEFAULT_FREE_ROUTING_RULES (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (35): GET(), POST(), PresignUploadSchema, dynamic, HomePage(), isWorkerRecentlyActive(), createMediaUploadTarget(), encodeSupabaseStorageKey() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (31): yb-architect Skill, yb-license-auditor Skill, Content Regen Originality & Monetization Compliance Check, yb-originality-auditor Skill, YouTube Shorts Pre-Publish Guardrails (Kill Switch, MP4 Integrity, Idempotency, Quota), yb-publishing-auditor Skill, HyperFrames Deterministic Rendering, Word-Synced Captions & Chromium Cleanup, yb-render-engineer Skill (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (29): description, devDependencies, givemotion@^0.1.6, tsx@^4.23.15, @types/node@^25.0.0, typescript@^7.0.2, vitest@^5.1.2, engines (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (10): LoginPage(), handleSubmit(), btnPrimary, btnSecondary, cardStyle, inputStyle, StudioDashboard(), signOut() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (17): args, ffmpegConfig, repoRoot, report, auditInstalledNodeModules(), classifyLicense(), collectPackageJsonFiles(), FORBIDDEN_PACKAGES (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (24): compilerOptions, noEmit, paths, extends, include, ./tsconfig.base.json, @youbellkey/ai-gateway, @youbellkey/ai-gateway/tts (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (22): maxDuration, POST(), runQuickResearchSync(), CreateResearchSourceRequestSchema, ToggleResearchSourceRequestSchema, executeClaimedJob(), buildYoutubeChannelRssUrl(), computeMedian() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (21): @youbellkey/engine-ffmpeg, @youbellkey/engine-hyperframes, dependencies, @youbellkey/ai-gateway@*, @youbellkey/engine-ffmpeg@*, @youbellkey/engine-hyperframes@*, @youbellkey/publishing-adapters@*, @youbellkey/video-schema@* (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (21): @youbellkey/publish-worker, @youbellkey/render-worker, dependencies, @youbellkey/job-contracts@*, @youbellkey/publish-worker@*, @youbellkey/publishing-adapters@*, @youbellkey/render-worker@*, @youbellkey/research-worker@* (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (18): ConcatAudioOptions, concatAudioSegmentsToMp3(), execFileAsync, FfmpegInspection, inspectFfmpegBinary(), MediaProbeResult, postProcessShortsMp4(), probeMediaFile() (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (17): dependencies, hyperframes@^0.9.98, @youbellkey/engine-threejs@*, @youbellkey/video-schema@*, @youbellkey/video-templates@*, @youbellkey/video-schema, @youbellkey/video-templates, main (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (17): dependencies, @youbellkey/originality-engine@*, @youbellkey/shared-types@*, @youbellkey/video-schema@*, exports, ./tts, @youbellkey/originality-engine, @youbellkey/shared-types (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (14): dependencies, three@^0.187.0, devDependencies, @types/three@^0.187.0, main, name, private, scripts (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (14): jobs, verify, name, on, pull_request, push, branches, run (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (14): alignWordCaptionsWithGroqWhisper(), buildDeterministicEditorialSvg(), buildFallbackToneWavBuffer(), callGeminiTts(), callGoogleCloudTts(), escapeXml(), estimateSpeechDurationSeconds(), estimateWordCaptionsFromScript() (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (13): devDependencies, @types/node@^25.0.0, @types/react@^19.3.3, @types/react-dom@^19.3.0, typescript@^7.0.2, @types/node, typescript, name (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.26
Nodes (10): WorkerCapability, createCloudWorkerConfig(), config, createDefaultWorkerConfig(), loadLocalEnvFile(), postWorkerJson(), sleep(), startWorkerLoop() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.32
Nodes (10): AutopilotMediaCheckInput, buildYoutubeShortsMetadata(), evaluateAutopilotGuardrails(), uploadYoutubeResumableVideo(), validateMetaReelsPublishInput(), YoutubeResumableUploadResult, YoutubeUploadMetadataInput, ADR-0005 (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (13): dependencies, @aws-sdk/client-s3@^3.1178.0, @aws-sdk/s3-request-presigner@^3.1178.0, main, name, private, scripts, typecheck (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (12): dependencies, next@^16.4.6, react-dom@^19.3.1, @youbellkey/job-contracts@*, @youbellkey/research-worker@*, @youbellkey/storage@*, @youbellkey/video-schema@*, @youbellkey/job-contracts (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, incremental, jsx, module, moduleResolution, noEmit, plugins (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (11): dependencies, @supabase/supabase-js@^2.119.2, @supabase/supabase-js, main, name, private, scripts, typecheck (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (11): dependencies, zod@^4.6.7, zod, main, name, private, scripts, typecheck (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (11): dependencies, @youbellkey/publishing-adapters@*, @youbellkey/publishing-adapters, main, name, private, scripts, typecheck (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): exports, ./core, ./transcript, main, name, private, scripts, typecheck (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (9): chooseSafeWorkerCount(), execFileAsync, HyperFramesDoctorResult, HyperFramesLintResult, lintHyperFramesProject(), renderHyperFramesProject(), resolveHyperFramesBinary(), runHyperFramesDoctor() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (4): HyperFrames Master Timeline Renderer (Apache-2.0, 1080x1920 9:16), Phases 5-7: Analytics, Character Studio, Manim/Motion Canvas, Commercial Packaging, Manim Community Engine (MIT, Reserved Phase 5+ .mp4 clip producer for HyperFrames), Motion Canvas Engine (MIT, Reserved Phase 5+ .mp4/.webm clip producer for YB Video Document)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (7): Youbellkey Studio Workspace Rules (AGENTS.md), Youbellkey Studio API Contracts (Next.js App Router + Zod packages/job-contracts), Youbellkey Studio Architecture Specification (Hybrid Ringan), Youbellkey Studio Project Master Plan (Final Aligned Blueprint), Phases 0-2: Foundation, Control Plane & Worker Core, Viral Research & AI Content Lab, Target Monorepo Structure (apps, workers, packages, engines, infrastructure, docs, tests), Youbellkey Creator Engine (Hybrid Ringan AI Content Operating System)

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (8): context, dockerfile, services, youbellkey-worker, build, env_file, restart, shm_size

### Community 36 - "Community 36"
Cohesion: 0.53
Nodes (8): ensure_defaults_and_secrets(), get_env_val(), is_placeholder(), merge_missing_from_example(), prompt_if_needed(), push_to_vercel(), set_env_val(), sync-env.sh script

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (8): main, name, private, scripts, typecheck, type, types, version

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (7): External Clip Producers (Manim, Motion Canvas, ComfyUI generating .mp4/.png layers), Template-Driven YB Video Document with Clip Layering (Track A & Track B), Studio Control & Autopilot Endpoints (kill-switch, projects/:id/generate, projects/:id/document), Tables: research_sources, research_items & content_projects (yb_video_doc JSONB, originality_score), Tables: workspaces & workspace_members (kill_switch_active, tenant isolation), Two V1 Video Tracks (Track A Code-Driven Motion/3D Explainer & Track B AI Visual Storytelling), Phases 3-4: Video Factory (HyperFrames/TTS/Whisper) & YouTube Shorts Autopilot + Meta Reels 4.2

### Community 44 - "Community 44"
Cohesion: 0.32
Nodes (4): parseVttTranscript(), execFileAsync, extractReferenceTranscript(), TranscriptExtractionResult

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 49 - "Community 49"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (5): Postgres Atomic Job Lease Queue (SELECT ... FOR UPDATE SKIP LOCKED via HTTPS), YouTube Shorts Resumable Upload via workers/publish-worker (Short-Lived Token), Worker Control Plane Protocol (/api/worker/register, claim, heartbeat, complete, publish-token), Hybrid Worker Lease & Heartbeat Execution Flow (120s TTL, 30s heartbeat, reclaim_expired_leases), Table: jobs & RPCs claim_next_job / reclaim_expired_leases

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (3): react@^19.3.1, metadata, react

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (3): @supabase/ssr@^0.12.7, config, @supabase/ssr

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, typecheck

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (3): Tables: provider_credentials (AES-256-GCM) & workers (SHA-256 token_hash), AES-256-GCM Secrets Vault (YB_SECRETS_MASTER_KEY for BYOK keys, R2 creds, OAuth refresh tokens), Supabase RLS Tenant Isolation & SHA-256 Worker Token Authentication

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (3): Cloudflare R2 Object Storage ($0 Egress, Presigned HTTPS URLs), Storage Presigned Broker (/api/storage/presign-upload & presign-download for Cloudflare R2), Tables: media_assets (Cloudflare R2 keys & auto-cleanup) & cost_ledger

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (3): Layer 1: Smartphone PWA & Desktop Browser (apps/web Next.js App Router), Layer 2: Cloud Control Plane (Vercel API + Supabase PostgreSQL/RLS + Encrypted Secrets Vault), Layer 3: Universal Worker (local, render, research, publish workers; HyperFrames, Three.js, FFmpeg)

## Knowledge Gaps
- **68 isolated node(s):** `ADR-0005`, `ADR-0005`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 479 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Community 0` to `Community 65`, `Community 66`, `Community 3`, `Community 6`, `Community 9`, `Community 19`, `Community 23`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `ADR-0005`, `ADR-0005`, `../../tsconfig.base.json` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06064425770308123 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Community 7` to `Community 0`, `Community 21`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07102040816326531 - nodes in this community are weakly interconnected._
- **Why does `StudioDashboard()` connect `Community 6` to `Community 3`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07439613526570048 - nodes in this community are weakly interconnected._