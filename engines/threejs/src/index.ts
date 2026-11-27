export type ThreeJsPresetId =
  | 'orbital-particles'
  | 'floating-cards'
  | 'data-bars-3d'
  | 'diorama-city-flood'
  | 'diorama-volume-cube'
  | 'diorama-cutaway-strata'
  | 'diorama-map-compare'
  | 'voxel-world'
  | 'shinkai-light'
  | 'anime-scene'
  | 'kinetic-grid'
  | 'pixel-plane'
  | 'hologram-sphere'
  | 'origami-fold-3d'
  | 'neon-tunnel'
  | 'crystal-growth'
  | 'fluid-simulation';

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
  'voxel-world': {
    id: 'voxel-world',
    defaultParticleCount: 200,
    backgroundHex: '#0F172A',
    accentHex: '#22D3EE',
    secondaryHex: '#A78BFA',
    badgeLabel: 'VOXEL WORLD',
    isDiorama: false,
  },
  'shinkai-light': {
    id: 'shinkai-light',
    defaultParticleCount: 150,
    backgroundHex: '#DB2777',
    accentHex: '#7C3AED',
    secondaryHex: '#A855F7',
    badgeLabel: 'SHINKAI LIGHT',
    isDiorama: false,
  },
  'anime-scene': {
    id: 'anime-scene',
    defaultParticleCount: 120,
    backgroundHex: '#06B6D4',
    accentHex: '#3B82F6',
    secondaryHex: '#22D3EE',
    badgeLabel: 'ANIME SCENE',
    isDiorama: false,
  },
  'kinetic-grid': {
    id: 'kinetic-grid',
    defaultParticleCount: 300,
    backgroundHex: '#0F172A',
    accentHex: '#FACC15',
    secondaryHex: '#FFFFFF',
    badgeLabel: 'KINETIC GRID',
    isDiorama: false,
  },
  'pixel-plane': {
    id: 'pixel-plane',
    defaultParticleCount: 250,
    backgroundHex: '#1E1B4B',
    accentHex: '#A855F7',
    secondaryHex: '#C084FC',
    badgeLabel: 'PIXEL PLANE',
    isDiorama: false,
  },
  'hologram-sphere': {
    id: 'hologram-sphere',
    defaultParticleCount: 400,
    backgroundHex: '#020617',
    accentHex: '#22D3EE',
    secondaryHex: '#40F4EA',
    badgeLabel: 'HOLOGRAM SPHERE',
    isDiorama: false,
  },
  'origami-fold-3d': {
    id: 'origami-fold-3d',
    defaultParticleCount: 100,
    backgroundHex: '#FDE047',
    accentHex: '#F59E0B',
    secondaryHex: '#FCD34D',
    badgeLabel: 'ORIGAMI FOLD 3D',
    isDiorama: true,
  },
  'neon-tunnel': {
    id: 'neon-tunnel',
    defaultParticleCount: 180,
    backgroundHex: '#020617',
    accentHex: '#EC4899',
    secondaryHex: '#22D3EE',
    badgeLabel: 'NEON TUNNEL',
    isDiorama: false,
  },
  'crystal-growth': {
    id: 'crystal-growth',
    defaultParticleCount: 130,
    backgroundHex: '#E0E7FF',
    accentHex: '#C084FC',
    secondaryHex: '#A78BFA',
    badgeLabel: 'CRYSTAL GROWTH',
    isDiorama: true,
  },
  'fluid-simulation': {
    id: 'fluid-simulation',
    defaultParticleCount: 500,
    backgroundHex: '#06B6D4',
    accentHex: '#0EA5E9',
    secondaryHex: '#22D3EE',
    badgeLabel: 'FLUID SIM',
    isDiorama: false,
  },
};

/* ## Riwayat Pengerjakan (Work History)
- [27-11-2026 16:45:00 WIB] Model: Kilo | Sesi: implementasi-visual-looks-remotion | Aksi: Perluas ThreeJsPresetId type union dari 7 → 17 preset (voxel-world, shinkai-light, anime-scene, kinetic-grid, pixel-plane, hologram-sphere, origami-fold-3d, neon-tunnel, crystal-growth, fluid-simulation); tambah 10 entri THREEJS_PRESETS dengan defaultParticleCount, backgroundHex, accentHex, secondaryHex, badgeLabel, isDiorama untuk setiap preset baru | File: engines/threejs/src/index.ts | Status: selesai */
