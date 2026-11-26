import path from 'node:path';
import { defineConfig } from 'vitest/config';

const rootDir = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@youbellkey/shared-types': path.resolve(rootDir, 'packages/shared-types/src/index.ts'),
      '@youbellkey/job-contracts': path.resolve(rootDir, 'packages/job-contracts/src/index.ts'),
      '@youbellkey/video-schema': path.resolve(rootDir, 'packages/video-schema/src/index.ts'),
      '@youbellkey/video-templates': path.resolve(rootDir, 'packages/video-templates/src/index.ts'),
      '@youbellkey/ai-gateway': path.resolve(rootDir, 'packages/ai-gateway/src/index.ts'),
      '@youbellkey/provider-adapters': path.resolve(rootDir, 'packages/provider-adapters/src/index.ts'),
      '@youbellkey/originality-engine': path.resolve(rootDir, 'packages/originality-engine/src/index.ts'),
      '@youbellkey/publishing-adapters': path.resolve(rootDir, 'packages/publishing-adapters/src/index.ts'),
      '@youbellkey/storage': path.resolve(rootDir, 'packages/storage/src/index.ts'),
      '@youbellkey/database': path.resolve(rootDir, 'packages/database/src/index.ts'),
      '@youbellkey/license-registry': path.resolve(rootDir, 'packages/license-registry/src/index.ts'),
      '@youbellkey/engine-hyperframes': path.resolve(rootDir, 'engines/hyperframes/src/index.ts'),
      '@youbellkey/engine-threejs': path.resolve(rootDir, 'engines/threejs/src/index.ts'),
      '@youbellkey/engine-ffmpeg': path.resolve(rootDir, 'engines/ffmpeg/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
