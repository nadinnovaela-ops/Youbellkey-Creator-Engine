export interface ProviderCapabilitySpec {
  id: string;
  displayName: string;
  category: 'llm' | 'image' | 'tts' | 'whisper';
  hasFreeTier: boolean;
  requiresBillingVerification: boolean;
  commercialSafe: boolean;
  notes: string;
}

export const REGISTERED_PROVIDERS: ProviderCapabilitySpec[] = [
  {
    id: 'gemini-free',
    displayName: 'Google Gemini API (Free Tier)',
    category: 'llm',
    hasFreeTier: true,
    requiresBillingVerification: false,
    commercialSafe: true,
    notes: 'TypeScript-native HTTP call; supports ID & EN and multimodal inputs.',
  },
  {
    id: 'openrouter-free',
    displayName: 'OpenRouter (:free models)',
    category: 'llm',
    hasFreeTier: true,
    requiresBillingVerification: false,
    commercialSafe: true,
    notes: 'Single OpenAI-compatible endpoint for BYOK fallback models.',
  },
  {
    id: 'groq-whisper-free',
    displayName: 'Groq Whisper (whisper-large-v3-turbo)',
    category: 'whisper',
    hasFreeTier: true,
    requiresBillingVerification: false,
    commercialSafe: true,
    notes: 'Free API tier without credit card for word-level subtitle timestamps.',
  },
  {
    id: 'google-cloud-tts',
    displayName: 'Google Cloud Text-to-Speech',
    category: 'tts',
    hasFreeTier: true,
    requiresBillingVerification: true,
    commercialSafe: true,
    notes: '4M Standard / 1M WaveNet characters free per month; supports id-ID and en-US.',
  },
  {
    id: 'azure-speech-f0',
    displayName: 'Microsoft Azure Speech (F0)',
    category: 'tts',
    hasFreeTier: true,
    requiresBillingVerification: true,
    commercialSafe: true,
    notes: '500k Neural characters free per month with native WordBoundary timing events.',
  },
  {
    id: 'edge-tts-personal',
    displayName: 'Edge-TTS (Personal Fallback Only)',
    category: 'tts',
    hasFreeTier: true,
    requiresBillingVerification: false,
    commercialSafe: false,
    notes: 'Restricted to personal Phase 1-3 prototyping; must be disabled before commercial Phase 7 release.',
  },
];

export function listCommercialSafeProviders(): ProviderCapabilitySpec[] {
  return REGISTERED_PROVIDERS.filter((provider) => provider.commercialSafe);
}
