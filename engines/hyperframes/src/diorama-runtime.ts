/**
 * Returns the self-contained ES module runtime that mounts a single shared
 * Three.js WebGLRenderer (`three.module.js`) and switches between 7 deterministic
 * 3D presets, including Tahu-Bareng-inspired stylized cel-shaded 3D dioramas:
 *   - diorama-city-flood
 *   - diorama-volume-cube
 *   - diorama-cutaway-strata
 *   - diorama-map-compare
 * plus upgraded 3D presets:
 *   - orbital-particles
 *   - floating-cards
 *   - data-bars-3d
 *
 * Uses one shared GPU/SwiftShader context across all scenes so Chromium
 * never exceeds WebGL context limits or suffers memory thrash.
 */
export function buildSharedThreeJsModuleScript(): string {
  return `
    import * as THREE from './vendor/three.module.js';

    const canvas = document.getElementById('three-stage-canvas');
    if (canvas) {
      let renderer = null;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: 'default',
        });
        renderer.setSize(canvas.width || 1080, canvas.height || 1920, false);
        renderer.setPixelRatio(1);
      } catch (err) {
        console.warn('[three-stage] WebGL init fallback:', err);
        renderer = null;
      }

      if (renderer) {
        const camera = new THREE.PerspectiveCamera(44, (canvas.width || 1080) / (canvas.height || 1920), 0.1, 200);
        const sceneCache = new Map();

        function outlineMesh(mesh, color = 0x0f172a) {
          const edges = new THREE.EdgesGeometry(mesh.geometry, 24);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 })
          );
          mesh.add(line);
          return mesh;
        }

        function createBuildingTexture() {
          const c = document.createElement('canvas');
          c.width = 128;
          c.height = 256;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(0, 0, 128, 256);
          ctx.fillStyle = '#334155';
          for (let y = 12; y < 244; y += 22) {
            for (let x = 10; x < 118; x += 22) {
              ctx.fillRect(x, y, 14, 14);
            }
          }
          const tex = new THREE.CanvasTexture(c);
          tex.needsUpdate = true;
          return tex;
        }

        function createSeeded(seedInit) {
          let s = (seedInit >>> 0) || 1337;
          return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
          };
        }

        function addLighting(sc, warm = false) {
          sc.add(new THREE.AmbientLight(warm ? 0xffedd5 : 0xffffff, 0.85));
          const sun = new THREE.DirectionalLight(warm ? 0xfdba74 : 0xffffff, 1.35);
          sun.position.set(8, 14, 10);
          sc.add(sun);
          const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
          fill.position.set(-8, 6, -6);
          sc.add(fill);
        }

        function addClouds(sc, rng, yBase = 5.5) {
          const cloudGroup = new THREE.Group();
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
          for (let c = 0; c < 6; c++) {
            const cluster = new THREE.Group();
            const bx = (rng() - 0.5) * 14;
            const by = yBase + (rng() - 0.5) * 1.8;
            const bz = -6 - rng() * 6;
            for (let p = 0; p < 3; p++) {
              const puff = new THREE.Mesh(new THREE.SphereGeometry(0.65 + rng() * 0.45, 12, 10), mat);
              puff.position.set((p - 1) * 0.7, p === 1 ? 0.25 : 0, 0);
              cluster.add(puff);
            }
            cluster.position.set(bx, by, bz);
            cluster.userData = { baseX: bx, speed: 0.14 + rng() * 0.12 };
            cloudGroup.add(cluster);
          }
          sc.add(cloudGroup);
          return cloudGroup;
        }

        function getOrCreateScene(preset, accentHex) {
          const key = preset + '|' + accentHex;
          if (sceneCache.has(key)) return sceneCache.get(key);

          const sc = new THREE.Scene();
          const rng = createSeeded(key.length * 997 + 42);
          const accentNum = parseInt((accentHex || '#38BDF8').slice(1, 7), 16) || 0x38bdf8;
          let updater = () => {};

          if (preset === 'diorama-city-flood') {
            addLighting(sc);
            const clouds = addClouds(sc, rng, 6.2);
            const bTex = createBuildingTexture();

            // City maket skyline + miniature diorama slab base
            const cityGroup = new THREE.Group();
            const baseEarth = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(10.8, 0.9, 10.8),
              new THREE.MeshToonMaterial({ color: 0x334155 })
            ));
            baseEarth.position.y = -2.65;
            const cityRoad = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(10.6, 0.16, 10.6),
              new THREE.MeshToonMaterial({ color: 0x94a3b8 })
            ));
            cityRoad.position.y = -2.14;
            cityGroup.add(baseEarth, cityRoad);

            for (let i = 0; i < 20; i++) {
              const w = 0.62 + rng() * 0.65;
              const h = 1.4 + rng() * 3.1;
              const d = 0.62 + rng() * 0.65;
              const mesh = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                new THREE.MeshToonMaterial({ map: bTex, color: i % 3 === 0 ? 0xf8fafc : 0xe2e8f0 })
              ));
              const angle = (i / 20) * Math.PI * 2;
              const rad = 2.0 + rng() * 2.8;
              mesh.position.set(Math.cos(angle) * rad, h / 2 - 2.08, Math.sin(angle) * rad - 0.8);
              cityGroup.add(mesh);
            }

            // Central landmark spire (Monas-like monument + stepped skyscraper)
            const landmark = new THREE.Group();
            const basePlinth = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(1.15, 0.52, 1.15),
              new THREE.MeshToonMaterial({ color: 0xf8fafc })
            ));
            basePlinth.position.y = -1.82;
            const shaft = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(0.14, 0.25, 2.5, 8),
              new THREE.MeshToonMaterial({ color: 0xf1f5f9 })
            ));
            shaft.position.y = -0.35;
            const flame = outlineMesh(new THREE.Mesh(
              new THREE.ConeGeometry(0.24, 0.55, 8),
              new THREE.MeshToonMaterial({ color: 0xfacc15 })
            ));
            flame.position.y = 1.15;
            landmark.add(basePlinth, shaft, flame);
            cityGroup.add(landmark);

            // Tall stepped skyscraper nearby
            const sky1 = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(0.92, 4.4, 0.92),
              new THREE.MeshToonMaterial({ map: bTex, color: 0xcbd5e1 })
            ));
            sky1.position.set(1.75, 0.12, -0.35);
            const spire = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.06, 1.1, 6),
              new THREE.MeshToonMaterial({ color: 0xffffff })
            );
            spire.position.set(1.75, 2.85, -0.35);
            cityGroup.add(sky1, spire);

            // Prominent Measurement Ruler on left (alternating red/white hazard segments)
            const rulerGroup = new THREE.Group();
            for (let r = 0; r < 8; r++) {
              const seg = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(0.42, 0.62, 0.42),
                new THREE.MeshToonMaterial({ color: r % 2 === 0 ? 0xef4444 : 0xf8fafc })
              ));
              seg.position.set(-2.55, -1.75 + r * 0.62, 1.25);
              rulerGroup.add(seg);
            }
            cityGroup.add(rulerGroup);

            // Translucent Animated Water Cube covering maket cleanly within plinth bounds
            const waterGeom = new THREE.BoxGeometry(10.7, 3.8, 10.7, 8, 1, 8);
            const waterMat = new THREE.MeshToonMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.66,
            });
            const water = new THREE.Mesh(waterGeom, waterMat);
            water.position.y = -2.2;

            // Surface ripple rings
            const rings = [];
            for (let ri = 0; ri < 4; ri++) {
              const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.35 + ri * 0.2, 0.44 + ri * 0.2, 24),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
              );
              ring.rotation.x = -Math.PI / 2;
              rings.push(ring);
              sc.add(ring);
            }

            sc.add(cityGroup, water);
            updater = (localT, dur) => {
              const p = Math.min(1, localT / Math.max(2, dur));
              const level = -1.6 + Math.sin(Math.min(1, p * 1.25) * Math.PI * 0.5) * 2.1;
              water.position.y = level - 1.9;
              rings.forEach((rg, idx) => {
                const phase = (localT * 0.65 + idx * 0.25) % 1;
                rg.position.set(idx % 2 === 0 ? 0 : 1.75, level + 0.04, idx % 2 === 0 ? 0 : -0.35);
                rg.scale.setScalar(0.8 + phase * 1.8);
                rg.material.opacity = (1 - phase) * 0.65;
              });
              clouds.children.forEach((cl) => {
                cl.position.x = cl.userData.baseX + Math.sin(localT * cl.userData.speed) * 1.2;
              });
              camera.position.set(Math.sin(localT * 0.25) * 1.9, 4.3 + Math.cos(localT * 0.3) * 0.35, 13.8);
              camera.lookAt(0, -0.35, 0);
            };
          } else if (preset === 'diorama-volume-cube') {
            addLighting(sc);
            addClouds(sc, rng, 6.2);

            // Terrain base disc + soil bevel + city grid square
            const soil = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(5.5, 5.1, 0.85, 28),
              new THREE.MeshToonMaterial({ color: 0x78350f })
            ));
            soil.position.y = -2.6;
            const grass = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(5.6, 5.6, 0.35, 28),
              new THREE.MeshToonMaterial({ color: 0x65a30d })
            ));
            grass.position.y = -2.0;
            const gridBase = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(5.2, 0.08, 5.2),
              new THREE.MeshToonMaterial({ color: 0xfef3c7 })
            ));
            gridBase.position.y = -1.78;
            const grid = new THREE.GridHelper(5.2, 10, 0x78716c, 0xa8a29e);
            grid.position.y = -1.73;

            // Tiny scale trees around perimeter
            const propsGroup = new THREE.Group();
            for (let i = 0; i < 24; i++) {
              const px = (rng() - 0.5) * 4.6;
              const pz = (rng() - 0.5) * 4.6;
              if (Math.abs(px) < 1.5 && Math.abs(pz) < 1.5) continue;
              const tree = new THREE.Mesh(
                new THREE.ConeGeometry(0.14, 0.38, 6),
                new THREE.MeshToonMaterial({ color: i % 3 === 0 ? 0x166534 : 0x15803d })
              );
              tree.position.set(px, -1.56, pz);
              propsGroup.add(tree);
            }

            // Giant translucent Water/Volume Cube
            const cube = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(2.7, 2.7, 2.7),
              new THREE.MeshToonMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 })
            ), 0x0284c7);
            const innerCore = new THREE.Mesh(
              new THREE.BoxGeometry(2.2, 2.2, 2.2),
              new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45 })
            );
            cube.add(innerCore);
            cube.position.y = -0.35;

            sc.add(soil, grass, gridBase, grid, propsGroup, cube);
            updater = (localT) => {
              const dropT = Math.min(1, localT / 0.8);
              const bounce = 1 - Math.pow(1 - dropT, 3);
              cube.position.y = (1 - bounce) * 4.2 - 0.35;
              cube.rotation.y = localT * 0.32;
              camera.position.set(Math.sin(localT * 0.35) * 10.2, 4.6, Math.cos(localT * 0.35) * 10.2);
              camera.lookAt(0, -0.55, 0);
            };
          } else if (preset === 'diorama-cutaway-strata') {
            addLighting(sc, true);
            // Layered geological cross-section + lake surface at top
            const worldGroup = new THREE.Group();
            const colors = [0x65a30d, 0xa8a29e, 0x78716c, 0x57534e, 0x292524];
            colors.forEach((col, i) => {
              const h = i === 0 ? 0.38 : 0.72;
              const slab = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(7.2, h, 4.6),
                new THREE.MeshToonMaterial({ color: col })
              ));
              slab.position.y = 0.25 - i * 0.7;
              worldGroup.add(slab);
            });
            const craterLake = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(1.6, 1.3, 0.14, 16),
              new THREE.MeshToonMaterial({ color: 0x38bdf8 })
            ));
            craterLake.position.set(0, 0.46, 0.2);
            worldGroup.add(craterLake);

            // Magma core glowing sphere at center cutaway
            const magma = new THREE.Mesh(
              new THREE.SphereGeometry(0.76, 18, 16),
              new THREE.MeshBasicMaterial({ color: 0xf97316 })
            );
            magma.position.set(0, -1.25, 2.15);
            const glowSphere = new THREE.Mesh(
              new THREE.SphereGeometry(1.06, 16, 12),
              new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.38 })
            );
            magma.add(glowSphere);
            worldGroup.add(magma);

            // Stylized volcanic / energy plume spheres
            const plumes = [];
            for (let p = 0; p < 16; p++) {
              const sp = outlineMesh(new THREE.Mesh(
                new THREE.SphereGeometry(0.32 + rng() * 0.36, 10, 8),
                new THREE.MeshToonMaterial({ color: p % 4 === 0 ? 0x94a3b8 : 0x334155 })
              ), 0x0f172a);
              sp.userData = {
                offset: rng(),
                spreadX: (rng() - 0.5) * 3.0,
                spreadZ: (rng() - 0.5) * 1.5,
              };
              plumes.push(sp);
              worldGroup.add(sp);
            }

            sc.add(worldGroup);
            updater = (localT) => {
              magma.scale.setScalar(1 + Math.sin(localT * 4.5) * 0.14);
              plumes.forEach((sp) => {
                const cycle = (localT * 0.35 + sp.userData.offset) % 1;
                sp.position.set(
                  sp.userData.spreadX * cycle,
                  0.45 + cycle * 4.6,
                  sp.userData.spreadZ * cycle
                );
                sp.scale.setScalar(0.65 + Math.sin(cycle * Math.PI) * 0.9);
              });
              camera.position.set(Math.sin(localT * 0.2) * 2.2, 2.2, 13.4);
              camera.lookAt(0, -0.35, 0);
            };
          } else if (preset === 'diorama-map-compare') {
            addLighting(sc);
            addClouds(sc, rng, 6.2);
            // Stylized ocean slab + irregular emerald island + amber city overlay + location pin
            const oceanSoil = outlineMesh(new THREE.Mesh(
              new THREE.BoxGeometry(10.8, 0.7, 10.8),
              new THREE.MeshToonMaterial({ color: 0x0369a1 })
            ));
            oceanSoil.position.y = -2.25;
            const ocean = new THREE.Mesh(
              new THREE.BoxGeometry(10.8, 0.28, 10.8),
              new THREE.MeshToonMaterial({ color: 0x0ea5e9 })
            );
            ocean.position.y = -1.78;

            const islandGroup = new THREE.Group();
            const island = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(3.5, 3.85, 0.62, 14),
              new THREE.MeshToonMaterial({ color: 0x65a30d })
            ));
            island.scale.set(1.15, 1, 0.78);
            island.position.y = -1.38;

            const hills = [
              [-1.4, -0.4, 0.85],
              [1.5, 0.3, 0.72],
              [-0.8, 0.9, 0.6],
            ];
            hills.forEach(([hx, hz, hs]) => {
              const hill = outlineMesh(new THREE.Mesh(
                new THREE.ConeGeometry(hs, hs * 1.1, 7),
                new THREE.MeshToonMaterial({ color: 0x4d7c0f })
              ));
              hill.position.set(hx, -0.95, hz);
              islandGroup.add(hill);
            });

            const compareOverlay = outlineMesh(new THREE.Mesh(
              new THREE.CylinderGeometry(2.1, 2.1, 0.16, 11),
              new THREE.MeshToonMaterial({ color: 0xfef08a })
            ), 0xef4444);
            compareOverlay.scale.set(1.05, 1, 0.85);
            compareOverlay.position.y = -0.98;

            // Mini city blocks inside comparison pad
            for (let mb = 0; mb < 5; mb++) {
              const blk = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.5 + mb * 0.16, 0.35),
                new THREE.MeshToonMaterial({ color: 0xf8fafc })
              ));
              blk.position.set((mb - 2) * 0.55, 0.25 + mb * 0.08, (mb % 2 - 0.5) * 0.55);
              compareOverlay.add(blk);
            }

            const pinHead = outlineMesh(new THREE.Mesh(
              new THREE.SphereGeometry(0.48, 14, 12),
              new THREE.MeshToonMaterial({ color: 0xef4444 })
            ));
            pinHead.position.y = 0.28;
            const pinTip = new THREE.Mesh(
              new THREE.ConeGeometry(0.28, 0.8, 10),
              new THREE.MeshToonMaterial({ color: 0xef4444 })
            );
            pinTip.rotation.x = Math.PI;
            pinTip.position.y = -0.25;
            const pinGroup = new THREE.Group();
            pinGroup.add(pinHead, pinTip);

            sc.add(oceanSoil, ocean, island, islandGroup, compareOverlay, pinGroup);
            updater = (localT) => {
              const drop = Math.min(1, localT / 0.7);
              compareOverlay.position.y = -0.98 + (1 - drop) * 2.8;
              pinGroup.position.y = 0.55 + Math.abs(Math.sin(localT * 3.0)) * 0.38;
              camera.position.set(Math.sin(localT * 0.28) * 2.4, 6.2, 10.6);
              camera.lookAt(0, -0.9, 0);
            };
          } else if (preset === 'data-bars-3d') {
            addLighting(sc);
            const grid = new THREE.GridHelper(10, 12, accentNum, 0x1e293b);
            grid.position.y = -2.2;
            sc.add(grid);
            const bars = [];
            for (let b = 0; b < 9; b++) {
              const bar = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(0.58, 1, 0.58),
                new THREE.MeshToonMaterial({ color: b % 2 === 0 ? accentNum : 0x34d399 })
              ));
              bar.position.set((b - 4) * 0.85, -2.2, (b % 3 - 1) * 0.8);
              bar.userData = { targetH: 1.4 + rng() * 3.2, phase: rng() * 6.28 };
              bars.push(bar);
              sc.add(bar);
            }
            updater = (localT) => {
              bars.forEach((bar, i) => {
                const grow = Math.min(1, Math.max(0.08, (localT - i * 0.08) / 0.7));
                const h = bar.userData.targetH * (0.85 + 0.15 * Math.sin(localT * 2 + bar.userData.phase)) * grow;
                bar.scale.y = h;
                bar.position.y = -2.2 + h / 2;
              });
              camera.position.set(Math.sin(localT * 0.3) * 4.5, 2.1, Math.cos(localT * 0.3) * 6.5);
              camera.lookAt(0, -0.4, 0);
            };
          } else if (preset === 'floating-cards') {
            addLighting(sc);
            const cards = [];
            for (let c = 0; c < 14; c++) {
              const card = outlineMesh(new THREE.Mesh(
                new THREE.BoxGeometry(1.4, 0.9, 0.08),
                new THREE.MeshToonMaterial({ color: c % 3 === 0 ? accentNum : 0x1e293b, transparent: true, opacity: 0.88 })
              ), accentNum);
              card.userData = {
                x: (rng() - 0.5) * 5.2,
                y: (rng() - 0.5) * 6.0,
                z: (rng() - 0.5) * 4.5,
                phase: rng() * 6.28,
              };
              cards.push(card);
              sc.add(card);
            }
            updater = (localT) => {
              cards.forEach((cd) => {
                cd.position.set(
                  cd.userData.x + Math.sin(localT * 0.7 + cd.userData.phase) * 0.35,
                  cd.userData.y + Math.cos(localT * 0.55 + cd.userData.phase) * 0.3,
                  cd.userData.z
                );
                cd.rotation.y = Math.sin(localT * 0.5 + cd.userData.phase) * 0.3;
              });
              camera.position.set(Math.sin(localT * 0.22) * 1.4, 0.4, 7.2);
              camera.lookAt(0, 0, 0);
            };
          } else {
            // orbital-particles
            addLighting(sc);
            const core = outlineMesh(new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.95, 1),
              new THREE.MeshToonMaterial({ color: accentNum })
            ));
            const ring1 = new THREE.Mesh(
              new THREE.TorusGeometry(2.1, 0.04, 8, 48),
              new THREE.MeshBasicMaterial({ color: accentNum })
            );
            ring1.rotation.x = Math.PI * 0.38;
            const ring2 = new THREE.Mesh(
              new THREE.TorusGeometry(2.8, 0.03, 8, 48),
              new THREE.MeshBasicMaterial({ color: 0xfacc15 })
            );
            ring2.rotation.y = Math.PI * 0.35;
            const sats = [];
            for (let i = 0; i < 24; i++) {
              const sat = new THREE.Mesh(
                new THREE.SphereGeometry(0.1 + rng() * 0.12, 8, 8),
                new THREE.MeshToonMaterial({ color: i % 3 === 0 ? 0xfacc15 : accentNum })
              );
              sat.userData = { angle: (i / 24) * 6.28, rad: 1.8 + rng() * 1.6, speed: 0.4 + rng() * 0.6, yOff: (rng() - 0.5) * 2.2 };
              sats.push(sat);
              sc.add(sat);
            }
            sc.add(core, ring1, ring2);
            updater = (localT) => {
              core.rotation.y = localT * 0.8;
              core.rotation.x = localT * 0.4;
              ring1.rotation.z = localT * 0.5;
              ring2.rotation.x = localT * 0.4;
              sats.forEach((s) => {
                const a = s.userData.angle + localT * s.userData.speed;
                s.position.set(Math.cos(a) * s.userData.rad, s.userData.yOff + Math.sin(localT + a) * 0.35, Math.sin(a) * s.userData.rad);
              });
              camera.position.set(Math.sin(localT * 0.25) * 1.1, 0.7, 6.8);
              camera.lookAt(0, 0, 0);
            };
          }

          const entry = { sc, updater };
          sceneCache.set(key, entry);
          return entry;
        }

        window.__renderThreeStage = function(scMeta, globalT) {
          if (!scMeta || scMeta.kind !== 'threejs') {
            canvas.style.opacity = '0';
            return;
          }
          canvas.style.opacity = '1';
          const entry = getOrCreateScene(scMeta.preset || 'orbital-particles', scMeta.accentHex || '#38BDF8');
          entry.updater(Math.max(0, globalT - scMeta.start), scMeta.duration);
          renderer.render(entry.sc, camera);
        };
      }
    }
  `;
}
