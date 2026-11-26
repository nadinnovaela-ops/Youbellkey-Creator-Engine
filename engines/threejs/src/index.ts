export type ThreeJsPresetId = 'orbital-particles' | 'floating-cards' | 'data-bars-3d';

export interface ThreeJsScenePresetConfig {
  id: ThreeJsPresetId;
  defaultParticleCount: number;
  backgroundHex: string;
  accentHex: string;
}

export const THREEJS_PRESETS: Record<ThreeJsPresetId, ThreeJsScenePresetConfig> = {
  'orbital-particles': {
    id: 'orbital-particles',
    defaultParticleCount: 400,
    backgroundHex: '#090D16',
    accentHex: '#38BDF8',
  },
  'floating-cards': {
    id: 'floating-cards',
    defaultParticleCount: 120,
    backgroundHex: '#0F172A',
    accentHex: '#22D3EE',
  },
  'data-bars-3d': {
    id: 'data-bars-3d',
    defaultParticleCount: 60,
    backgroundHex: '#111827',
    accentHex: '#A78BFA',
  },
};
