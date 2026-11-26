import type { CaptionStyleId, CharacterProfile, VisualStyleId } from '@youbellkey/video-schema';

export interface HyperFramesTemplateSpec {
  id: 'kinetic-typography' | 'data-threejs-explainer' | 'ai-visual-storytelling';
  name: string;
  track: 'MOTION_EXPLAINER' | 'AI_STORYTELLING';
  description: string;
  supportsThreeJs: boolean;
  safeTopMarginPx: number;
  safeBottomMarginPx: number;
}

export const V1_TEMPLATE_REGISTRY: Record<HyperFramesTemplateSpec['id'], HyperFramesTemplateSpec> = {
  'kinetic-typography': {
    id: 'kinetic-typography',
    name: 'Kinetic Typography Explainer',
    track: 'MOTION_EXPLAINER',
    description: 'High-contrast animated typography with dynamic highlight captions ($0 visual cost).',
    supportsThreeJs: false,
    safeTopMarginPx: 180,
    safeBottomMarginPx: 320,
  },
  'data-threejs-explainer': {
    id: 'data-threejs-explainer',
    name: '3D & Data Chart Explainer',
    track: 'MOTION_EXPLAINER',
    description: 'Parameterized Three.js WebGL diorama & 3D worlds combined with animated data cards.',
    supportsThreeJs: true,
    safeTopMarginPx: 180,
    safeBottomMarginPx: 320,
  },
  'ai-visual-storytelling': {
    id: 'ai-visual-storytelling',
    name: 'AI Visual Storytelling & Documentary',
    track: 'AI_STORYTELLING',
    description: 'AI-generated scene images or illustrated SVG scenes with camera motion and synced captions.',
    supportsThreeJs: false,
    safeTopMarginPx: 180,
    safeBottomMarginPx: 340,
  },
};

export interface VisualLookTokenSet {
  id: VisualStyleId;
  name: string;
  description: string;
  skyTop: string;
  skyBottom: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  accentSecondary: string;
  badgeStripe: string;
  textColor: string;
  mutedColor: string;
  fontDisplay: string;
  fontBody: string;
  isLight: boolean;
}

export const VISUAL_LOOKS_CATALOG: Record<VisualStyleId, VisualLookTokenSet> = {
  'diorama-maket': {
    id: 'diorama-maket',
    name: '3D Diorama Maket (Tahu Bareng Style)',
    description: 'Stylized 3D architectural maket, water/scale dioramas, dark-navy callout badges with red stripe, and white-stroke subtitles.',
    skyTop: '#60A5FA',
    skyBottom: '#D8EEFF',
    cardBg: '#11131D',
    cardBorder: '#FFFFFF',
    accent: '#FACC15',
    accentSecondary: '#38BDF8',
    badgeStripe: '#EF4444',
    textColor: '#FFFFFF',
    mutedColor: '#CBD5E1',
    fontDisplay: '"Nunito", "Space Grotesk", "Inter", sans-serif',
    fontBody: '"Nunito", "Inter", sans-serif',
    isLight: true,
  },
  'midnight-tech': {
    id: 'midnight-tech',
    name: 'Midnight Tech',
    description: 'High-contrast dark navy canvas, cyan/indigo telemetry glow, geometric HUD callouts.',
    skyTop: '#060913',
    skyBottom: '#0F172A',
    cardBg: '#0F172A',
    cardBorder: '#38BDF8',
    accent: '#38BDF8',
    accentSecondary: '#818CF8',
    badgeStripe: '#38BDF8',
    textColor: '#F8FAFC',
    mutedColor: '#94A3B8',
    fontDisplay: '"Space Grotesk", "Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    isLight: false,
  },
  'editorial-clean': {
    id: 'editorial-clean',
    name: 'Paper Editorial',
    description: 'Warm off-white editorial paper backdrop, deep ink typography, crimson highlight stripe.',
    skyTop: '#F4EFE6',
    skyBottom: '#E7E0D3',
    cardBg: '#17171B',
    cardBorder: '#17171B',
    accent: '#DC2626',
    accentSecondary: '#2563EB',
    badgeStripe: '#DC2626',
    textColor: '#17171B',
    mutedColor: '#475569',
    fontDisplay: '"Space Grotesk", "Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    isLight: true,
  },
  'bold-pop': {
    id: 'bold-pop',
    name: 'Bold Pop Shorts',
    description: 'Punchy high-energy dark purple-charcoal canvas, golden yellow impact type, coral accents.',
    skyTop: '#13072E',
    skyBottom: '#1E1B4B',
    cardBg: '#11131D',
    cardBorder: '#FACC15',
    accent: '#FACC15',
    accentSecondary: '#F472B6',
    badgeStripe: '#F43F5E',
    textColor: '#FFFFFF',
    mutedColor: '#CBD5E1',
    fontDisplay: '"Bebas Neue", "Nunito", sans-serif',
    fontBody: '"Nunito", "Inter", sans-serif',
    isLight: false,
  },
};

export const CHARACTER_HOST_PRESETS: Record<CharacterProfile['presetId'], CharacterProfile> = {
  'bima-explainer': {
    enabled: true,
    presetId: 'bima-explainer',
    name: 'Bima (Host Sains & Fakta)',
    position: 'top-right',
    primaryColor: '#2563EB',
    accentColor: '#FACC15',
    hairColor: '#1E293B',
    skinTone: '#F1C27D',
  },
  'aria-tech': {
    enabled: true,
    presetId: 'aria-tech',
    name: 'Aria (Tech & AI Explainer)',
    position: 'top-right',
    primaryColor: '#0EA5E9',
    accentColor: '#34D399',
    hairColor: '#312E81',
    skinTone: '#F5CBA7',
  },
  'nova-analyst': {
    enabled: true,
    presetId: 'nova-analyst',
    name: 'Nova (Data & Bisnis)',
    position: 'top-right',
    primaryColor: '#DC2626',
    accentColor: '#FBBF24',
    hairColor: '#0F172A',
    skinTone: '#E0AC69',
  },
  none: {
    enabled: false,
    presetId: 'none',
    name: 'Tanpa Karakter',
    position: 'top-right',
    primaryColor: '#38BDF8',
    accentColor: '#FACC15',
    hairColor: '#1E293B',
    skinTone: '#F1C27D',
  },
};

export const CAPTION_STYLE_PRESETS: ReadonlyArray<{ id: CaptionStyleId; label: string; description: string }> = [
  {
    id: 'bold-stroke',
    label: 'Bold White Outline (Tahu Bareng / Shorts)',
    description: 'Teks putih bulat bertepi hitam tebal tanpa kotak gelap yang menutupi visual 3D.',
  },
  {
    id: 'pill-box',
    label: 'High-Contrast Pill Box',
    description: 'Kapsul gelap kontras tinggi dengan highlight kuning aktif per kata.',
  },
  {
    id: 'clean-editorial',
    label: 'Clean Editorial Lower-Third',
    description: 'Tipografi rapi dengan kontras tinggi bergaya dokumenter.',
  },
];

export function getTemplateSpec(id: HyperFramesTemplateSpec['id']): HyperFramesTemplateSpec {
  return V1_TEMPLATE_REGISTRY[id];
}
