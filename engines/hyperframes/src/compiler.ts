import fs from 'node:fs/promises';
import path from 'node:path';
import { THREEJS_PRESETS } from '@youbellkey/engine-threejs';
import {
  YBVideoDocumentSchema,
  type CaptionStyleId,
  type VisualStyleId,
  type WordCaption,
  type YBScene,
  type YBVideoDocument,
} from '@youbellkey/video-schema';
import { VISUAL_LOOKS_CATALOG } from '@youbellkey/video-templates';
import { buildConsistentCharacterDockHtml } from './character-svg.js';
import { buildSharedThreeJsModuleScript } from './diorama-runtime.js';

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

const BUNDLED_FONT_FILES = [
  { family: 'Nunito', file: 'nunito-latin-wght-normal.woff2', weight: '200 1000', style: 'normal' },
  { family: 'Inter', file: 'inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
  { family: 'Space Grotesk', file: 'space-grotesk-latin-wght-normal.woff2', weight: '300 700', style: 'normal' },
  { family: 'Bebas Neue', file: 'bebas-neue-latin-400-normal.woff2', weight: '400', style: 'normal' },
  { family: 'JetBrains Mono', file: 'jetbrains-mono-latin-wght-normal.woff2', weight: '100 800', style: 'normal' },
] as const;

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

async function copyVendorAndFontAssets(
  workDir: string,
  startDir: string,
): Promise<{ hasThreeModule: boolean; loadedFontCss: string }> {
  const vendorDir = path.join(workDir, 'vendor');
  const fontsDir = path.join(workDir, 'fonts');
  await fs.mkdir(vendorDir, { recursive: true });
  await fs.mkdir(fontsDir, { recursive: true });

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

  const fontFaceRules: string[] = [];
  for (const f of BUNDLED_FONT_FILES) {
    const src = await resolveExistingFile([
      path.join(startDir, 'engines/hyperframes/fonts', f.file),
      path.join(startDir, 'node_modules/givemotion/src/runtime/fonts', f.file),
    ]);
    if (!src) continue;
    await fs.copyFile(src, path.join(fontsDir, f.file));
    fontFaceRules.push(`@font-face {
      font-family: "${f.family}";
      src: url("./fonts/${f.file}") format("woff2");
      font-weight: ${f.weight};
      font-style: ${f.style};
      font-display: block;
    }`);
  }

  return { hasThreeModule, loadedFontCss: fontFaceRules.join('\n') };
}

function buildCalloutBadgeHtml(
  safeId: string,
  label: string,
  value?: string,
  stripeColor = '#EF4444',
): string {
  const escapedLabel = escapeHtml(label);
  const escapedVal = value ? escapeHtml(value) : '';
  return `
    <div class="tb-callout" id="${safeId}_callout">
      <div class="tb-callout-stripe" style="background: ${escapeHtml(stripeColor)};"></div>
      <div class="tb-callout-body">
        <div class="tb-callout-title">${escapedLabel}</div>
        ${escapedVal ? `<div class="tb-callout-val">${escapedVal}</div>` : ''}
      </div>
      <div class="tb-callout-teeth" aria-hidden="true">▾▾▾▾▾▾▾</div>
    </div>
  `;
}

function buildDioramaBackdropSvg(accent: string, isLight: boolean): string {
  const ridgeFill = isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(56, 189, 248, 0.08)';
  const gridStroke = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)';
  return `
    <svg class="scene-scenic-svg" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="${gridStroke}" stroke-width="2" fill="none">
        <line x1="0" y1="1420" x2="1080" y2="1420" />
        <line x1="0" y1="1540" x2="1080" y2="1540" />
        <line x1="0" y1="1660" x2="1080" y2="1660" />
        <line x1="270" y1="1380" x2="120" y2="1920" />
        <line x1="540" y1="1380" x2="540" y2="1920" />
        <line x1="810" y1="1380" x2="960" y2="1920" />
      </g>
      <path d="M0 1440 L140 1280 L220 1280 L220 1350 L360 1210 L470 1210 L470 1330 L610 1160 L720 1160 L720 1320 L860 1250 L980 1250 L1080 1380 L1080 1920 L0 1920 Z" fill="${ridgeFill}"/>
      <circle cx="880" cy="420" r="180" fill="${accent}" opacity="0.14"/>
    </svg>
  `;
}

function buildTypographyScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  visualStyle: VisualStyleId,
  hasCharacterDock: boolean,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'typography') return '';

  const look = VISUAL_LOOKS_CATALOG[visualStyle];
  const accent = layer.accentColor ?? look.accent;
  const safeId = `scene_${index}`;
  const subheadline = layer.subheadline ? escapeHtml(layer.subheadline) : '';
  const words = layer.headline.split(/\s+/).filter(Boolean);
  const wordSpans = words
    .map((w, wi) => {
      const highlight = index === 0 && wi < 2 ? ' hw-highlight' : '';
      return `<span class="hw hw-${safeId}${highlight}">${escapeHtml(w)}</span>`;
    })
    .join(' ');

  const badgeText = scene.badgeText ?? (index === 0 ? 'HOOK · FAKTA UNIK' : `POIN ${String(index + 1).padStart(2, '0')}`);
  const calloutHtml = scene.callout
    ? buildCalloutBadgeHtml(safeId, scene.callout.label, scene.callout.value, scene.callout.accentColor ?? look.badgeStripe)
    : '';

  const bgGradient = `linear-gradient(180deg, ${look.skyTop} 0%, ${look.skyBottom} 100%)`;
  const cardShiftClass = hasCharacterDock ? ' has-char-margin' : '';

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
      style="background: ${bgGradient};"
    >
      <div class="radial-glow" style="background: radial-gradient(closest-side, ${accent}33, transparent);"></div>
      ${buildDioramaBackdropSvg(accent, look.isLight)}
      <div class="scene-top-pill" id="${safeId}_badge" style="border-left-color: ${look.badgeStripe};">
        ${escapeHtml(badgeText)}
      </div>
      <div class="typo-content${cardShiftClass} ${visualStyle === 'diorama-maket' ? 'typo-diorama-panel' : 'typo-dark-panel'}" id="${safeId}_content">
        ${calloutHtml}
        <h1 class="typo-headline ${visualStyle === 'diorama-maket' ? 'typo-headline-outlined' : ''}" id="${safeId}_headline">${wordSpans}</h1>
        ${subheadline ? `<p class="typo-sub" id="${safeId}_sub">${subheadline}</p>` : ''}
      </div>
    </section>
  `;
}

function buildThreeJsScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  visualStyle: VisualStyleId,
  hasCharacterDock: boolean,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'threejs') return '';
  const look = VISUAL_LOOKS_CATALOG[visualStyle];
  const presetCfg = THREEJS_PRESETS[layer.preset];
  const safeId = `scene_${index}`;

  const calloutLabel = scene.callout?.label ?? scene.badgeText ?? presetCfg.badgeLabel;
  const calloutValue = scene.callout?.value;
  const badgeHtml = buildCalloutBadgeHtml(
    safeId,
    calloutLabel,
    calloutValue,
    scene.callout?.accentColor ?? look.badgeStripe,
  );
  const topWidthStyle = hasCharacterDock ? ' style="max-width: 720px;"' : '';

  // Transparent scene overlay lets #three-stage-canvas 3D diorama shine cleanly across ~68% of viewport
  return `
    <section
      id="${safeId}"
      class="clip scene scene-threejs"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
    >
      <div class="three-top-callout" id="${safeId}_card"${topWidthStyle}>
        ${badgeHtml}
      </div>
    </section>
  `;
}

function buildChartScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  visualStyle: VisualStyleId,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'chart') return '';
  const look = VISUAL_LOOKS_CATALOG[visualStyle];
  const safeId = `scene_${index}`;
  const accentSeq = ['#EF4444', '#38BDF8', '#22C55E', '#FACC15', '#818CF8'];
  const maxVal = Math.max(1, ...layer.series.map((s) => Math.abs(s.value)));

  const barsHtml = layer.series
    .map((item, bIdx) => {
      const pct = Math.max(10, Math.round((Math.abs(item.value) / maxVal) * 100));
      const barCol = accentSeq[bIdx % accentSeq.length]!;
      return `
        <div class="chart-row" id="${safeId}_row_${bIdx}">
          <div class="chart-label-row">
            <span class="chart-label-text">${escapeHtml(item.label)}</span>
            <strong class="chart-val" id="${safeId}_val_${bIdx}" style="color: ${barCol};">${item.value}</strong>
          </div>
          <div class="chart-track-inner">
            <div
              id="${safeId}_bar_${bIdx}"
              class="chart-fill"
              data-pct="${pct}"
              style="width: 0%; background: ${barCol};"
            ></div>
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
      style="background: linear-gradient(180deg, ${look.skyTop} 0%, ${look.skyBottom} 100%);"
    >
      ${buildDioramaBackdropSvg(look.accentSecondary, look.isLight)}
      <div class="chart-panel-clean" id="${safeId}_panel">
        <div class="tb-callout-stripe-top" style="background: ${look.badgeStripe};"></div>
        <div class="chart-eyebrow" style="color: #FACC15;">DATA PERBANDINGAN</div>
        <h2 class="chart-title-clean">${escapeHtml(layer.title)}</h2>
        <div class="chart-list-clean">${barsHtml}</div>
      </div>
    </section>
  `;
}

function buildAiImageScene(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  visualStyle: VisualStyleId,
  assetBinding?: SceneAssetBinding,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind !== 'ai-image') return '';
  const look = VISUAL_LOOKS_CATALOG[visualStyle];
  const src = escapeHtml(assetBinding?.imageRelPath ?? './assets/missing.svg');
  const safeId = `scene_${index}`;

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
        <div class="vignette-clean"></div>
      </div>
      <div class="ai-overlay" id="${safeId}_overlay">
        ${buildCalloutBadgeHtml(safeId, `SCENE ${index + 1}`, scene.callout?.value, look.badgeStripe)}
        <h2 class="ai-headline">${escapeHtml(scene.voiceover.text.slice(0, 100))}</h2>
      </div>
    </section>
  `;
}

function buildSceneMarkup(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  visualStyle: VisualStyleId,
  hasCharacterDock: boolean,
  assetBinding?: SceneAssetBinding,
): string {
  const layer = scene.backgroundLayer;
  if (layer.kind === 'typography') {
    return buildTypographyScene(scene, index, startSeconds, durationSeconds, visualStyle, hasCharacterDock);
  }
  if (layer.kind === 'threejs') {
    return buildThreeJsScene(scene, index, startSeconds, durationSeconds, visualStyle, hasCharacterDock);
  }
  if (layer.kind === 'chart') {
    return buildChartScene(scene, index, startSeconds, durationSeconds, visualStyle);
  }
  if (layer.kind === 'ai-image') {
    return buildAiImageScene(scene, index, startSeconds, durationSeconds, visualStyle, assetBinding);
  }

  const safeId = `scene_${index}`;
  return `
    <section id="${safeId}" class="clip scene" data-start="${startSeconds.toFixed(3)}" data-duration="${durationSeconds.toFixed(3)}" data-track-index="0">
      <div class="typo-dark-panel"><h2 class="typo-headline">${escapeHtml(scene.voiceover.text)}</h2></div>
    </section>
  `;
}

function buildCaptionCss(captionStyle: CaptionStyleId): string {
  if (captionStyle === 'pill-box') {
    return `
      #caption-box {
        padding: 18px 30px;
        border-radius: 20px;
        background: rgba(15, 23, 42, 0.92);
        border: 3px solid rgba(255, 255, 255, 0.22);
        text-align: center;
        font-size: 48px;
        font-weight: 900;
        line-height: 1.25;
        max-width: 920px;
      }
      .cap-word { display: inline-block; margin: 0 7px; color: #CBD5E1; }
      .cap-word.active { color: #FACC15; transform: scale(1.1); }
      .cap-word.spoken { color: #FFFFFF; }
    `;
  }
  if (captionStyle === 'clean-editorial') {
    return `
      #caption-box {
        padding: 14px 24px;
        border-radius: 12px;
        background: rgba(17, 19, 29, 0.88);
        border-left: 6px solid #EF4444;
        text-align: center;
        font-size: 44px;
        font-weight: 800;
        line-height: 1.28;
        max-width: 900px;
      }
      .cap-word { display: inline-block; margin: 0 6px; color: #E2E8F0; }
      .cap-word.active { color: #FFFFFF; text-decoration: underline; text-decoration-color: #FACC15; }
      .cap-word.spoken { color: #F8FAFC; }
    `;
  }
  // Default: 'bold-stroke' (exact Tahu Bareng / YouTube Shorts outline style — zero heavy dark box!)
  return `
    #caption-box {
      padding: 8px 16px;
      background: transparent;
      text-align: center;
      font-family: "Nunito", "Space Grotesk", "Inter", sans-serif;
      font-size: 62px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.01em;
      max-width: 940px;
    }
    .cap-word {
      display: inline-block;
      margin: 0 8px;
      color: #FFFFFF;
      -webkit-text-stroke: 14px #090D16;
      paint-order: stroke fill;
      text-shadow: 0 6px 0 #090D16;
    }
    .cap-word.active {
      color: #FACC15;
      transform: scale(1.12);
    }
    .cap-word.spoken {
      color: #FFFFFF;
    }
  `;
}

export async function compileYBVideoDocumentToHyperFrames(
  options: CompileCompositionOptions,
): Promise<CompiledCompositionResult> {
  const doc = YBVideoDocumentSchema.parse(options.document);
  const startDir = options.repoRootDir ?? process.cwd();
  await fs.mkdir(options.workDir, { recursive: true });
  const { hasThreeModule, loadedFontCss } = await copyVendorAndFontAssets(options.workDir, startDir);

  const visualStyle: VisualStyleId = doc.project.visualStyle ?? 'diorama-maket';
  const captionStyle: CaptionStyleId = doc.project.captionStyle ?? 'bold-stroke';
  const look = VISUAL_LOOKS_CATALOG[visualStyle];
  const characterDockHtml = buildConsistentCharacterDockHtml(doc.project.character);
  const hasCharacterDock = characterDockHtml.length > 0;

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
      const preset = lk === 'threejs' ? s.scene.backgroundLayer.preset : null;
      const presetCfg = preset ? THREEJS_PRESETS[preset] : null;
      return {
        id: s.id,
        start: s.start,
        duration: s.duration,
        kind: lk,
        motion: lk === 'ai-image' ? s.scene.backgroundLayer.cameraMotion : null,
        seriesCount: lk === 'chart' ? s.scene.backgroundLayer.series.length : 0,
        preset,
        accentHex: presetCfg ? presetCfg.accentHex : null,
        bgHex: presetCfg ? presetCfg.backgroundHex : null,
        wordSpanClass: lk === 'typography' ? `hw-scene_${s.index}` : null,
        subId: lk === 'typography' ? `scene_${s.index}_sub` : null,
        cardId: lk === 'threejs' ? `scene_${s.index}_card` : null,
        ribbonId: lk === 'threejs' ? `scene_${s.index}_ribbon` : null,
        panelId: lk === 'chart' ? `scene_${s.index}_panel` : null,
        imgId: lk === 'ai-image' ? `scene_${s.index}_img` : null,
        overlayId: lk === 'ai-image' ? `scene_${s.index}_overlay` : null,
      };
    }),
  );

  const scenesMarkup = timelineScenes
    .map((s) => buildSceneMarkup(s.scene, s.index, s.start, s.duration, visualStyle, hasCharacterDock, s.asset))
    .join('\n');

  const audioMarkup = options.voiceoverRelPath
    ? `<audio id="voiceover" src="${escapeHtml(options.voiceoverRelPath)}" data-start="0" data-duration="${totalDuration}" data-volume="1"></audio>`
    : '';

  const stageBgGradient = `linear-gradient(180deg, ${look.skyTop} 0%, ${look.skyBottom} 100%)`;

  const threeModuleScript = hasThreeModule
    ? `<script type="module">\n${buildSharedThreeJsModuleScript()}\nif (typeof window.__syncActiveFrame === 'function') window.__syncActiveFrame();\n</script>`
    : '';

  const html = `<!doctype html>
<html lang="${doc.project.locale === 'id-ID' ? 'id' : 'en'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(doc.project.title)}</title>
    <script src="./vendor/gsap.min.js"></script>
    <style>
      ${loadedFontCss}
      :root {
        --ease-spring: linear(0, 0.016, 0.058, 0.115, 0.181, 0.251, 0.322, 0.391, 0.457, 0.519, 0.575, 0.627, 0.674, 0.715, 0.753, 0.786, 0.815, 0.84, 0.862, 0.882, 0.899, 0.913, 0.926, 0.937, 0.946, 0.954, 0.961, 0.967, 0.972, 0.976, 0.98, 0.983, 0.986, 0.988, 0.99, 0.991, 0.993, 0.994, 0.995, 0.996, 0.996, 0.997, 0.997, 0.998, 0.998, 0.999, 0.999, 0.999, 1);
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: ${look.skyTop};
        color: #FFFFFF;
        font-family: ${look.fontBody};
        font-variant-numeric: tabular-nums;
        text-rendering: geometricPrecision;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: ${stageBgGradient};
      }
      #three-stage-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
      }
      .clip.scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 210px 76px 460px 76px;
        overflow: hidden;
        z-index: 5;
      }
      .clip.scene.scene-threejs {
        background: transparent;
        justify-content: flex-start;
        padding-top: 230px;
      }
      /* Fast radial glow (zero CSS blur() software compositing bottleneck) */
      .radial-glow {
        position: absolute;
        width: 900px;
        height: 900px;
        top: -120px;
        right: -180px;
        pointer-events: none;
        z-index: 0;
      }
      .scene-scenic-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
      }
      .scene-top-pill {
        position: absolute;
        top: 108px;
        left: 64px;
        padding: 12px 24px;
        background: #11131D;
        border: 2px solid rgba(255,255,255,0.85);
        border-left: 8px solid #EF4444;
        border-radius: 12px;
        color: #FFFFFF;
        font-size: 26px;
        font-weight: 900;
        letter-spacing: 0.1em;
        z-index: 12;
        box-shadow: 0 10px 24px rgba(0,0,0,0.32);
      }
      .typo-content {
        position: relative;
        z-index: 6;
        width: 100%;
      }
      .typo-content.has-char-margin {
        padding-top: 120px;
      }
      .typo-diorama-panel {
        padding: 34px 30px;
        border-radius: 26px;
        background: rgba(17, 19, 29, 0.84);
        border: 3px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.36);
      }
      .typo-dark-panel {
        padding: 40px 36px;
        border-radius: 26px;
        background: rgba(11, 13, 24, 0.88);
        border: 2px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.45);
      }
      .typo-headline {
        font-family: ${look.fontDisplay};
        font-size: 68px;
        line-height: 1.12;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: #FFFFFF;
      }
      .typo-headline-outlined {
        -webkit-text-stroke: 8px #0B0F1A;
        paint-order: stroke fill;
      }
      .hw {
        display: inline-block;
        opacity: 0;
        transform: translateY(22px);
      }
      .hw-highlight {
        color: #FACC15;
      }
      .typo-sub {
        margin-top: 24px;
        font-size: 34px;
        line-height: 1.35;
        font-weight: 700;
        color: #E2E8F0;
      }

      /* Tahu Bareng style dark navy callout pill + red stripe + bottom teeth */
      .tb-callout {
        position: relative;
        display: inline-flex;
        align-items: stretch;
        background: #11131D;
        border: 3px solid #FFFFFF;
        border-radius: 16px;
        margin-bottom: 24px;
        box-shadow: 0 12px 26px rgba(0, 0, 0, 0.35);
        max-width: 100%;
      }
      .tb-callout-stripe {
        width: 10px;
        border-radius: 12px 0 0 12px;
        flex-shrink: 0;
      }
      .tb-callout-body {
        padding: 16px 26px;
      }
      .tb-callout-title {
        font-size: 38px;
        font-weight: 900;
        color: #FFFFFF;
        line-height: 1.18;
      }
      .tb-callout-val {
        margin-top: 6px;
        font-size: 28px;
        font-weight: 800;
        color: #FACC15;
      }
      .tb-callout-teeth {
        position: absolute;
        left: 24px;
        bottom: -20px;
        font-size: 20px;
        line-height: 1;
        color: #EF4444;
        letter-spacing: 3px;
      }
      .three-top-callout {
        position: relative;
        z-index: 10;
        width: 100%;
      }
      .three-sub-ribbon {
        margin-top: 26px;
        padding: 18px 24px;
        background: rgba(17, 19, 29, 0.88);
        border: 2px solid rgba(255,255,255,0.65);
        border-radius: 16px;
        font-size: 36px;
        line-height: 1.28;
        font-weight: 800;
        color: #FFFFFF;
        max-width: 720px;
      }

      /* Chart panel */
      .chart-panel-clean {
        position: relative;
        z-index: 6;
        width: 100%;
        padding: 40px 36px;
        border-radius: 26px;
        background: #11131D;
        border: 3px solid #FFFFFF;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
      }
      .tb-callout-stripe-top {
        width: 96px;
        height: 8px;
        border-radius: 999px;
        margin-bottom: 16px;
      }
      .chart-eyebrow {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.16em;
        margin-bottom: 10px;
      }
      .chart-title-clean {
        font-size: 42px;
        font-weight: 900;
        line-height: 1.2;
        margin-bottom: 28px;
        color: #FFFFFF;
      }
      .chart-list-clean {
        display: grid;
        gap: 24px;
      }
      .chart-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 30px;
        font-weight: 800;
        margin-bottom: 10px;
      }
      .chart-label-text { color: #E2E8F0; }
      .chart-val { font-size: 34px; font-weight: 900; }
      .chart-track-inner {
        height: 28px;
        border-radius: 999px;
        background: #1E293B;
        overflow: hidden;
      }
      .chart-fill {
        height: 100%;
        border-radius: 999px;
      }

      /* AI image scene */
      .ai-backdrop { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
      .ai-image { width: 100%; height: 100%; object-fit: cover; transform-origin: center center; }
      .vignette-clean {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(2,6,23,0.4) 0%, rgba(2,6,23,0.12) 45%, rgba(2,6,23,0.88) 100%);
      }
      .ai-overlay { position: relative; z-index: 10; margin-top: auto; width: 100%; }
      .ai-headline { font-size: 46px; font-weight: 900; line-height: 1.2; color: #FFFFFF; -webkit-text-stroke: 6px #090D16; paint-order: stroke fill; }

      /* Consistent Host Character Overlay */
      .char-dock {
        position: absolute;
        z-index: 45;
        pointer-events: none;
      }
      .char-pos-top-right { top: 104px; right: 56px; }
      .char-pos-top-left { top: 180px; left: 56px; }
      .char-pos-bottom-left { bottom: 380px; left: 56px; }
      .char-frame {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #11131D;
        border: 3px solid #FACC15;
        border-radius: 26px;
        padding: 8px;
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
      }
      .char-nameplate {
        margin-top: 6px;
        width: 100%;
        padding: 6px 12px;
        border-radius: 10px;
        background: #0B0F1A;
        border-left: 5px solid #FACC15;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 20px;
        font-weight: 900;
        color: #FFFFFF;
      }
      .char-live-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        display: inline-block;
      }

      /* Safe-Zone Dynamic Captions */
      #caption-dock {
        position: absolute;
        left: 56px;
        right: 96px;
        bottom: 375px;
        z-index: 60;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }
      ${buildCaptionCss(captionStyle)}

      /* Progress Rail */
      #progress-rail {
        position: absolute;
        top: 62px;
        left: 60px;
        right: 60px;
        height: 8px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.35);
        z-index: 100;
        overflow: hidden;
      }
      #progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #EF4444, #FACC15, #38BDF8);
        border-radius: 999px;
      }
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
      <canvas id="three-stage-canvas" width="${width}" height="${height}"></canvas>
      ${scenesMarkup}
      ${characterDockHtml}
      <div id="caption-dock"><div id="caption-box" style="display:none"></div></div>
      ${audioMarkup}
    </div>

    <script>
      const TOTAL_DURATION = ${totalDuration};
      const WORD_CAPTIONS = ${captionsJson};
      const SCENES_META = ${sceneMetaJson};

      function getActiveSceneAt(t) {
        for (let i = 0; i < SCENES_META.length; i++) {
          const sc = SCENES_META[i];
          if (t >= sc.start && t < sc.start + sc.duration) return sc;
        }
        return SCENES_META[SCENES_META.length - 1] || null;
      }

      function renderCaptionsAt(t) {
        const box = document.getElementById('caption-box');
        if (!box) return;
        if (!WORD_CAPTIONS.length) {
          box.style.display = 'none';
          return;
        }

        let activeIdx = WORD_CAPTIONS.findIndex((w) => t >= w.startSeconds && t <= w.endSeconds);
        if (activeIdx < 0) {
          activeIdx = WORD_CAPTIONS.findIndex((w) => w.startSeconds > t);
          if (activeIdx < 0) activeIdx = WORD_CAPTIONS.length - 1;
        }

        // Clean 2-3 word punch phrases for fast high-retention Shorts pacing
        const chunkSize = 3;
        const chunkStart = Math.floor(Math.max(0, activeIdx) / chunkSize) * chunkSize;
        const chunk = WORD_CAPTIONS.slice(chunkStart, chunkStart + chunkSize);
        if (!chunk.length) {
          box.style.display = 'none';
          return;
        }

        box.style.display = 'block';
        box.innerHTML = chunk
          .map((w) => {
            const isActive = t >= w.startSeconds && t <= w.endSeconds;
            const isSpoken = t > w.endSeconds;
            const cls = isActive ? 'cap-word active' : isSpoken ? 'cap-word spoken' : 'cap-word';
            const span = document.createElement('span');
            span.className = cls;
            span.textContent = w.word;
            return span.outerHTML;
          })
          .join(' ');
      }

      function animateCharacterAt(t) {
        const headGroup = document.getElementById('char-head-group');
        const mouthEl = document.getElementById('char-mouth');
        const tongueEl = document.getElementById('char-tongue');
        const eyeL = document.getElementById('char-eye-l');
        const eyeR = document.getElementById('char-eye-r');
        if (!headGroup) return;

        // Subtle alive breathing & head tilt
        const bobY = Math.sin(t * 2.2) * 3.0;
        const tilt = Math.sin(t * 1.4) * 1.6;
        headGroup.setAttribute('transform', 'translate(0,' + bobY.toFixed(2) + ') rotate(' + tilt.toFixed(2) + ' 100 100)');

        // Deterministic blink every 3.4s
        const blinkCycle = t % 3.4;
        const eyeRy = blinkCycle > 3.22 && blinkCycle < 3.34 ? '1.2' : '7';
        if (eyeL) eyeL.setAttribute('ry', eyeRy);
        if (eyeR) eyeR.setAttribute('ry', eyeRy);

        // Deterministic lip-sync amplitude from Whisper word timings
        const speaking = WORD_CAPTIONS.some((w) => t >= w.startSeconds && t <= w.endSeconds);
        const mouthH = speaking ? (6 + Math.abs(Math.sin(t * 24)) * 12) : 5;
        if (mouthEl) {
          mouthEl.setAttribute('height', mouthH.toFixed(1));
          mouthEl.setAttribute('y', (-mouthH / 2).toFixed(1));
        }
        if (tongueEl) {
          tongueEl.setAttribute('opacity', speaking && mouthH > 10 ? '1' : '0');
        }
      }

      function syncDeterministicFrame(t) {
        const bar = document.getElementById('progress-bar');
        if (bar) {
          bar.style.width = Math.min(100, Math.max(0, (t / TOTAL_DURATION) * 100)).toFixed(2) + '%';
        }

        const active = getActiveSceneAt(t);
        for (let i = 0; i < SCENES_META.length; i++) {
          const sc = SCENES_META[i];
          const el = document.getElementById(sc.id);
          if (!el) continue;
          const isVisible = active && sc.id === active.id;
          el.style.display = isVisible ? 'flex' : 'none';
        }

        renderCaptionsAt(t);
        animateCharacterAt(t);

        if (typeof window.__renderThreeStage === 'function') {
          window.__renderThreeStage(active, t);
        }

        if (active && active.kind === 'chart' && active.seriesCount > 0) {
          const lt = Math.max(0, Math.min(1, (t - active.start) / 0.9));
          const eased = 1 - Math.pow(1 - lt, 3);
          for (let b = 0; b < active.seriesCount; b++) {
            const fillEl = document.getElementById(active.id + '_bar_' + b);
            if (fillEl) {
              fillEl.style.width = (Number(fillEl.dataset.pct || 50) * eased).toFixed(2) + '%';
            }
          }
        }
      }

      window.__syncActiveFrame = () => syncDeterministicFrame(window.__timelines?.main?.time() || 0);
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => syncDeterministicFrame(tl.time()),
      });

      const clockProxy = { t: 0 };
      tl.to(clockProxy, { t: TOTAL_DURATION, duration: TOTAL_DURATION, ease: 'none' }, 0);

      for (const sc of SCENES_META) {
        const sel = '#' + sc.id;
        tl.fromTo(sel, { opacity: 0.25 }, { opacity: 1, duration: 0.25, ease: 'power2.out' }, sc.start);

        if (sc.kind === 'typography' && sc.wordSpanClass) {
          tl.fromTo('#' + sc.id + '_badge', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.35, ease: 'back.out(1.6)' }, sc.start + 0.04);
          tl.fromTo('.' + sc.wordSpanClass,
            { opacity: 0, y: 24, scale: 0.92 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.5)', stagger: 0.055 },
            sc.start + 0.08
          );
          if (sc.subId) {
            tl.fromTo('#' + sc.subId, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, sc.start + 0.35);
          }
        }

        if (sc.kind === 'threejs') {
          if (sc.cardId) {
            tl.fromTo('#' + sc.cardId, { opacity: 0, y: -24, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, sc.start + 0.08);
          }
          if (sc.ribbonId) {
            tl.fromTo('#' + sc.ribbonId, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, sc.start + 0.25);
          }
        }

        if (sc.kind === 'chart' && sc.panelId) {
          tl.fromTo('#' + sc.panelId, { opacity: 0, y: 36, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }, sc.start + 0.08);
        }

        if (sc.kind === 'ai-image') {
          if (sc.imgId) {
            const ep =
              sc.motion === 'ken-burns-out' ? { s: 1.0, fs: 1.16, x: 0 }
              : sc.motion === 'pan-left' ? { s: 1.12, fs: 1.12, x: -44 }
              : sc.motion === 'pan-right' ? { s: 1.12, fs: 1.12, x: 44 }
              : { s: 1.16, fs: 1.0, x: 0 };
            tl.fromTo('#' + sc.imgId, { scale: ep.fs, x: -ep.x * 0.4 }, { scale: ep.s, x: ep.x * 0.4, duration: sc.duration, ease: 'none' }, sc.start);
          }
          if (sc.overlayId) {
            tl.fromTo('#' + sc.overlayId, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, sc.start + 0.2);
          }
        }
      }

      window.__timelines['main'] = tl;
      tl.seek(0);
      syncDeterministicFrame(0);
    </script>
    ${threeModuleScript}
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
