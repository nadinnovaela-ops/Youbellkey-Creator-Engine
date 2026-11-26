import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Youbellkey Studio',
  description: 'AI Content Operating System — Hybrid Ringan Control Plane',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#090D16', color: '#F8FAFC' }}>
        {children}
      </body>
    </html>
  );
}
