import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@youbellkey/shared-types',
    '@youbellkey/job-contracts',
    '@youbellkey/provider-adapters',
    '@youbellkey/database',
    '@youbellkey/storage',
  ],
};

export default nextConfig;
