import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectFfmpegBinary } from '@youbellkey/engine-ffmpeg';
import { resolveHyperFramesBinary } from '@youbellkey/engine-hyperframes';
import { THREEJS_PRESETS } from '@youbellkey/engine-threejs';

describe('Phase 0 E2E Environment & Monorepo Baseline', () => {
  it('verifies HyperFrames CLI binary, Three.js presets, and FFmpeg boundary inspection', async () => {
    const hfBin = resolveHyperFramesBinary(process.cwd());
    expect(hfBin).not.toBeNull();
    expect(Object.keys(THREEJS_PRESETS)).toContain('orbital-particles');

    const ffmpeg = await inspectFfmpegBinary();
    expect(ffmpeg.available).toBe(true);
    // Explicitly record whether local system ffmpeg carries GPL flags (Phase 7 packaging boundary)
    expect(typeof ffmpeg.hasGplFlags).toBe('boolean');
  });

  it('verifies all 9 custom Antigravity skills and required docs exist', () => {
    const root = process.cwd();
    const expectedSkills = [
      'yb-architect',
      'yb-license-auditor',
      'yb-video-director',
      'yb-originality-auditor',
      'yb-render-engineer',
      'yb-publishing-auditor',
      'yb-worker-reliability',
      'yb-security-auditor',
      'yb-test-engineer',
    ];
    for (const skill of expectedSkills) {
      expect(fs.existsSync(path.join(root, '.agents/skills', skill, 'SKILL.md'))).toBe(true);
    }
    expect(fs.existsSync(path.join(root, 'docs/PROJECT_MASTER_PLAN.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(true);
  });
});
