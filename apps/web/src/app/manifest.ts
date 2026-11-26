import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Youbellkey Studio',
    short_name: 'Youbellkey',
    description: 'AI Content Operating System Control Plane',
    start_url: '/',
    display: 'standalone',
    background_color: '#090D16',
    theme_color: '#090D16',
  };
}
