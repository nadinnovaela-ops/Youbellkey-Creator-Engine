import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'REVIEW_REQUIRED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
  'RETRY_PENDING',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const WorkerCapabilitySchema = z.enum(['render', 'research', 'publish']);
export type WorkerCapability = z.infer<typeof WorkerCapabilitySchema>;

export const JobTypeSchema = z.enum([
  'PHASE1_SMOKE',
  'RESEARCH_SYNC',
  'REFERENCE_TRANSCRIPT',
  'GENERATE_TTS_AND_CAPTIONS',
  'RENDER_HYPERFRAMES',
  'PUBLISH_YOUTUBE_SHORTS',
]);
export type JobType = z.infer<typeof JobTypeSchema>;

export const RegisterWorkerRequestSchema = z.object({
  workerName: z.string().min(2).max(100),
  platformArch: z.string().min(2).max(60),
  capabilities: z.array(WorkerCapabilitySchema).min(1),
});

export const ClaimJobRequestSchema = z.object({
  workerId: z.string().uuid(),
  capabilities: z.array(WorkerCapabilitySchema).min(1),
});

export const HeartbeatRequestSchema = z.object({
  workerId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().max(500).optional(),
});

export const CompleteJobRequestSchema = z.object({
  workerId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: z.enum(['SUCCEEDED', 'FAILED']),
  result: z.record(z.string(), z.unknown()).optional(),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(2000).optional(),
});

export const JobDispatchSchema = z.object({
  jobId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  jobType: JobTypeSchema,
  attemptCount: z.number().int().min(1),
  leaseExpiresAt: z.string().datetime(),
  idempotencyKey: z.string().min(8),
  payload: z.record(z.string(), z.unknown()),
});
export type JobDispatch = z.infer<typeof JobDispatchSchema>;

export const ToggleKillSwitchRequestSchema = z.object({
  killSwitchActive: z.boolean(),
});

export const CreateChannelRequestSchema = z.object({
  platform: z.enum(['youtube_shorts', 'instagram_reels', 'facebook_reels']).default('youtube_shorts'),
  externalChannelId: z.string().min(2).max(120),
  title: z.string().min(1).max(120),
  locale: z.enum(['id-ID', 'en-US']).default('id-ID'),
  timezone: z.string().min(2).max(80).default('Asia/Jakarta'),
  workflowMode: z.enum(['AUTOPILOT', 'MANUAL_REVIEW']).default('AUTOPILOT'),
  dailyPublishCap: z.number().int().min(1).max(25).default(3),
  autopilotEnabled: z.boolean().default(true),
});

export const UpsertProviderCredentialRequestSchema = z.object({
  provider: z.string().min(2).max(60),
  label: z.string().min(1).max(80),
  apiKey: z.string().min(6).max(512),
});

export const EnqueueSmokeJobRequestSchema = z.object({
  note: z.string().max(200).optional(),
});

// --- Phase 2: Viral Research & AI Content Lab Contracts ---

export const CreateResearchSourceRequestSchema = z.object({
  channelInput: z.string().min(3).max(300),
  niche: z.string().min(2).max(100),
  locale: z.enum(['id-ID', 'en-US']).default('id-ID'),
  syncNow: z.boolean().default(true),
});

export const ToggleResearchSourceRequestSchema = z.object({
  sourceId: z.string().uuid(),
  isActive: z.boolean(),
});

export const AddResearchVideoUrlRequestSchema = z.object({
  videoUrl: z.string().url().max(500),
  title: z.string().min(1).max(200).optional(),
  locale: z.enum(['id-ID', 'en-US']).default('id-ID'),
  enqueueTranscript: z.boolean().default(true),
});

export const TriggerResearchSyncRequestSchema = z.object({
  sourceId: z.string().uuid().optional(),
  mode: z.enum(['worker', 'quick']).default('worker'),
});

export const RequestTranscriptJobSchema = z.object({
  researchItemId: z.string().uuid(),
  preferredLocale: z.enum(['id-ID', 'en-US']).optional(),
});

export const GenerateContentLabRequestSchema = z.object({
  topic: z.string().min(3).max(1000).optional(),
  researchItemId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  locale: z.enum(['id-ID', 'en-US']).default('id-ID'),
  videoTrack: z.enum(['MOTION_EXPLAINER', 'AI_STORYTELLING']).default('MOTION_EXPLAINER'),
  variationCount: z.number().int().min(3).max(5).default(3),
}).refine((v) => Boolean(v.topic?.trim() || v.researchItemId), {
  message: 'Berikan topik/ide atau pilih researchItemId sebagai referensi.',
});

export const UpdateProjectDocumentRequestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  scriptText: z.string().min(1).max(20000).optional(),
  ybVideoDoc: z.record(z.string(), z.unknown()),
});
