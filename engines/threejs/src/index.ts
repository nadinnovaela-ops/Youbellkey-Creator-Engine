export type ThreeJsPresetId =
  | 'orbital-particles'
  | 'floating-cards'
  | 'data-bars-3d'
  | 'diorama-city-flood'
  | 'diorama-volume-cube'
  | 'diorama-cutaway-strata'
  | 'diorama-map-compare';

export interface ThreeJsScenePresetConfig {
  id: ThreeJsPresetId;
  defaultParticleCount: number;
  backgroundHex: string;
  accentHex: string;
  secondaryHex: string;
  badgeLabel: string;
  isDiorama: boolean;
}

export const THREEJS_PRESETS: Record<ThreeJsPresetId, ThreeJsScenePresetConfig> = {
  'orbital-particles': {
    id: 'orbital-particles',
    defaultParticleCount: 400,
    backgroundHex: '#090D16',
    accentHex: '#38BDF8',
    secondaryHex: '#818CF8',
    badgeLabel: '3D ORBITAL',
    isDiorama: false,
  },
  'floating-cards': {
    id: 'floating-cards',
    defaultParticleCount: 120,
    backgroundHex: '#0F172A',
    accentHex: '#22D3EE',
    secondaryHex: '#34D399',
    badgeLabel: '3D GRID',
    isDiorama: false,
  },
  'data-bars-3d': {
    id: 'data-bars-3d',
    defaultParticleCount: 60,
    backgroundHex: '#111827',
    accentHex: '#A78BFA',
    secondaryHex: '#F472B6',
    badgeLabel: 'DATA 3D',
    isDiorama: false,
  },
  'diorama-city-flood': {
    id: 'diorama-city-flood',
    defaultParticleCount: 90,
    backgroundHex: '#7CC6FA',
    accentHex: '#EF4444',
    secondaryHex: '#38BDF8',
    badgeLabel: 'SCALE DIORAMA',
    isDiorama: true,
  },
  'diorama-volume-cube': {
    id: 'diorama-volume-cube',
    defaultParticleCount: 110,
    backgroundHex: '#93C5FD',
    accentHex: '#0284C7',
    secondaryHex: '#22C55E',
    badgeLabel: 'VOLUME MODEL',
    isDiorama: true,
  },
  'diorama-cutaway-strata': {
    id: 'diorama-cutaway-strata',
    defaultParticleCount: 140,
    backgroundHex: '#D97706',
    accentHex: '#F97316',
    secondaryHex: '#78716C',
    badgeLabel: 'CROSS-SECTION',
    isDiorama: true,
  },
  'diorama-map-compare': {
    id: 'diorama-map-compare',
    defaultParticleCount: 80,
    backgroundHex: '#65A30D',
    accentHex: '#EF4444',
    secondaryHex: '#2563EB',
    badgeLabel: 'AREA COMPARE',
    isDiorama: true,
  },
};
