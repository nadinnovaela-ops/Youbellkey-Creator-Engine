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
