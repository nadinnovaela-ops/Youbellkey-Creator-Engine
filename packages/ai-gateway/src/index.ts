import type { SupportedLocale, UsageCostEntry } from '@youbellkey/shared-types';

export type AITaskKind =
  | 'script_draft'
  | 'complex_research'
  | 'grammar_check'
  | 'vision_analysis'
  | 'image_generation'
  | 'tts_voiceover'
  | 'whisper_alignment';

export interface TextGenerationRequest {
  task: Extract<AITaskKind, 'script_draft' | 'complex_research' | 'grammar_check' | 'vision_analysis'>;
  locale: SupportedLocale;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface TextGenerationResponse {
  text: string;
  usage: UsageCostEntry;
}

export interface WordAlignmentToken {
  word: string;
  startSeconds: number;
  endSeconds: number;
}

export interface AIProviderAdapter {
  readonly providerId: string;
  generateText(req: TextGenerationRequest, apiKey: string): Promise<TextGenerationResponse>;
}

export interface RoutingRule {
  task: AITaskKind;
  preferredProviders: string[];
}

export const DEFAULT_FREE_ROUTING_RULES: RoutingRule[] = [
  { task: 'script_draft', preferredProviders: ['gemini-free', 'openrouter-free', 'groq-free'] },
  { task: 'complex_research', preferredProviders: ['gemini-free', 'openrouter-free'] },
  { task: 'grammar_check', preferredProviders: ['groq-free', 'gemini-free'] },
  { task: 'vision_analysis', preferredProviders: ['gemini-free', 'openrouter-free'] },
  { task: 'image_generation', preferredProviders: ['cloudflare-workers-ai', 'gemini-imagen'] },
  { task: 'tts_voiceover', preferredProviders: ['google-cloud-tts', 'azure-speech-f0', 'edge-tts-personal'] },
  { task: 'whisper_alignment', preferredProviders: ['groq-whisper-free'] },
];
