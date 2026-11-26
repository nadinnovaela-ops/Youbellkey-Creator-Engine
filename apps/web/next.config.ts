import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@youbellkey/shared-types',
    '@youbellkey/job-contracts',
    '@youbellkey/provider-adapters',
    '@youbellkey/ai-gateway',
    '@youbellkey/originality-engine',
    '@youbellkey/research-worker',
    '@youbellkey/video-schema',
    '@youbellkey/video-templates',
    '@youbellkey/database',
    '@youbellkey/storage',
  ],
};

export default nextConfig;
