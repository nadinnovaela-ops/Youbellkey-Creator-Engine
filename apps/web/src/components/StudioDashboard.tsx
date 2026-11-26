'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';
import type { StudioOverviewPayload } from '../lib/studio-overview';

type TabId = 'jobs' | 'workers' | 'channels' | 'vault';

const cardStyle: CSSProperties = {
  background: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: 14,
  padding: '1rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  borderRadius: 9,
  border: '1px solid #334155',
  background: '#020617',
  color: '#F8FAFC',
  fontSize: 14,
};

export function StudioDashboard({ initialData }: { initialData: StudioOverviewPayload }) {
  const router = useRouter();
  const [data, setData] = useState<StudioOverviewPayload>(initialData);
  const [tab, setTab] = useState<TabId>('jobs');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Worker token form
  const [workerName, setWorkerName] = useState('local-pc-01');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Channel form
  const [channelTitle, setChannelTitle] = useState('');
  const [channelId, setChannelId] = useState('');
  const [channelLocale, setChannelLocale] = useState<'id-ID' | 'en-US'>('id-ID');
  const [channelTimezone, setChannelTimezone] = useState('Asia/Jakarta');
  const [channelMode, setChannelMode] = useState<'AUTOPILOT' | 'MANUAL_REVIEW'>('AUTOPILOT');

  // Vault form
  const [providerId, setProviderId] = useState('gemini-free');
  const [providerLabel, setProviderLabel] = useState('Primary Gemini Key');
  const [providerKey, setProviderKey] = useState('');

  const refreshOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/overview', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = (await res.json()) as { ok?: boolean; data?: StudioOverviewPayload };
      if (json.ok && json.data) {
        setData(json.data);
      }
    } catch {
      // Keep last known state on transient network hiccups.
    }
  }, [router]);

  const hasActiveJobs = data.jobs.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING');

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = setInterval(() => {
      void refreshOverview();
    }, 3000);
    return () => clearInterval(timer);
  }, [hasActiveJobs, refreshOverview]);

  async function toggleKillSwitch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/studio/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killSwitchActive: !data.workspace.killSwitchActive }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status Kill Switch');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function enqueueSmokeJob() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/jobs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Smoke test dari Studio PWA' }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal antrekan job');
      setNotice('Job uji coba masuk antrean. Jalankan local-worker di PC untuk melihat progress live.');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function createWorkerToken(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setGeneratedToken(null);
    try {
      const res = await fetch('/api/studio/workers/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerName }),
      });
      const json = (await res.json()) as { ok?: boolean; rawToken?: string; error?: { message?: string } };
      if (!res.ok || !json.ok || !json.rawToken) throw new Error(json.error?.message ?? 'Gagal buat token');
      setGeneratedToken(json.rawToken);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function saveChannel(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'youtube_shorts',
          externalChannelId: channelId,
          title: channelTitle,
          locale: channelLocale,
          timezone: channelTimezone,
          workflowMode: channelMode,
          dailyPublishCap: 3,
          autopilotEnabled: channelMode === 'AUTOPILOT',
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal simpan channel');
      setChannelTitle('');
      setChannelId('');
      setNotice('Channel berhasil disimpan.');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function saveProviderKey(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          label: providerLabel,
          apiKey: providerKey,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal enkripsi key');
      setProviderKey('');
      setNotice('API key dienkripsi AES-256-GCM dan disimpan di Supabase.');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', display: 'grid', gap: '1rem' }}>
      {/* Top Bar */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 700, letterSpacing: 0.8 }}>
            YOUBELLKEY STUDIO · PHASE 1
          </span>
          <h1 style={{ margin: '2px 0', fontSize: '1.35rem' }}>{data.workspace.name}</h1>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{data.userEmail}</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void refreshOverview()}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 9,
              border: '1px solid #334155',
              background: '#0F172A',
              color: '#E2E8F0',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 9,
              border: '1px solid #334155',
              background: '#020617',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* 1-Tap Kill Switch Banner */}
      <section
        style={{
          ...cardStyle,
          borderColor: data.workspace.killSwitchActive ? '#DC2626' : '#059669',
          background: data.workspace.killSwitchActive ? '#2A0A0A' : '#052016',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <strong style={{ fontSize: 15 }}>
            {data.workspace.killSwitchActive ? 'KILL SWITCH AKTIF (Publikasi Dihentikan)' : 'Autopilot Siap (Kill Switch Mati)'}
          </strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#CBD5E1' }}>
            Kontrol darurat lintas worker dari HP. Saat aktif, seluruh upload otomatis diblokir seketika.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleKillSwitch()}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: data.workspace.killSwitchActive ? '#10B981' : '#EF4444',
            color: '#FFFFFF',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {data.workspace.killSwitchActive ? 'Aktifkan Kembali' : 'MATIKAN SEMUA (Kill Switch)'}
        </button>
      </section>

      {/* Readiness Pills */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
        {[
          { label: 'Supabase RLS', ok: true },
          { label: 'AES-256 Vault', ok: data.readiness.secretsMasterKeyConfigured },
          { label: 'Gemini Env', ok: data.readiness.geminiEnvConfigured },
          { label: 'Groq Env', ok: data.readiness.groqEnvConfigured },
          { label: 'Cloudflare R2', ok: data.readiness.r2Configured },
        ].map((item) => (
          <span
            key={item.label}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 999,
              border: `1px solid ${item.ok ? '#065F46' : '#78350F'}`,
              background: item.ok ? '#052E16' : '#451A03',
              color: item.ok ? '#6EE7B7' : '#FCD34D',
            }}
          >
            {item.ok ? '✓' : '!'} {item.label}
          </span>
        ))}
      </section>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: 10, background: '#450A0A', color: '#FCA5A5', fontSize: 13 }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ padding: '0.75rem', borderRadius: 10, background: '#052E16', color: '#86EFAC', fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            ['jobs', `Jobs (${data.jobs.length})`],
            ['workers', `Workers (${data.workers.length})`],
            ['channels', `Channels (${data.channels.length})`],
            ['vault', `AI Vault (${data.providers.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: 10,
              border: '1px solid',
              borderColor: tab === id ? '#38BDF8' : '#1E293B',
              background: tab === id ? '#0C4A6E' : '#0F172A',
              color: '#F8FAFC',
              fontWeight: tab === id ? 700 : 500,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab 1: Jobs */}
      {tab === 'jobs' && (
        <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Antrean Pekerjaan (Postgres Lease Queue)</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
                Klik tombol di kanan untuk menguji komunikasi Control Plane Vercel → Supabase → Worker PC.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void enqueueSmokeJob()}
              style={{
                padding: '0.6rem 0.95rem',
                borderRadius: 10,
                border: 'none',
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Kirim Job Uji Coba
            </button>
          </div>

          {data.jobs.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Belum ada job di workspace ini.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.jobs.map((job) => (
                <div
                  key={job.id}
                  style={{ padding: '0.75rem', borderRadius: 10, background: '#020617', border: '1px solid #1E293B' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <strong>{job.jobType}</strong>
                    <span style={{ color: '#38BDF8', fontWeight: 600 }}>
                      {job.status} ({job.progress}%)
                    </span>
                  </div>
                  <div style={{ marginTop: 6, height: 6, background: '#1E293B', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, job.progress))}%`, height: '100%', background: '#38BDF8' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                    Attempt {job.attemptCount}/{job.maxAttempts} · {job.id.slice(0, 8)}
                    {job.errorMessage ? ` · ${job.errorMessage}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Workers */}
      {tab === 'workers' && (
        <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Universal Workers (PC &amp; Docker ARM64)</h2>
          <form onSubmit={createWorkerToken} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="Nama worker (mis. local-pc-01)"
              style={{ ...inputStyle, flex: '1 1 200px' }}
              required
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 9,
                border: 'none',
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Buat Worker Token
            </button>
          </form>

          {generatedToken && (
            <div style={{ padding: '0.75rem', borderRadius: 10, background: '#172554', border: '1px solid #3B82F6', fontSize: 12 }}>
              <strong>Salin Token Sekarang (hanya tampil sekali):</strong>
              <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{generatedToken}</pre>
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            {data.workers.map((w) => (
              <div
                key={w.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: '#020617',
                  border: '1px solid #1E293B',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{w.workerName}</strong>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    {w.platformArch} · [{w.capabilities.join(', ')}]
                  </div>
                </div>
                <span style={{ color: w.status === 'OFFLINE' ? '#94A3B8' : '#34D399', fontWeight: 700 }}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Channels */}
      {tab === 'channels' && (
        <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Channel Terhubung (ID &amp; EN)</h2>
          <form onSubmit={saveChannel} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <input
                value={channelTitle}
                onChange={(e) => setChannelTitle(e.target.value)}
                placeholder="Nama Channel"
                style={inputStyle}
                required
              />
              <input
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="YouTube Channel ID (UC...)"
                style={inputStyle}
                required
              />
              <select
                value={channelLocale}
                onChange={(e) => {
                  const loc = e.target.value as 'id-ID' | 'en-US';
                  setChannelLocale(loc);
                  setChannelTimezone(loc === 'id-ID' ? 'Asia/Jakarta' : 'America/New_York');
                }}
                style={inputStyle}
              >
                <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                <option value="en-US">English (en-US)</option>
              </select>
              <select
                value={channelMode}
                onChange={(e) => setChannelMode(e.target.value as 'AUTOPILOT' | 'MANUAL_REVIEW')}
                style={inputStyle}
              >
                <option value="AUTOPILOT">AUTOPILOT (Guardrails)</option>
                <option value="MANUAL_REVIEW">MANUAL REVIEW</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                justifySelf: 'start',
                padding: '0.6rem 1rem',
                borderRadius: 9,
                border: 'none',
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Simpan Channel
            </button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {data.channels.map((ch) => (
              <div
                key={ch.id}
                style={{ padding: '0.75rem', borderRadius: 10, background: '#020617', border: '1px solid #1E293B', fontSize: 13 }}
              >
                <strong>{ch.title}</strong> ({ch.locale} · {ch.timezone})
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                  {ch.platform} · {ch.externalChannelId} · Mode: {ch.workflowMode} · Cap: {ch.dailyPublishCap}/hari
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 4: AI Vault */}
      {tab === 'vault' && (
        <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>AI Provider BYOK Vault (AES-256-GCM)</h2>
          <form onSubmit={saveProviderKey} style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={inputStyle}>
                {data.availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
              <input
                value={providerLabel}
                onChange={(e) => setProviderLabel(e.target.value)}
                placeholder="Label (mis. Gemini Pribadi)"
                style={inputStyle}
                required
              />
              <input
                type="password"
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                placeholder="Tempel API key..."
                style={inputStyle}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                justifySelf: 'start',
                padding: '0.6rem 1rem',
                borderRadius: 9,
                border: 'none',
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Enkripsi &amp; Simpan Key
            </button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {data.providers.map((p) => (
              <div
                key={p.id}
                style={{ padding: '0.75rem', borderRadius: 10, background: '#020617', border: '1px solid #1E293B', fontSize: 13 }}
              >
                <strong>{p.provider}</strong> — {p.label}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
