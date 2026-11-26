export type SupportedLocale = 'id-ID' | 'en-US';

export type WorkflowMode = 'AUTOPILOT' | 'MANUAL_REVIEW';

export type PublishingPlatform = 'youtube_shorts' | 'instagram_reels' | 'facebook_reels';

export type VideoTrack = 'MOTION_EXPLAINER' | 'AI_STORYTELLING';

export type AuditStatus =
  | 'FIXED'
  | 'PARTIALLY FIXED'
  | 'NOT FIXED'
  | 'NOT APPLICABLE'
  | 'BLOCKED';

export interface Workspace {
  id: string;
  ownerUserId: string;
  name: string;
  killSwitchActive: boolean;
  defaultLocale: SupportedLocale;
  defaultTimezone: string;
  createdAt: string;
}

export interface ChannelConfig {
  id: string;
  workspaceId: string;
  platform: PublishingPlatform;
  externalChannelId: string;
  title: string;
  locale: SupportedLocale;
  timezone: string;
  workflowMode: WorkflowMode;
  dailyPublishCap: number;
  autopilotEnabled: boolean;
}

export interface UsageCostEntry {
  provider: string;
  model: string;
  inputUnits: number;
  outputUnits: number;
  estimatedCostUsd: number;
}
