'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';
import type { StudioOverviewPayload } from '../lib/studio-overview';

type TabId = 'jobs' | 'research' | 'lab' | 'workers' | 'channels' | 'vault';

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

const btnPrimary: CSSProperties = {
  padding: '0.6rem 0.95rem',
  borderRadius: 9,
  border: 'none',
  background: '#0284C7',
  color: '#FFFFFF',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
};

const btnSecondary: CSSProperties = {
  padding: '0.5rem 0.85rem',
  borderRadius: 9,
  border: '1px solid #334155',
  background: '#020617',
  color: '#E2E8F0',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
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

  // Phase 2: Research forms
  const [sourceChannelInput, setSourceChannelInput] = useState('');
  const [sourceNiche, setSourceNiche] = useState('');
  const [sourceLocale, setSourceLocale] = useState<'id-ID' | 'en-US'>('id-ID');
  const [referenceUrlInput, setReferenceUrlInput] = useState('');
  const [referenceLocale, setReferenceLocale] = useState<'id-ID' | 'en-US'>('id-ID');

  // Phase 2: Content Lab Regen & Editor states
  const [labTopic, setLabTopic] = useState('');
  const [labResearchItemId, setLabResearchItemId] = useState('');
  const [labChannelId, setLabChannelId] = useState('');
  const [labLocale, setLabLocale] = useState<'id-ID' | 'en-US'>('id-ID');
  const [labTrack, setLabTrack] = useState<'MOTION_EXPLAINER' | 'AI_STORYTELLING'>('MOTION_EXPLAINER');
  const [labVariations, setLabVariations] = useState(3);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingScript, setEditingScript] = useState('');
  const [editingDocJson, setEditingDocJson] = useState('');
  const [previewVideo, setPreviewVideo] = useState<{ projectId: string; title: string; url: string } | null>(null);

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

  async function addResearchSource(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/research/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelInput: sourceChannelInput,
          niche: sourceNiche,
          locale: sourceLocale,
          syncNow: true,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        syncResult?: { savedItemsCount: number; warnings: string[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal menambah channel pantauan');
      setSourceChannelInput('');
      setSourceNiche('');
      const count = json.syncResult?.savedItemsCount ?? 0;
      setNotice(`Channel pantauan disimpan & ${count} video RSS disinkronkan.`);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function triggerResearchSync(mode: 'quick' | 'worker') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/research/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        savedItemsCount?: number;
        jobId?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal sinkronisasi riset');
      setNotice(
        mode === 'quick'
          ? `Sync cepat selesai (${json.savedItemsCount ?? 0} video diperbarui).`
          : `Job RESEARCH_SYNC (${json.jobId?.slice(0, 8)}) masuk antrean Worker.`,
      );
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function addReferenceVideoUrl(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/research/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: referenceUrlInput,
          locale: referenceLocale,
          enqueueTranscript: true,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        item?: { id: string; title: string };
        transcriptJobId?: string | null;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan URL referensi');
      setReferenceUrlInput('');
      setNotice(
        json.transcriptJobId
          ? `Referensi "${json.item?.title}" disimpan & job ekstraksi transkrip masuk antrean Worker.`
          : `Referensi "${json.item?.title}" tersimpan.`,
      );
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function requestTranscript(researchItemId: string, preferredLocale: 'id-ID' | 'en-US') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/research/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchItemId, preferredLocale }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal antrekan ekstraksi transkrip');
      setNotice('Job REFERENCE_TRANSCRIPT masuk antrean. Worker lokal akan mengekstraknya otomatis.');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function sendItemToLab(item: StudioOverviewPayload['researchItems'][number]) {
    setLabResearchItemId(item.id);
    if (!labTopic.trim()) {
      setLabTopic(item.title);
    }
    setTab('lab');
  }

  async function generateLabVariations(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/studio/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: labTopic.trim() || undefined,
          researchItemId: labResearchItemId || undefined,
          channelId: labChannelId || undefined,
          locale: labLocale,
          videoTrack: labTrack,
          variationCount: labVariations,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        projects?: Array<{ id: string }>;
        usedFallbackTemplate?: boolean;
        warnings?: string[];
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal generate variasi');
      const warnSuffix = json.warnings?.length ? ` Catatan: ${json.warnings[0]}` : '';
      setNotice(
        `${json.projects?.length ?? labVariations} variasi skrip & YB Video Document v1.0 dibuat.${warnSuffix}`,
      );
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function startEditingProject(project: StudioOverviewPayload['projects'][number]) {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
    setEditingScript(project.scriptText ?? '');
    setEditingDocJson(JSON.stringify(project.ybVideoDoc ?? {}, null, 2));
    setError(null);
  }

  async function saveEditedDocument(e: FormEvent) {
    e.preventDefault();
    if (!editingProjectId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let parsedDoc: Record<string, unknown>;
      try {
        parsedDoc = JSON.parse(editingDocJson) as Record<string, unknown>;
      } catch {
        throw new Error('JSON YB Video Document tidak valid. Periksa koma atau tanda kutip.');
      }

      const res = await fetch(`/api/studio/projects/${editingProjectId}/document`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle,
          scriptText: editingScript,
          ybVideoDoc: parsedDoc,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan YB Video Document');
      setEditingProjectId(null);
      setNotice('YB Video Document divalidasi ulang dan disimpan.');
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function triggerProjectRender(projectId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: 'looks' }),
      });
      const json = (await res.json()) as { ok?: boolean; job?: { id: string }; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal antrekan render');
      setNotice(
        `Job RENDER_HYPERFRAMES (${json.job?.id.slice(0, 8)}) masuk antrean. Worker lokal akan merender MP4 1080×1920 + subtitle kata.`,
      );
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function openProjectPreview(project: StudioOverviewPayload['projects'][number]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/projects/${project.id}/preview`, { cache: 'no-store' });
      const json = (await res.json()) as {
        ok?: boolean;
        hasCloudPreview?: boolean;
        downloadUrl?: string | null;
        message?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal memuat preview video');
      if (!json.hasCloudPreview || !json.downloadUrl) {
        setNotice(json.message ?? 'Video tersimpan lokal di ~/.youbellkey/renders/ pada PC worker (R2 belum aktif).');
        return;
      }
      setPreviewVideo({ projectId: project.id, title: project.title, url: json.downloadUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function triggerProjectPublish(project: StudioOverviewPayload['projects'][number]) {
    const channelIdToUse = project.channelId || labChannelId || data.channels[0]?.id;
    if (!channelIdToUse) {
      setError('Tambahkan atau pilih Channel YouTube terlebih dahulu sebelum publikasi.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/studio/projects/${project.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channelIdToUse,
          privacyStatus: 'private',
        }),
      });
      const json = (await res.json()) as { ok?: boolean; job?: { id: string }; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? 'Gagal menjadwalkan publikasi');
      setNotice(`Job PUBLISH_YOUTUBE_SHORTS (${json.job?.id.slice(0, 8)}) masuk antrean Worker.`);
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
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '1rem', display: 'grid', gap: '1rem' }}>
      {/* Top Bar */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 700, letterSpacing: 0.8 }}>
            YOUBELLKEY STUDIO · PHASE 3 VIDEO FACTORY ACTIVE
          </span>
          <h1 style={{ margin: '2px 0', fontSize: '1.35rem' }}>{data.workspace.name}</h1>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{data.userEmail}</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void refreshOverview()}
            style={{ ...btnSecondary, background: '#0F172A' }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{ ...btnSecondary, color: '#94A3B8' }}
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
          { label: 'YouTube API (Opsional)', ok: data.readiness.youtubeApiConfigured },
          { label: 'Cloudflare R2 (Phase 3)', ok: data.readiness.r2Configured },
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
            ['research', `Viral Research (${data.researchItems.length})`],
            ['lab', `Content Lab (${data.projects.length})`],
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
                Pantau komunikasi Control Plane Vercel → Supabase → Worker PC secara realtime.
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => void enqueueSmokeJob()} style={btnPrimary}>
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
                    <span style={{ color: job.status === 'FAILED' ? '#FCA5A5' : '#38BDF8', fontWeight: 600 }}>
                      {job.status} ({job.progress}%)
                    </span>
                  </div>
                  <div style={{ marginTop: 6, height: 6, background: '#1E293B', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, job.progress))}%`, height: '100%', background: '#38BDF8' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                    Capability: {job.requiredCapability} · Attempt {job.attemptCount}/{job.maxAttempts} · {job.id.slice(0, 8)}
                    {job.errorMessage ? ` · ${job.errorMessage}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Viral Research */}
      {tab === 'research' && (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Pantau Channel YouTube (RSS + Outlier Score)</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
                  Masukkan Channel ID (`UC...`) atau handle (`@namaChannel`) untuk memindai video terbaru.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => void triggerResearchSync('quick')} style={btnSecondary}>
                  Sync Cepat RSS
                </button>
                <button type="button" disabled={busy} onClick={() => void triggerResearchSync('worker')} style={btnPrimary}>
                  Sync via Worker
                </button>
              </div>
            </div>

            <form onSubmit={addResearchSource} style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <input
                  value={sourceChannelInput}
                  onChange={(e) => setSourceChannelInput(e.target.value)}
                  placeholder="Channel ID (UC...) atau @handle"
                  style={inputStyle}
                  required
                />
                <input
                  value={sourceNiche}
                  onChange={(e) => setSourceNiche(e.target.value)}
                  placeholder="Niche (mis. Sains, AI, Bisnis)"
                  style={inputStyle}
                  required
                />
                <select
                  value={sourceLocale}
                  onChange={(e) => setSourceLocale(e.target.value as 'id-ID' | 'en-US')}
                  style={inputStyle}
                >
                  <option value="id-ID">Indonesia (id-ID)</option>
                  <option value="en-US">English (en-US)</option>
                </select>
              </div>
              <button type="submit" disabled={busy} style={{ ...btnPrimary, justifySelf: 'start' }}>
                + Tambah &amp; Pindai Channel
              </button>
            </form>

            {data.researchSources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.researchSources.map((src) => (
                  <span
                    key={src.id}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: 8,
                      background: '#020617',
                      border: '1px solid #334155',
                      fontSize: 12,
                    }}
                  >
                    <strong>{src.niche}</strong> ({src.locale}) · {src.externalChannelId}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Tambahkan 1 URL Video / Shorts Referensi</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>
              Tempel URL video referensi → Worker PC akan mengekstrak subtitle atau transkrip audio (Groq Whisper).
            </p>
            <form onSubmit={addReferenceVideoUrl} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input
                type="url"
                value={referenceUrlInput}
                onChange={(e) => setReferenceUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/shorts/..."
                style={{ ...inputStyle, flex: '2 1 260px' }}
                required
              />
              <select
                value={referenceLocale}
                onChange={(e) => setReferenceLocale(e.target.value as 'id-ID' | 'en-US')}
                style={{ ...inputStyle, flex: '1 1 140px' }}
              >
                <option value="id-ID">Prioritas Sub ID</option>
                <option value="en-US">Prioritas Sub EN</option>
              </select>
              <button type="submit" disabled={busy} style={btnPrimary}>
                Simpan &amp; Ekstrak Transkrip
              </button>
            </form>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Video Referensi &amp; Skor Viral ({data.researchItems.length})</h2>
            {data.researchItems.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13 }}>Belum ada item riset. Tambahkan channel atau URL video di atas.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.researchItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 10,
                      background: '#020617',
                      border: '1px solid #1E293B',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{item.title}</strong>
                      <span style={{ color: '#38BDF8', fontWeight: 700, fontSize: 12 }}>
                        Viral: {item.viralScore} · Outlier: {item.outlierScore}x · Views: {item.viewCount.toLocaleString()}
                      </span>
                    </div>
                    {item.transcriptPreview && (
                      <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', background: '#0F172A', padding: '0.5rem', borderRadius: 8 }}>
                        Transkrip: {item.transcriptPreview}
                        {(item.transcriptText?.length ?? 0) > 180 ? '...' : ''}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                      <button type="button" onClick={() => sendItemToLab(item)} style={btnPrimary}>
                        Bawa ke Content Lab →
                      </button>
                      {!item.hasTranscript && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void requestTranscript(item.id, labLocale)}
                          style={btnSecondary}
                        >
                          Ekstrak Transkrip (Worker)
                        </button>
                      )}
                      <a
                        href={item.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                      >
                        Buka Video
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 3: AI Content Lab & YB Video Document Editor */}
      {tab === 'lab' && (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>AI Content Lab (Regen 3–5 Variasi + Originality Audit)</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
                Mengubah topik atau referensi riset menjadi 3–5 sudut pandang original lengkap dengan `YB Video Document` v1.0 (1080×1920).
              </p>
            </div>

            <form onSubmit={generateLabVariations} style={{ display: 'grid', gap: 10 }}>
              <textarea
                rows={3}
                value={labTopic}
                onChange={(e) => setLabTopic(e.target.value)}
                placeholder="Topik / Ide utama video (mis. Kenapa botol kaca berwarna hijau atau rahasia efisiensi baterai solid-state)"
                style={inputStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                <select
                  value={labResearchItemId}
                  onChange={(e) => setLabResearchItemId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Tanpa Referensi Video --</option>
                  {data.researchItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      Ref: {item.title.slice(0, 48)} {item.hasTranscript ? '(Transkrip ✓)' : ''}
                    </option>
                  ))}
                </select>

                <select value={labChannelId} onChange={(e) => setLabChannelId(e.target.value)} style={inputStyle}>
                  <option value="">-- Target Channel (Opsional) --</option>
                  {data.channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title} ({ch.locale})
                    </option>
                  ))}
                </select>

                <select
                  value={labLocale}
                  onChange={(e) => setLabLocale(e.target.value as 'id-ID' | 'en-US')}
                  style={inputStyle}
                >
                  <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                  <option value="en-US">English (en-US)</option>
                </select>

                <select
                  value={labTrack}
                  onChange={(e) => setLabTrack(e.target.value as 'MOTION_EXPLAINER' | 'AI_STORYTELLING')}
                  style={inputStyle}
                >
                  <option value="MOTION_EXPLAINER">Jalur A: Motion &amp; 3D Explainer ($0)</option>
                  <option value="AI_STORYTELLING">Jalur B: AI Visual Storytelling</option>
                </select>

                <select
                  value={labVariations}
                  onChange={(e) => setLabVariations(Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={3}>3 Variasi Original</option>
                  <option value={4}>4 Variasi Original</option>
                  <option value={5}>5 Variasi Original</option>
                </select>
              </div>

              <button type="submit" disabled={busy} style={{ ...btnPrimary, justifySelf: 'start' }}>
                {busy ? 'Menghasilkan Variasi...' : `Generate ${labVariations} Variasi & YB Video Document`}
              </button>
            </form>
          </div>

          {/* Inline MP4 Preview Player (Cloudflare R2 Presigned URL) */}
          {previewVideo && (
            <div style={{ ...cardStyle, borderColor: '#10B981', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 15 }}>Preview MP4 9:16 — {previewVideo.title}</strong>
                <button type="button" onClick={() => setPreviewVideo(null)} style={btnSecondary}>
                  Tutup Video
                </button>
              </div>
              <video
                src={previewVideo.url}
                controls
                playsInline
                style={{
                  width: '100%',
                  maxWidth: 340,
                  aspectRatio: '9 / 16',
                  borderRadius: 12,
                  background: '#000000',
                  justifySelf: 'center',
                }}
              />
            </div>
          )}

          {/* Inline YB Video Document JSON Editor */}
          {editingProjectId && (
            <form onSubmit={saveEditedDocument} style={{ ...cardStyle, borderColor: '#38BDF8', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 15 }}>Editor `YB Video Document` v1.0</strong>
                <button type="button" onClick={() => setEditingProjectId(null)} style={btnSecondary}>
                  Tutup Editor
                </button>
              </div>
              <input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Judul Proyek"
                style={inputStyle}
                required
              />
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Naskah Voiceover Gabungan</span>
                <textarea
                  rows={3}
                  value={editingScript}
                  onChange={(e) => setEditingScript(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>YB Video Document JSON (1080×1920, Scene &amp; Layer Tervalidasi)</span>
                <textarea
                  rows={12}
                  value={editingDocJson}
                  onChange={(e) => setEditingDocJson(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                />
              </label>
              <button type="submit" disabled={busy} style={{ ...btnPrimary, justifySelf: 'start' }}>
                Simpan &amp; Validasi Schema
              </button>
            </form>
          )}

          {/* Generated Projects List */}
          <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Daftar Konsep &amp; `YB Video Document` ({data.projects.length})</h2>
            {data.projects.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13 }}>Belum ada proyek konten. Buat 3–5 variasi konsep lewat form di atas.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.projects.map((proj) => {
                  const scenes = Array.isArray((proj.ybVideoDoc as { scenes?: unknown[] } | null)?.scenes)
                    ? ((proj.ybVideoDoc as { scenes: Array<{ id?: string; templateId?: string; durationSeconds?: number; voiceover?: { text?: string } }> }).scenes)
                    : [];
                  const origPct =
                    proj.originalityScore === null ? null : Math.round(proj.originalityScore * 100);
                  const isReview = proj.status === 'REVIEW_REQUIRED';

                  return (
                    <div
                      key={proj.id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 10,
                        background: '#020617',
                        border: `1px solid ${isReview ? '#B45309' : '#1E293B'}`,
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{proj.title}</strong>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isReview ? '#FCD34D' : '#34D399',
                          }}
                        >
                          {proj.status} {origPct !== null ? `· Originality ${origPct}%` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {proj.locale} · {proj.videoTrack} · {scenes.length} scene
                      </div>
                      {proj.scriptText && (
                        <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', lineHeight: 1.45 }}>
                          {proj.scriptText}
                        </p>
                      )}
                      {scenes.length > 0 && (
                        <div style={{ display: 'grid', gap: 4, fontSize: 11, color: '#94A3B8', background: '#0F172A', padding: '0.5rem', borderRadius: 8 }}>
                          {scenes.map((sc, sIdx) => (
                            <div key={sc.id ?? sIdx}>
                              <strong>{sc.id ?? `scene_${sIdx + 1}`}</strong> ({sc.durationSeconds ?? 0}s · {sc.templateId}):{' '}
                              {sc.voiceover?.text ?? ''}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void triggerProjectRender(proj.id)}
                          style={btnPrimary}
                        >
                          Render Video 9:16 (Worker)
                        </button>
                        {proj.hasR2Asset && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void openProjectPreview(proj)}
                            style={{ ...btnSecondary, borderColor: '#10B981', color: '#6EE7B7' }}
                          >
                            Putar Preview MP4
                          </button>
                        )}
                        {proj.status === 'RENDERED' && !proj.publishedVideoId && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void triggerProjectPublish(proj)}
                            style={{ ...btnSecondary, borderColor: '#38BDF8', color: '#7DD3FC' }}
                          >
                            Upload YouTube (Private Test)
                          </button>
                        )}
                        {proj.publishedVideoId && (
                          <a
                            href={`https://youtube.com/shorts/${proj.publishedVideoId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...btnSecondary, borderColor: '#34D399', color: '#6EE7B7', textDecoration: 'none' }}
                          >
                            Lihat YouTube Short ✓
                          </a>
                        )}
                        <button type="button" onClick={() => startEditingProject(proj)} style={btnSecondary}>
                          Edit YB Video Document JSON
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 4: Workers */}
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
            <button type="submit" disabled={busy} style={btnPrimary}>
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

      {/* Tab 5: Channels */}
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
            <button type="submit" disabled={busy} style={{ ...btnPrimary, justifySelf: 'start' }}>
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

      {/* Tab 6: AI Vault */}
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
            <button type="submit" disabled={busy} style={{ ...btnPrimary, justifySelf: 'start' }}>
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
