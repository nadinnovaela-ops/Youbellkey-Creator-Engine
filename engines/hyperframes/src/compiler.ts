import fs from 'node:fs/promises';
import path from 'node:path';
import { THREEJS_PRESETS } from '@youbellkey/engine-threejs';
import {
  YBVideoDocumentSchema,
  type WordCaption,
  type YBScene,
  type YBVideoDocument,
} from '@youbellkey/video-schema';

export interface SceneAssetBinding {
  sceneIndex: number;
  imageRelPath?: string; // e.g. "./assets/scene_01.png"
}

export interface CompileCompositionOptions {
  document: YBVideoDocument;
  workDir: string;
  voiceoverRelPath?: string; // e.g. "./audio/voiceover.mp3"
  sceneAssets?: SceneAssetBinding[];
  sceneDurationsOverride?: number[];
  repoRootDir?: string;
}

export interface CompiledCompositionResult {
  indexHtmlPath: string;
  totalDurationSeconds: number;
  width: number;
  height: number;
  fps: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveExistingFile(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

async function copyVendorLibraries(workDir: string, startDir: string): Promise<{ hasThreeModule: boolean }> {
  const vendorDir = path.join(workDir, 'vendor');
  await fs.mkdir(vendorDir, { recursive: true });

  const gsapPath = await resolveExistingFile([
    path.join(startDir, 'node_modules/hyperframes/dist/vendor/npm/gsap@3.15.0/dist/gsap.min.js'),
    path.join(startDir, 'node_modules/hyperframes/dist/vendor/npm/gsap@3.14.2/dist/gsap.min.js'),
  ]);
  if (!gsapPath) {
    throw new Error('Could not find local bundled gsap.min.js inside node_modules/hyperframes.');
  }
  await fs.copyFile(gsapPath, path.join(vendorDir, 'gsap.min.js'));

  const threeModPath = await resolveExistingFile([
    path.join(startDir, 'node_modules/three/build/three.module.js'),
    path.join(startDir, 'engines/threejs/node_modules/three/build/three.module.js'),
  ]);
  const threeCorePath = await resolveExistingFile([
    path.join(startDir, 'node_modules/three/build/three.core.js'),
    path.join(startDir, 'engines/threejs/node_modules/three/build/three.core.js'),
  ]);

  let hasThreeModule = false;
  if (threeModPath && threeCorePath) {
    await fs.copyFile(threeModPath, path.join(vendorDir, 'three.module.js'));
    await fs.copyFile(threeCorePath, path.join(vendorDir, 'three.core.js'));
    hasThreeModule = true;
  } else if (threeModPath) {
    await fs.copyFile(threeModPath, path.join(vendorDir, 'three.module.js'));
    hasThreeModule = true;
  }

  return { hasThreeModule };
}

// ─── Gradient palettes per scene index (cycles every 8 scenes) ───────────────
const GRADIENT_PALETTES = [
  { bg: 'linear-gradient(135deg,#060913 0%,#0A1628 60%,#0F172A 100%)', accent: '#38BDF8', glow: '#0EA5E9' },
  { bg: 'linear-gradient(135deg,#0D0520 0%,#1A0533 60%,#0D0520 100%)', accent: '#E879F9', glow: '#C026D3' },
  { bg: 'linear-gradient(135deg,#001F12 0%,#003920 60%,#001F12 100%)', accent: '#34D399', glow: '#059669' },
  { bg: 'linear-gradient(135deg,#1A0C00 0%,#2D1600 60%,#1A0C00 100%)', accent: '#FBBF24', glow: '#D97706' },
  { bg: 'linear-gradient(135deg,#0F0A1E 0%,#1E1040 60%,#0F0A1E 100%)', accent: '#818CF8', glow: '#6366F1' },
  { bg: 'linear-gradient(135deg,#140008 0%,#280012 60%,#140008 100%)', accent: '#F472B6', glow: '#EC4899' },
  { bg: 'linear-gradient(135deg,#001520 0%,#002D40 60%,#001520 100%)', accent: '#22D3EE', glow: '#0891B2' },
  { bg: 'linear-gradient(135deg,#0E1700 0%,#1C2D00 60%,#0E1700 100%)', accent: '#A3E635', glow: '#65A30D' },
];

function getPalette(idx: number) {
  return GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length]!;
}

// ─── Typography scene HTML ───────────────────────────────────────────────────
function buildTypographyScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'typography') return '';
  const palette = getPalette(index);
  const accent = layer.accentColor ?? palette.accent;
  const glow = palette.glow;
  const safeId = `scene_${index}`;
  const headline = escapeHtml(layer.headline);
  const subheadline = layer.subheadline ? escapeHtml(layer.subheadline) : '';

  // Split headline into words for staggered GSAP animation
  const words = layer.headline.split(/\s+/).filter(Boolean);
  const wordSpans = words
    .map((w) => `<span class="hw hw-${safeId}">${escapeHtml(w)}</span>`)
    .join(' ');

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
      style="background: ${palette.bg};"
    >
      <div class="noise-overlay"></div>
      <div class="orb orb-a" style="background: radial-gradient(circle, ${glow}44 0%, transparent 65%);"></div>
      <div class="orb orb-b" style="background: radial-gradient(circle, ${accent}22 0%, transparent 65%);"></div>
      <div class="geo-line geo-line-top" style="border-color: ${accent}44;"></div>
      <div class="geo-line geo-line-bottom" style="border-color: ${accent}22;"></div>
      <div class="scene-num-badge" id="${safeId}_badge" style="border-color: ${accent}66; color: ${accent};">
        <span class="badge-dot" style="background: ${accent};"></span>
        ${String(index + 1).padStart(2, '0')} / SCENE
      </div>
      <div class="typo-content" id="${safeId}_content">
        <div class="typo-label" style="color: ${accent}; border-left-color: ${accent};">KEY INSIGHT</div>
        <h1 class="typo-headline" id="${safeId}_headline">${wordSpans}</h1>
        ${subheadline ? `<p class="typo-sub" id="${safeId}_sub">${subheadline}</p>` : ''}
      </div>
      <div class="accent-bar" style="background: linear-gradient(90deg, transparent, ${accent}, transparent);"></div>
    </section>
  `;
}

// ─── Three.js canvas scene HTML ──────────────────────────────────────────────
function buildThreeJsScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'threejs') return '';
  const presetCfg = THREEJS_PRESETS[layer.preset];
  const safeId = `scene_${index}`;
  const palette = getPalette(index);
  const accent = presetCfg.accentHex;
  const glow = palette.glow;

  const presetLabel = layer.preset === 'orbital-particles'
    ? '◎ ORBITAL FIELD'
    : layer.preset === 'floating-cards'
    ? '⬡ FLOATING GRID'
    : '▊ DATA BARS 3D';

  const headline = escapeHtml(scene.voiceover.text.slice(0, 90));

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
      style="background: ${palette.bg};"
    >
      <canvas
        id="${safeId}_three"
        class="three-canvas"
        data-preset="${escapeHtml(layer.preset)}"
        data-accent="${escapeHtml(accent)}"
        data-bg="${escapeHtml(presetCfg.backgroundHex)}"
        data-particles="${presetCfg.defaultParticleCount}"
        data-scene-start="${startSeconds.toFixed(3)}"
      ></canvas>
      <div class="scanlines"></div>
      <div class="three-card" id="${safeId}_card">
        <div class="three-label" style="color: ${accent}; border-color: ${accent}44;">${presetLabel}</div>
        <h2 class="three-headline">${headline}</h2>
        <div class="three-divider" style="background: linear-gradient(90deg, ${accent}, transparent);"></div>
      </div>
      <div class="corner-tl" id="${safeId}_ctl" style="border-color: ${glow}55;"></div>
      <div class="corner-br" id="${safeId}_cbr" style="border-color: ${glow}33;"></div>
    </section>
  `;
}

// ─── Chart scene HTML ────────────────────────────────────────────────────────
function buildChartScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'chart') return '';
  const safeId = `scene_${index}`;
  const palette = getPalette(index);
  const accent = palette.accent;
  const glow = palette.glow;
  const ACCENT_SEQ = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#818CF8', '#22D3EE'];

  const maxVal = Math.max(1, ...layer.series.map((s) => Math.abs(s.value)));

  const barsHtml = layer.series
    .map((item, bIdx) => {
      const pct = Math.max(8, Math.round((Math.abs(item.value) / maxVal) * 100));
      const barAccent = ACCENT_SEQ[bIdx % ACCENT_SEQ.length]!;
      return `
        <div class="chart-row" id="${safeId}_row_${bIdx}">
          <div class="chart-label-row">
            <span class="chart-label-text">${escapeHtml(item.label)}</span>
            <strong class="chart-val" id="${safeId}_val_${bIdx}" data-target="${item.value}">${item.value}</strong>
          </div>
          <div class="chart-track-outer">
            <div class="chart-track-inner">
              <div
                id="${safeId}_bar_${bIdx}"
                class="chart-fill"
                data-pct="${pct}"
                style="width: 0%; background: linear-gradient(90deg, ${barAccent}CC, ${barAccent});"
              ></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
      style="background: ${palette.bg};"
    >
      <div class="orb orb-a" style="background: radial-gradient(circle, ${glow}33 0%, transparent 65%);"></div>
      <div class="chart-panel-premium" id="${safeId}_panel">
        <div class="chart-header">
          <div class="chart-icon" style="color: ${accent};">▊</div>
          <div>
            <div class="chart-eyebrow" style="color: ${accent};">DATA INSIGHT</div>
            <h2 class="chart-title-premium">${escapeHtml(layer.title)}</h2>
          </div>
        </div>
        <div class="chart-separator" style="background: linear-gradient(90deg, ${accent}66, transparent);"></div>
        <div class="chart-list-premium">${barsHtml}</div>
      </div>
    </section>
  `;
}

// ─── AI image scene HTML ─────────────────────────────────────────────────────
function buildAiImageScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  assetBinding?: SceneAssetBinding,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'ai-image') return '';
  const src = escapeHtml(assetBinding?.imageRelPath ?? './assets/missing.svg');
  const safeId = `scene_${index}`;
  const palette = getPalette(index);
  const accent = palette.accent;

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
    >
      <div class="ai-backdrop">
        <img id="${safeId}_img" class="ai-image motion-${escapeHtml(layer.cameraMotion)}" src="${src}" alt="" />
        <div class="vignette-premium"></div>
        <div class="vignette-sides"></div>
      </div>
      <div class="cinema-bar cinema-top"></div>
      <div class="cinema-bar cinema-bottom"></div>
      <div class="ai-overlay" id="${safeId}_overlay">
        <div class="ai-label" style="color: ${accent}; border-left-color: ${accent};">SCENE ${index + 1}</div>
        <h2 class="ai-headline">${escapeHtml(scene.voiceover.text.slice(0, 100))}</h2>
        <div class="ai-accent-line" style="background: ${accent};"></div>
      </div>
    </section>
  `;
}

function buildSceneMarkup(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  assetBinding?: SceneAssetBinding,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind === 'typography') return buildTypographyScene(scene, index, startSeconds, durationSeconds);
  if (layer.kind === 'threejs') return buildThreeJsScene(scene, index, startSeconds, durationSeconds);
  if (layer.kind === 'chart') return buildChartScene(scene, index, startSeconds, durationSeconds);
  if (layer.kind === 'ai-image') return buildAiImageScene(scene, index, startSeconds, durationSeconds, assetBinding);

  // Fallback
  const safeId = `scene_${index}`;
  return `
    <section id="${safeId}" class="clip scene" data-start="${startSeconds.toFixed(3)}" data-duration="${durationSeconds.toFixed(3)}" data-track-index="0">
      <div class="kinetic-wrap"><h2 class="kinetic-headline">${escapeHtml(scene.voiceover.text)}</h2></div>
    </section>
  `;
}

export async function compileYBVideoDocumentToHyperFrames(
  options: CompileCompositionOptions,
): Promise<CompiledCompositionResult> {
  const doc = YBVideoDocumentSchema.parse(options.document);
  const startDir = options.repoRootDir ?? process.cwd();
  await fs.mkdir(options.workDir, { recursive: true });
  const { hasThreeModule } = await copyVendorLibraries(options.workDir, startDir);

  let cursor = 0;
  const timelineScenes = doc.scenes.map((scene, idx) => {
    const dur = Number((options.sceneDurationsOverride?.[idx] ?? scene.durationSeconds).toFixed(3));
    const entry = {
      index: idx,
      id: `scene_${idx}`,
      start: Number(cursor.toFixed(3)),
      duration: dur,
      scene,
      asset: options.sceneAssets?.find((a) => a.sceneIndex === idx),
    };
    cursor += dur;
    return entry;
  });

  const totalDuration = Number(Math.max(1, cursor).toFixed(3));
  const width = doc.project.width;
  const height = doc.project.height;
  const fps = doc.project.fps;

  const allCaptions: WordCaption[] = timelineScenes.flatMap((entry) => entry.scene.wordCaptions ?? []);
  const captionsJson = JSON.stringify(allCaptions).replace(/</g, '\\u003c');

  const sceneMetaJson = JSON.stringify(
    timelineScenes.map((s) => {
      const lk = s.scene.backgroundLayer.kind;
      return {
        id: s.id,
        start: s.start,
        duration: s.duration,
        kind: lk,
        motion: lk === 'ai-image' ? s.scene.backgroundLayer.cameraMotion : null,
        seriesCount: lk === 'chart' ? s.scene.backgroundLayer.series.length : 0,
        preset: lk === 'threejs' ? s.scene.backgroundLayer.preset : null,
        accentHex: lk === 'threejs' ? THREEJS_PRESETS[s.scene.backgroundLayer.preset].accentHex : null,
        bgHex: lk === 'threejs' ? THREEJS_PRESETS[s.scene.backgroundLayer.preset].backgroundHex : null,
        particleCount: lk === 'threejs' ? THREEJS_PRESETS[s.scene.backgroundLayer.preset].defaultParticleCount : 0,
        wordSpanClass: lk === 'typography' ? `hw-scene_${s.index}` : null,
        subId: lk === 'typography' ? `scene_${s.index}_sub` : null,
        cardId: lk === 'threejs' ? `scene_${s.index}_card` : null,
        ctlId: lk === 'threejs' ? `scene_${s.index}_ctl` : null,
        cbrId: lk === 'threejs' ? `scene_${s.index}_cbr` : null,
        panelId: lk === 'chart' ? `scene_${s.index}_panel` : null,
        imgId: lk === 'ai-image' ? `scene_${s.index}_img` : null,
        overlayId: lk === 'ai-image' ? `scene_${s.index}_overlay` : null,
      };
    }),
  );

  const scenesMarkup = timelineScenes
    .map((s) => buildSceneMarkup(s.scene, s.index, s.start, s.duration, s.asset))
    .join('\n');

  const audioMarkup = options.voiceoverRelPath
    ? `<audio id="voiceover" src="${escapeHtml(options.voiceoverRelPath)}" data-start="0" data-duration="${totalDuration}" data-volume="1"></audio>`
    : '';

  const html = `<!doctype html>
<html lang="${doc.project.locale === 'id-ID' ? 'id' : 'en'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(doc.project.title)}</title>
    <script src="./vendor/gsap.min.js"></script>
    <style>
      /* ═══════════════════════════════════════════════════════════
         YOUBELLKEY STUDIO — PREMIUM VIDEO TEMPLATE v2.0
         1080×1920 · 30fps · HyperFrames
         ═══════════════════════════════════════════════════════════ */
      :root {
        --text-main: #F8FAFC;
        --text-muted: #94A3B8;
        --highlight: #FACC15;
        --shadow-deep: 0 32px 80px rgba(0,0,0,0.75);
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #060913;
        color: var(--text-main);
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
      }

      /* Scene base */
      .clip.scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 160px 80px 460px 80px;
        overflow: hidden;
        opacity: 0;
      }

      /* Noise grain overlay */
      .noise-overlay {
        position: absolute; inset: 0; pointer-events: none; z-index: 1;
        opacity: 0.035;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
        background-size: 300px 300px;
        mix-blend-mode: overlay;
      }

      /* Glowing orbs */
      .orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(90px); z-index: 0; }
      .orb-a { width: 720px; height: 720px; top: -220px; right: -180px; }
      .orb-b { width: 500px; height: 500px; bottom: 220px; left: -150px; }

      /* Scene number badge */
      .scene-num-badge {
        position: absolute; top: 76px; right: 80px;
        display: flex; align-items: center; gap: 10px;
        font-size: 22px; font-weight: 800; letter-spacing: 0.18em;
        border: 2px solid; border-radius: 999px;
        padding: 10px 22px;
        background: rgba(0,0,0,0.3); backdrop-filter: blur(8px);
        z-index: 10; opacity: 0;
      }
      .badge-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

      /* Geometric accent lines */
      .geo-line { position: absolute; left: 0; right: 0; height: 2px; border-top: 2px solid; z-index: 2; pointer-events: none; }
      .geo-line-top  { top: 142px; }
      .geo-line-bottom { bottom: 442px; }

      /* Typography scene */
      .typo-content { position: relative; z-index: 5; width: 100%; opacity: 0; }
      .typo-label {
        display: flex; align-items: center; gap: 16px;
        font-size: 24px; font-weight: 900; letter-spacing: 0.22em;
        margin-bottom: 36px;
        border-left: 5px solid; padding-left: 20px; line-height: 1;
      }
      .typo-headline {
        font-size: 78px; line-height: 1.08; font-weight: 900;
        letter-spacing: -0.025em; color: #FFFFFF;
        text-shadow: 0 16px 48px rgba(0,0,0,0.6);
        word-break: keep-all;
      }
      .hw { display: inline-block; opacity: 0; transform: translateY(32px); will-change: transform,opacity; }
      .typo-sub {
        margin-top: 32px; font-size: 38px; line-height: 1.4;
        font-weight: 600; color: var(--text-muted); opacity: 0;
      }
      .accent-bar { position: absolute; bottom: 442px; left: 0; right: 0; height: 3px; z-index: 3; }

      /* Three.js scene */
      .three-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
      .scanlines {
        position: absolute; inset: 0; z-index: 2; pointer-events: none;
        background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px);
      }
      .three-card {
        position: relative; z-index: 10; width: 100%;
        padding: 52px 56px; border-radius: 28px;
        background: rgba(10,15,30,0.78); border: 1.5px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(16px);
        box-shadow: var(--shadow-deep), inset 0 1px 0 rgba(255,255,255,0.08);
        opacity: 0;
      }
      .three-label {
        font-size: 22px; font-weight: 900; letter-spacing: 0.2em;
        border: 1.5px solid; display: inline-block; padding: 8px 20px;
        border-radius: 999px; margin-bottom: 28px;
      }
      .three-headline { font-size: 56px; line-height: 1.2; font-weight: 800; color: #FFF; margin-bottom: 28px; }
      .three-divider  { height: 3px; border-radius: 999px; width: 120px; }
      .corner-tl, .corner-br {
        position: absolute; width: 56px; height: 56px;
        border: 3px solid; pointer-events: none; z-index: 8;
      }
      .corner-tl { top: 56px;    left: 56px;  border-right: none; border-bottom: none; border-radius: 8px 0 0 0; opacity: 0; }
      .corner-br { bottom: 440px; right: 56px; border-left:  none; border-top:    none; border-radius: 0 0 8px 0; opacity: 0; }

      /* Chart scene */
      .chart-panel-premium {
        position: relative; z-index: 5; width: 100%;
        padding: 52px 56px; border-radius: 28px;
        background: rgba(10,15,30,0.84); border: 1.5px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(12px); box-shadow: var(--shadow-deep); opacity: 0;
      }
      .chart-header { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
      .chart-icon  { font-size: 56px; line-height: 1; margin-top: 4px; }
      .chart-eyebrow { font-size: 22px; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 10px; }
      .chart-title-premium { font-size: 46px; font-weight: 800; line-height: 1.18; color: #FFF; }
      .chart-separator { height: 2px; border-radius: 999px; margin: 24px 0 32px; }
      .chart-list-premium { display: grid; gap: 32px; }
      .chart-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .chart-label-text { font-size: 32px; font-weight: 700; color: var(--text-muted); }
      .chart-val { font-size: 36px; font-weight: 900; color: #FFF; }
      .chart-track-outer { width: 100%; padding: 3px; background: rgba(255,255,255,0.06); border-radius: 999px; }
      .chart-track-inner { height: 28px; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
      .chart-fill { height: 100%; border-radius: 999px; }

      /* AI image scene */
      .ai-backdrop { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
      .ai-image { width: 100%; height: 100%; object-fit: cover; transform-origin: center center; }
      .vignette-premium {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.08) 35%, rgba(2,6,23,0.08) 55%, rgba(2,6,23,0.92) 100%);
      }
      .vignette-sides {
        position: absolute; inset: 0;
        background: linear-gradient(90deg, rgba(2,6,23,0.4) 0%, transparent 25%, transparent 75%, rgba(2,6,23,0.4) 100%);
      }
      .cinema-bar { position: absolute; left: 0; right: 0; height: 60px; background: #000; z-index: 5; pointer-events: none; }
      .cinema-top { top: 0; } .cinema-bottom { bottom: 0; }
      .ai-overlay { position: relative; z-index: 10; margin-top: auto; width: 100%; padding-bottom: 20px; opacity: 0; }
      .ai-label { display: inline-block; font-size: 22px; font-weight: 900; letter-spacing: 0.18em; margin-bottom: 20px; border-left: 5px solid; padding-left: 18px; }
      .ai-headline { font-size: 54px; font-weight: 800; line-height: 1.2; text-shadow: 0 8px 32px rgba(0,0,0,0.9); margin-bottom: 24px; }
      .ai-accent-line { height: 4px; width: 80px; border-radius: 999px; }

      /* Fallback kinetic */
      .kinetic-wrap { position: relative; width: 100%; text-align: left; z-index: 2; }
      .kinetic-headline { font-size: 72px; line-height: 1.1; font-weight: 900; letter-spacing: -0.02em; color: #FFF; }

      /* Shorts safe-zone caption dock */
      #caption-dock {
        position: absolute; left: 56px; right: 100px; bottom: 360px;
        z-index: 50; display: flex; justify-content: center; pointer-events: none;
      }
      #caption-box {
        padding: 20px 32px; border-radius: 20px;
        background: rgba(2,6,23,0.88); border: 1.5px solid rgba(255,255,255,0.14);
        text-align: center; font-size: 48px; font-weight: 900; line-height: 1.26;
        letter-spacing: -0.01em;
        box-shadow: 0 20px 50px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);
        backdrop-filter: blur(10px); max-width: 920px;
      }
      .cap-word { display: inline-block; margin: 0 6px; color: #E2E8F0; }
      .cap-word.active { color: var(--highlight); transform: scale(1.1); text-shadow: 0 0 24px rgba(250,204,21,0.5); }
      .cap-word.spoken { color: #FFF; }

      /* Progress rail */
      #progress-rail {
        position: absolute; top: 60px; left: 60px; right: 60px; height: 6px;
        border-radius: 999px; background: rgba(255,255,255,0.12); z-index: 100; overflow: hidden;
      }
      #progress-bar {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, #38BDF8, #818CF8, #34D399);
        border-radius: 999px;
      }

      /* Transition flash layer */
      #scene-flash { position: absolute; inset: 0; background: rgba(255,255,255,0); z-index: 90; pointer-events: none; }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${totalDuration}"
      data-width="${width}"
      data-height="${height}"
      data-fps="${fps}"
    >
      <div id="progress-rail"><div id="progress-bar"></div></div>
      <div id="scene-flash"></div>
      ${scenesMarkup}
      <div id="caption-dock"><div id="caption-box" style="display:none"></div></div>
      ${audioMarkup}
    </div>

    <script>
      /* ══════════════════════════════════════════════════════════════
         YOUBELLKEY HYPERFRAMES RUNTIME v2.0
         Premium animation — GSAP + seeded deterministic 3D canvas
         ══════════════════════════════════════════════════════════════ */
      const TOTAL_DURATION = ${totalDuration};
      const WORD_CAPTIONS  = ${captionsJson};
      const SCENES_META    = ${sceneMetaJson};

      /* ── Mulberry32 seeded PRNG (fully deterministic, no Math.random) ── */
      function mulberry32(seed) {
        return function() {
          seed |= 0; seed = seed + 0x6D2B79F5 | 0;
          var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      /* ── hex -> rgb string ── */
      function hexRgb(hex) {
        return parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16);
      }

      /* ══════════════════════════════════════════════════════════════
         PREMIUM 3D CANVAS ENGINE
         ══════════════════════════════════════════════════════════════ */
      const threeRenderers = [];

      function initCanvases() {
        document.querySelectorAll('.three-canvas').forEach(function(canvas) {
          canvas.width  = ${width};
          canvas.height = ${height};
          var ctx = canvas.getContext('2d');
          if (!ctx) return;

          var preset  = canvas.dataset.preset  || 'orbital-particles';
          var accent  = canvas.dataset.accent  || '#38BDF8';
          var bg      = canvas.dataset.bg      || '#090D16';
          var count   = Math.min(300, Number(canvas.dataset.particles || 150));
          var sstart  = Number(canvas.dataset.sceneStart || 0);
          var rgb     = hexRgb(accent);
          var rng     = mulberry32(Math.floor(sstart * 1000 + 42 + count));

          if (preset === 'orbital-particles') {
            var rings = 5, perRing = Math.floor(count / rings);
            var nodes = [];
            for (var ri = 0; ri < rings; ri++) {
              var ringR = 180 + ri * 110;
              var tilt  = (rng() - 0.5) * 0.6;
              for (var ni = 0; ni < perRing; ni++) {
                nodes.push({
                  baseAngle: (ni / perRing) * Math.PI * 2 + rng() * 0.3,
                  ringRadius: ringR, tilt: tilt,
                  speed: (0.3 + rng() * 0.5) * (ri % 2 === 0 ? 1 : -1),
                  size:  3 + rng() * 10,
                  brightness: 0.4 + rng() * 0.6,
                  phase: rng() * Math.PI * 2,
                });
              }
            }

            threeRenderers.push({ sstart: sstart, draw: function(t) {
              ctx.fillStyle = bg;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              /* Soft center glow */
              var grd = ctx.createRadialGradient(${width}/2, ${height}*0.4, 0, ${width}/2, ${height}*0.4, 460);
              grd.addColorStop(0, 'rgba('+rgb+',0.18)');
              grd.addColorStop(1, 'rgba('+rgb+',0)');
              ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);

              var cx = canvas.width * 0.5, cy = canvas.height * 0.42, fov = 900;
              nodes.forEach(function(n) {
                var theta = n.baseAngle + t * n.speed;
                var x3 = Math.cos(theta) * n.ringRadius;
                var y3 = Math.sin(theta) * n.ringRadius * Math.sin(n.tilt);
                var z3 = Math.sin(theta) * n.ringRadius * Math.cos(n.tilt) + 1200;
                var pct = fov / Math.max(100, z3);
                var sx  = cx + x3 * pct, sy = cy + y3 * pct;
                var sr  = Math.max(0.8, n.size * pct * 0.9);
                var pulse = 0.6 + 0.4 * Math.sin(t * 2.2 + n.phase);
                var alpha = Math.max(0.05, Math.min(0.9, n.brightness * pulse * pct));
                /* Sphere gradient */
                var sg = ctx.createRadialGradient(sx-sr*0.3, sy-sr*0.3, 0, sx, sy, sr);
                sg.addColorStop(0, 'rgba(255,255,255,'+alpha+')');
                sg.addColorStop(0.4, 'rgba('+rgb+','+(alpha*0.9)+')');
                sg.addColorStop(1, 'rgba('+rgb+',0)');
                ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2);
                ctx.fillStyle = sg; ctx.fill();
                if (sr > 6) {
                  ctx.beginPath(); ctx.arc(sx, sy, sr*2.4, 0, Math.PI*2);
                  ctx.fillStyle = 'rgba('+rgb+','+(alpha*0.1)+')'; ctx.fill();
                }
              });
            }});

          } else if (preset === 'floating-cards') {
            var cards = [];
            for (var i = 0; i < Math.min(22, count); i++) {
              cards.push({
                x: (rng()-0.5)*1200, y: (rng()-0.5)*2200, z: 400+rng()*1200,
                w: 160+rng()*240, h: 100+rng()*160,
                speedX: (rng()-0.5)*0.07, speedY: (rng()-0.5)*0.055, speedZ: (rng()-0.5)*0.55,
                brightness: 0.3+rng()*0.7, phase: rng()*Math.PI*2,
              });
            }

            threeRenderers.push({ sstart: sstart, draw: function(t) {
              ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
              var cx = canvas.width*0.5, cy = canvas.height*0.44, fov = 900;
              var sorted = cards.slice().sort(function(a,b){ return b.z - a.z; });
              sorted.forEach(function(card) {
                var zt = card.z + Math.sin(t*card.speedZ+card.phase)*100;
                var pct = fov / Math.max(100, zt);
                var xt = card.x + Math.sin(t*card.speedX+card.phase)*60;
                var yt = card.y + Math.cos(t*card.speedY+card.phase)*80;
                var sx = cx+xt*pct, sy = cy+yt*pct;
                var sw = card.w*pct, sh = card.h*pct;
                var pulse = 0.5+0.5*Math.sin(t*1.5+card.phase);
                var alpha = Math.max(0.03, Math.min(0.75, card.brightness*pulse*pct*1.2));
                var fg = ctx.createLinearGradient(sx-sw/2, sy-sh/2, sx+sw/2, sy+sh/2);
                fg.addColorStop(0, 'rgba('+rgb+','+(alpha*0.5)+')');
                fg.addColorStop(1, 'rgba('+rgb+','+(alpha*0.1)+')');
                ctx.save(); ctx.translate(sx, sy);
                ctx.rotate(Math.sin(t*0.3+card.phase)*0.08);
                ctx.fillStyle = fg;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(-sw/2,-sh/2,sw,sh,sw*0.08);
                else ctx.rect(-sw/2,-sh/2,sw,sh);
                ctx.fill();
                ctx.strokeStyle = 'rgba('+rgb+','+(alpha*0.8)+')';
                ctx.lineWidth = Math.max(0.5, 1.5*pct); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,'+(alpha*0.6)+')';
                ctx.fillRect(-sw/2, -sh/2, sw, Math.max(1, 2*pct));
                ctx.restore();
              });
            }});

          } else { /* data-bars-3d */
            var bars = [];
            for (var bi = 0; bi < Math.min(16, count); bi++) {
              bars.push({
                x: (bi/15-0.5)*1600+(rng()-0.5)*60, z: 800+rng()*600,
                targetH: 0.2+rng()*0.8, speed: 0.5+rng()*1.0,
                phase: rng()*Math.PI*2, brightness: 0.5+rng()*0.5,
              });
            }

            threeRenderers.push({ sstart: sstart, draw: function(t) {
              ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
              var cx = canvas.width*0.5, cy = canvas.height*0.75, fov = 900;
              /* Grid lines */
              ctx.strokeStyle = 'rgba('+rgb+',0.07)'; ctx.lineWidth = 1;
              for (var gx = -6; gx <= 6; gx++) {
                var sx2 = cx + gx*90;
                ctx.beginPath(); ctx.moveTo(sx2, cy-280); ctx.lineTo(sx2+150, cy); ctx.stroke();
              }
              for (var gz = 0; gz <= 6; gz++) {
                var gy = cy - gz*48;
                ctx.beginPath(); ctx.moveTo(cx-520+gz*16, gy); ctx.lineTo(cx+520+gz*16, gy); ctx.stroke();
              }
              var sortedB = bars.slice().sort(function(a,b){ return b.z-a.z; });
              sortedB.forEach(function(bar) {
                var pct = fov / Math.max(100, bar.z);
                var sx = cx + bar.x*pct;
                var animated = bar.targetH*(0.6+0.4*Math.sin(t*bar.speed+bar.phase));
                var barH = Math.max(20, animated*600*pct);
                var barW = Math.max(8, 60*pct);
                var alpha = Math.min(0.9, bar.brightness*pct*1.5);
                var bg2 = ctx.createLinearGradient(sx, cy-barH, sx, cy);
                bg2.addColorStop(0, 'rgba('+rgb+','+alpha+')');
                bg2.addColorStop(0.6, 'rgba('+rgb+','+(alpha*0.55)+')');
                bg2.addColorStop(1, 'rgba('+rgb+','+(alpha*0.08)+')');
                ctx.fillStyle = bg2;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(sx-barW/2, cy-barH, barW, barH, barW*0.15);
                else ctx.rect(sx-barW/2, cy-barH, barW, barH);
                ctx.fill();
                /* Top cap */
                ctx.fillStyle = 'rgba('+rgb+','+(alpha*0.45)+')';
                ctx.beginPath(); ctx.ellipse(sx, cy-barH, barW*1.3, barW*0.4, 0, 0, Math.PI*2);
                ctx.fill();
              });
            }});
          }
        });
      }

      /* ══════════════════════════════════════════════════════════════
         CAPTION ENGINE
         ══════════════════════════════════════════════════════════════ */
      function renderCaptionsAt(t) {
        var box = document.getElementById('caption-box');
        if (!box) return;
        if (!WORD_CAPTIONS.length) { box.style.display = 'none'; return; }
        var activeIdx = WORD_CAPTIONS.findIndex(function(w){ return t >= w.startSeconds && t <= w.endSeconds; });
        if (activeIdx < 0) {
          activeIdx = WORD_CAPTIONS.findIndex(function(w){ return w.startSeconds > t; });
          if (activeIdx < 0) activeIdx = WORD_CAPTIONS.length - 1;
        }
        var chunkSize  = 4;
        var chunkStart = Math.floor(Math.max(0, activeIdx) / chunkSize) * chunkSize;
        var chunk = WORD_CAPTIONS.slice(chunkStart, chunkStart + chunkSize);
        if (!chunk.length) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = chunk.map(function(w) {
          var isActive = t >= w.startSeconds && t <= w.endSeconds;
          var isSpoken = t > w.endSeconds;
          var cls = isActive ? 'cap-word active' : (isSpoken ? 'cap-word spoken' : 'cap-word');
          return '<span class="' + cls + '">' + w.word.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>';
        }).join(' ');
      }

      /* ══════════════════════════════════════════════════════════════
         FRAME SYNC — called by GSAP every frame
         ══════════════════════════════════════════════════════════════ */
      function syncDeterministicFrame(t) {
        var bar = document.getElementById('progress-bar');
        if (bar) bar.style.width = Math.min(100, Math.max(0, (t/TOTAL_DURATION)*100)).toFixed(2) + '%';
        renderCaptionsAt(t);
        for (var i = 0; i < threeRenderers.length; i++) {
          threeRenderers[i].draw(Math.max(0, t - threeRenderers[i].sstart));
        }
        for (var j = 0; j < SCENES_META.length; j++) {
          var sc = SCENES_META[j];
          if (sc.kind === 'chart' && sc.seriesCount > 0) {
            var lt = Math.max(0, Math.min(1, (t - sc.start) / 1.2));
            var eased = lt < 0.5 ? 4*lt*lt*lt : 1 - Math.pow(-2*lt+2,3)/2;
            for (var b = 0; b < sc.seriesCount; b++) {
              var el = document.getElementById(sc.id + '_bar_' + b);
              if (el) el.style.width = (Number(el.dataset.pct||50) * eased).toFixed(2) + '%';
            }
          }
        }
      }

      /* ══════════════════════════════════════════════════════════════
         GSAP MASTER TIMELINE — premium per-scene animations
         ══════════════════════════════════════════════════════════════ */
      initCanvases();

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true, onUpdate: function(){ syncDeterministicFrame(tl.time()); } });

      /* Clock proxy keeps deterministic frame sync running across full duration */
      var clockProxy = { t: 0 };
      tl.to(clockProxy, { t: TOTAL_DURATION, duration: TOTAL_DURATION, ease: 'none' }, 0);

      SCENES_META.forEach(function(sc) {
        var sel = '#' + sc.id;

        /* Scene entrance: scale fade */
        tl.fromTo(sel, { opacity:0, scale:1.04 }, { opacity:1, scale:1, duration:0.45, ease:'power3.out' }, sc.start);
        /* Scene exit: fade before next */
        if (sc.duration > 1.0) {
          tl.to(sel, { opacity:0, duration:0.28, ease:'power2.in' }, sc.start + sc.duration - 0.28);
        }

        /* White flash on each cut */
        tl.fromTo('#scene-flash',
          { backgroundColor:'rgba(255,255,255,0.0)' },
          { backgroundColor:'rgba(255,255,255,0.07)', duration:0.07, ease:'none', yoyo:true, repeat:1 },
          sc.start
        );

        if (sc.kind === 'typography') {
          /* Badge */
          tl.fromTo('#'+sc.id+'_badge', { opacity:0, x:20 }, { opacity:1, x:0, duration:0.38, ease:'power2.out' }, sc.start+0.06);
          /* Content block */
          tl.fromTo('#'+sc.id+'_content', { opacity:0, y:22 }, { opacity:1, y:0, duration:0.5, ease:'power3.out' }, sc.start+0.1);
          /* Word-by-word stagger */
          if (sc.wordSpanClass) {
            tl.fromTo('.'+sc.wordSpanClass,
              { opacity:0, y:28, rotateX:-15 },
              { opacity:1, y:0, rotateX:0, duration:0.55, ease:'back.out(1.5)', stagger:0.07 },
              sc.start+0.18
            );
          }
          /* Sub headline */
          if (sc.subId) {
            tl.fromTo('#'+sc.subId, { opacity:0, y:16 }, { opacity:1, y:0, duration:0.5, ease:'power2.out' }, sc.start+0.5);
          }
        }

        if (sc.kind === 'threejs') {
          /* Glass card */
          tl.fromTo('#'+sc.cardId, { opacity:0, y:42, scale:0.95 }, { opacity:1, y:0, scale:1, duration:0.65, ease:'back.out(1.2)' }, sc.start+0.18);
          /* Corner decorations */
          if (sc.ctlId) tl.fromTo('#'+sc.ctlId, { opacity:0, scale:0 }, { opacity:1, scale:1, duration:0.38, ease:'back.out(2)' }, sc.start+0.08);
          if (sc.cbrId) tl.fromTo('#'+sc.cbrId, { opacity:0, scale:0 }, { opacity:1, scale:1, duration:0.38, ease:'back.out(2)' }, sc.start+0.14);
        }

        if (sc.kind === 'chart') {
          /* Panel */
          tl.fromTo('#'+sc.panelId, { opacity:0, y:52, scale:0.94 }, { opacity:1, y:0, scale:1, duration:0.65, ease:'back.out(1.2)' }, sc.start+0.1);
          /* Row stagger */
          tl.fromTo('#'+sc.id+' .chart-row', { opacity:0, x:-32 }, { opacity:1, x:0, duration:0.4, ease:'power2.out', stagger:0.1 }, sc.start+0.32);
        }

        if (sc.kind === 'ai-image') {
          /* Ken Burns */
          if (sc.imgId) {
            var ep = sc.motion === 'ken-burns-out' ? { s:1.0,  fs:1.18, x:0  }
                   : sc.motion === 'pan-left'      ? { s:1.14, fs:1.14, x:-50 }
                   : sc.motion === 'pan-right'     ? { s:1.14, fs:1.14, x: 50 }
                   : { s:1.18, fs:1.0, x:0 };
            tl.fromTo('#'+sc.imgId,
              { scale:ep.fs, x:-ep.x*0.5 },
              { scale:ep.s,  x: ep.x*0.5, duration:sc.duration, ease:'none' },
              sc.start
            );
          }
          /* Text overlay */
          if (sc.overlayId) {
            tl.fromTo('#'+sc.overlayId, { opacity:0, y:26 }, { opacity:1, y:0, duration:0.6, ease:'power3.out' }, sc.start+0.3);
          }
        }
      });

      window.__timelines['main'] = tl;
      tl.seek(0);
      syncDeterministicFrame(0);
    </script>
  </body>
</html>`;

  const indexHtmlPath = path.join(options.workDir, 'index.html');
  await fs.writeFile(indexHtmlPath, html, 'utf8');

  return {
    indexHtmlPath,
    totalDurationSeconds: totalDuration,
    width,
    height,
    fps,
  };
}
