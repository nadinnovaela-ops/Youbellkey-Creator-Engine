import { redirect } from 'next/navigation';
import { StudioDashboard } from '../components/StudioDashboard';
import { getAuthenticatedWorkspace } from '../lib/auth';
import { loadStudioOverview } from '../lib/studio-overview';
import { isSupabaseConfigured } from '../lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main style={{ maxWidth: 680, margin: '2rem auto', padding: '1.25rem' }}>
        <h1>Youbellkey Studio</h1>
        <p style={{ color: '#FCA5A5' }}>
          Environment Supabase belum lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan
          SUPABASE_SERVICE_ROLE_KEY sudah diisi di Vercel lalu Redeploy.
        </p>
      </main>
    );
  }

  const ctx = await getAuthenticatedWorkspace();
  if (!ctx) {
    redirect('/login');
  }

  const overview = await loadStudioOverview(ctx);
  return <StudioDashboard initialData={overview} />;
}
