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
  }

  return { hasThreeModule };
}

function buildSceneMarkup(
  scene: YBScene,
  index: number,
  startSeconds: number,
  durationSeconds: number,
  assetBinding?: SceneAssetBinding,
): string {
  const layer = scene.backgroundLayer;
  const safeId = `scene_${index}`;

  let backgroundHtml = '';
  if (layer.kind === 'ai-image') {
    const src = escapeHtml(assetBinding?.imageRelPath ?? './assets/missing.svg');
    backgroundHtml = `
      <div class="ai-backdrop">
        <img id="${safeId}_img" class="ai-image motion-${escapeHtml(layer.cameraMotion)}" src="${src}" alt="" />
        <div class="vignette"></div>
      </div>
      <div class="editorial-tag">
        <span class="scene-badge">SCENE ${index + 1}</span>
        <h2 class="scene-title">${escapeHtml(scene.voiceover.text.slice(0, 88))}</h2>
      </div>
    `;
  } else if (layer.kind === 'threejs') {
    const presetCfg = THREEJS_PRESETS[layer.preset];
    backgroundHtml = `
      <canvas
        id="${safeId}_three"
        class="three-canvas"
        data-preset="${escapeHtml(layer.preset)}"
        data-accent="${escapeHtml(presetCfg.accentHex)}"
        data-bg="${escapeHtml(presetCfg.backgroundHex)}"
        data-particles="${presetCfg.defaultParticleCount}"
      ></canvas>
      <div class="card-overlay">
        <span class="scene-badge">3D · ${escapeHtml(layer.preset.toUpperCase())}</span>
        <h2 class="hero-headline">${escapeHtml(scene.voiceover.text.slice(0, 110))}</h2>
      </div>
    `;
  } else if (layer.kind === 'chart') {
    const maxVal = Math.max(1, ...layer.series.map((s) => Math.abs(s.value)));
    const barsHtml = layer.series
      .map((item, bIdx) => {
        const pct = Math.max(8, Math.round((Math.abs(item.value) / maxVal) * 100));
        return `
          <div class="chart-row">
            <div class="chart-meta">
              <span>${escapeHtml(item.label)}</span>
              <strong id="${safeId}_val_${bIdx}" data-target="${item.value}">${item.value}</strong>
            </div>
            <div class="chart-track">
              <div id="${safeId}_bar_${bIdx}" class="chart-fill" data-pct="${pct}" style="width: 0%"></div>
            </div>
          </div>
        `;
      })
      .join('');

    backgroundHtml = `
      <div class="chart-panel">
        <span class="scene-badge">DATA INSIGHT</span>
        <h2 class="chart-title">${escapeHtml(layer.title)}</h2>
        <div class="chart-list">${barsHtml}</div>
      </div>
    `;
  } else if (layer.kind === 'typography') {
    const accent = escapeHtml(layer.accentColor ?? '#38BDF8');
    backgroundHtml = `
      <div class="kinetic-wrap" style="--scene-accent: ${accent};">
        <div class="glow-orb"></div>
        <span class="scene-badge">KEY TAKEAWAY</span>
        <h1 class="kinetic-headline">${escapeHtml(layer.headline)}</h1>
        ${layer.subheadline ? `<p class="kinetic-sub">${escapeHtml(layer.subheadline)}</p>` : ''}
      </div>
    `;
  } else {
    backgroundHtml = `
      <div class="kinetic-wrap">
        <h2 class="kinetic-headline">${escapeHtml(scene.voiceover.text)}</h2>
      </div>
    `;
  }

  return `
    <section
      id="${safeId}"
      class="clip scene"
      data-start="${startSeconds.toFixed(3)}"
      data-duration="${durationSeconds.toFixed(3)}"
      data-track-index="0"
    >
      ${backgroundHtml}
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
    timelineScenes.map((s) => ({
      id: s.id,
      start: s.start,
      duration: s.duration,
      kind: s.scene.backgroundLayer.kind,
      motion: s.scene.backgroundLayer.kind === 'ai-image' ? s.scene.backgroundLayer.cameraMotion : null,
      seriesCount: s.scene.backgroundLayer.kind === 'chart' ? s.scene.backgroundLayer.series.length : 0,
    })),
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
      :root {
        --bg-base: #060913;
        --text-main: #F8FAFC;
        --text-muted: #CBD5E1;
        --accent: #38BDF8;
        --highlight: #FACC15;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: var(--bg-base);
        color: var(--text-main);
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: radial-gradient(circle at 50% 22%, #0F172A 0%, #050811 70%, #020617 100%);
      }
      .clip.scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 180px 96px 460px 72px;
        overflow: hidden;
      }
      .scene-badge {
        display: inline-block;
        padding: 10px 22px;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.16);
        border: 2px solid rgba(56, 189, 248, 0.55);
        color: #7DD3FC;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: 0.12em;
        margin-bottom: 28px;
      }
      .kinetic-wrap {
        position: relative;
        width: 100%;
        text-align: left;
        z-index: 2;
      }
      .glow-orb {
        position: absolute;
        width: 540px;
        height: 540px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0) 70%);
        top: -220px;
        right: -140px;
        pointer-events: none;
      }
      .kinetic-headline {
        font-size: 74px;
        line-height: 1.12;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: #FFFFFF;
        text-shadow: 0 12px 38px rgba(0, 0, 0, 0.55);
      }
      .kinetic-sub {
        margin-top: 28px;
        font-size: 36px;
        line-height: 1.35;
        font-weight: 600;
        color: var(--text-muted);
      }
      .three-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }
      .card-overlay {
        position: relative;
        z-index: 2;
        width: 100%;
        padding: 46px;
        border-radius: 32px;
        background: rgba(15, 23, 42, 0.72);
        border: 2px solid rgba(56, 189, 248, 0.35);
      }
      .hero-headline {
        font-size: 54px;
        line-height: 1.24;
        font-weight: 800;
      }
      .chart-panel {
        width: 100%;
        padding: 44px;
        border-radius: 32px;
        background: rgba(15, 23, 42, 0.85);
        border: 2px solid rgba(148, 163, 184, 0.28);
      }
      .chart-title {
        font-size: 48px;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 36px;
      }
      .chart-list {
        display: grid;
        gap: 28px;
      }
      .chart-meta {
        display: flex;
        justify-content: space-between;
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .chart-track {
        width: 100%;
        height: 30px;
        border-radius: 999px;
        background: #1E293B;
        overflow: hidden;
      }
      .chart-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #0284C7 0%, #38BDF8 100%);
      }
      .ai-backdrop {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
      }
      .ai-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform-origin: center center;
      }
      .vignette {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0.18) 45%, rgba(2,6,23,0.88) 100%);
      }
      .editorial-tag {
        position: relative;
        z-index: 2;
        width: 100%;
        margin-top: auto;
        padding-bottom: 60px;
      }
      .scene-title {
        font-size: 46px;
        font-weight: 800;
        line-height: 1.22;
        text-shadow: 0 6px 24px rgba(0, 0, 0, 0.85);
      }
      /* Shorts Safe-Zone Dynamic Captions (Above bottom UI 340px & inside right margin) */
      #caption-dock {
        position: absolute;
        left: 64px;
        right: 128px;
        bottom: 350px;
        z-index: 30;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }
      #caption-box {
        padding: 18px 28px;
        border-radius: 22px;
        background: rgba(2, 6, 23, 0.82);
        border: 2px solid rgba(255, 255, 255, 0.16);
        text-align: center;
        font-size: 46px;
        font-weight: 900;
        line-height: 1.24;
        letter-spacing: -0.01em;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.65);
      }
      .cap-word {
        display: inline-block;
        margin: 0 7px;
        color: #E2E8F0;
      }
      .cap-word.active {
        color: var(--highlight);
        transform: scale(1.08);
      }
      .cap-word.spoken {
        color: #FFFFFF;
      }
      #progress-rail {
        position: absolute;
        top: 64px;
        left: 64px;
        right: 64px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        z-index: 40;
        overflow: hidden;
      }
      #progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #38BDF8, #34D399);
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
      ${scenesMarkup}
      <div id="caption-dock"><div id="caption-box" style="display:none"></div></div>
      ${audioMarkup}
    </div>

    <script>
      const TOTAL_DURATION = ${totalDuration};
      const WORD_CAPTIONS = ${captionsJson};
      const SCENES_META = ${sceneMetaJson};
      const hasThreeLocal = ${hasThreeModule ? 'true' : 'false'};

      // Build deterministic 3D / Canvas particle & bar projection per canvas
      const threeRenderers = [];
      function initCanvases() {
        const canvases = document.querySelectorAll('.three-canvas');
        for (const canvas of canvases) {
          canvas.width = ${width};
          canvas.height = ${height};
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const preset = canvas.dataset.preset || 'orbital-particles';
          const accent = canvas.dataset.accent || '#38BDF8';
          const bg = canvas.dataset.bg || '#090D16';
          const count = Math.min(240, Number(canvas.dataset.particles || 120));

          // Seeded deterministic PRNG (zero Math.random per HyperFrames determinism contract)
          let seed = 133742;
          const nextSeeded = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };

          const nodes = [];
          for (let i = 0; i < count; i++) {
            nodes.push({
              angle: nextSeeded() * Math.PI * 2,
              radius: 120 + nextSeeded() * 420,
              yOffset: (nextSeeded() - 0.5) * 1100,
              speed: 0.4 + nextSeeded() * 0.9,
              size: 4 + nextSeeded() * 14,
            });
          }

          threeRenderers.push((t) => {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const cx = canvas.width * 0.5;
            const cy = canvas.height * 0.44;
            for (let i = 0; i < nodes.length; i++) {
              const n = nodes[i];
              const theta = n.angle + t * n.speed * 0.55;
              const x3d = Math.cos(theta) * n.radius;
              const z3d = Math.sin(theta) * n.radius + 760;
              const y3d = n.yOffset + Math.sin(t * 1.2 + i) * 32;
              const perspective = 680 / Math.max(200, z3d);

              const px = cx + x3d * perspective;
              const py = cy + y3d * perspective;
              const r = Math.max(1.5, n.size * perspective);

              ctx.globalAlpha = Math.max(0.18, Math.min(0.92, perspective * 0.9));
              ctx.fillStyle = accent;

              if (preset === 'floating-cards' && i % 5 === 0) {
                ctx.fillRect(px - r * 2, py - r * 1.4, r * 4, r * 2.8);
              } else if (preset === 'data-bars-3d' && i % 3 === 0) {
                const h = Math.max(20, (Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5) * 220 * perspective);
                ctx.fillRect(px - r, cy + 120 - h, r * 2.2, h);
              } else {
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.globalAlpha = 1;
          });
        }
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

        const chunkSize = 5;
        const chunkStart = Math.floor(Math.max(0, activeIdx) / chunkSize) * chunkSize;
        const chunk = WORD_CAPTIONS.slice(chunkStart, chunkStart + chunkSize);
        if (!chunk.length) {
          box.style.display = 'none';
          return;
        }

        box.style.display = 'block';
        box.innerHTML = chunk
          .map((w) => {
            const cls =
              t >= w.startSeconds && t <= w.endSeconds
                ? 'cap-word active'
                : t > w.endSeconds
                  ? 'cap-word spoken'
                  : 'cap-word';
            const span = document.createElement('span');
            span.className = cls;
            span.textContent = w.word;
            return span.outerHTML;
          })
          .join(' ');
      }

      function syncDeterministicFrame(t) {
        const bar = document.getElementById('progress-bar');
        if (bar) {
          bar.style.width = Math.min(100, Math.max(0, (t / TOTAL_DURATION) * 100)).toFixed(2) + '%';
        }
        renderCaptionsAt(t);
        for (const draw of threeRenderers) draw(t);

        for (const sc of SCENES_META) {
          if (sc.kind === 'chart' && sc.seriesCount > 0) {
            const localT = Math.max(0, Math.min(1, (t - sc.start) / 0.85));
            const eased = 1 - Math.pow(1 - localT, 3);
            for (let b = 0; b < sc.seriesCount; b++) {
              const barEl = document.getElementById(sc.id + '_bar_' + b);
              if (barEl) {
                const targetPct = Number(barEl.dataset.pct || 50);
                barEl.style.width = (targetPct * eased).toFixed(2) + '%';
              }
            }
          }
        }
      }

      initCanvases();

      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => syncDeterministicFrame(tl.time()),
      });

      // Keep timeline spanned across full duration so tl.seek(t) always triggers deterministic updates.
      const clockProxy = { t: 0 };
      tl.to(clockProxy, { t: TOTAL_DURATION, duration: TOTAL_DURATION, ease: 'none' }, 0);

      for (const sc of SCENES_META) {
        const sel = '#' + sc.id;
        tl.fromTo(sel, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, sc.start);

        if (sc.kind === 'ai-image') {
          const imgSel = '#' + sc.id + '_img';
          const endProps =
            sc.motion === 'ken-burns-out'
              ? { scale: 1.0, fromScale: 1.16, x: 0 }
              : sc.motion === 'pan-left'
                ? { scale: 1.14, fromScale: 1.14, x: -38 }
                : sc.motion === 'pan-right'
                  ? { scale: 1.14, fromScale: 1.14, x: 38 }
                  : { scale: 1.16, fromScale: 1.0, x: 0 };
          tl.fromTo(
            imgSel,
            { scale: endProps.fromScale, x: -endProps.x * 0.5 },
            { scale: endProps.scale, x: endProps.x * 0.5, duration: sc.duration, ease: 'none' },
            sc.start,
          );
        }
      }

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
