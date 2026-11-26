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
    description: 'Parameterized Three.js WebGL backdrop combined with animated bar/line/counter data cards.',
    supportsThreeJs: true,
    safeTopMarginPx: 180,
    safeBottomMarginPx: 320,
  },
  'ai-visual-storytelling': {
    id: 'ai-visual-storytelling',
    name: 'AI Visual Storytelling & Documentary',
    track: 'AI_STORYTELLING',
    description: 'AI-generated scene images or clip layers with smooth camera motion and word-synced Shorts captions.',
    supportsThreeJs: false,
    safeTopMarginPx: 180,
    safeBottomMarginPx: 340,
  },
};

export function getTemplateSpec(id: HyperFramesTemplateSpec['id']): HyperFramesTemplateSpec {
  return V1_TEMPLATE_REGISTRY[id];
}
