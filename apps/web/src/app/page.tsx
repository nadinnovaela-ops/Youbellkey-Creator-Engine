export default function HomePage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Youbellkey Studio</h1>
      <p style={{ color: '#94A3B8', marginBottom: '1.5rem' }}>
        Phase 0 Baseline — Control Plane (Vercel + Supabase + Cloudflare R2 + Universal HyperFrames Worker)
      </p>
      <section style={{ padding: '1rem', borderRadius: 12, border: '1px solid #1E293B', background: '#0F172A' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Status Arsitektur V1</h2>
        <ul style={{ lineHeight: 1.7, color: '#CBD5E1', paddingLeft: '1.25rem' }}>
          <li>Format V1: Vertical Short-Form 9:16 (Bahasa Indonesia &amp; English)</li>
          <li>Master Renderer: HyperFrames (Template-Driven YB Video Document v1.0)</li>
          <li>Publishing V1: YouTube Shorts Autopilot + Guardrails &amp; Kill Switch</li>
        </ul>
      </section>
    </main>
  );
}
