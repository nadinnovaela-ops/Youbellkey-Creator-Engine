'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        router.push('/');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        if (data.session) {
          router.push('/');
          router.refresh();
        } else {
          setStatusMessage('Akun dibuat! Cek inbox email kamu untuk konfirmasi lalu login kembali.');
          setMode('login');
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menghubungi Supabase Auth.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem' }}>
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 16,
          padding: '1.5rem',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: '#38BDF8', fontWeight: 600 }}>YOUBELLKEY STUDIO</p>
        <h1 style={{ marginTop: 6, marginBottom: 6, fontSize: '1.4rem' }}>
          {mode === 'login' ? 'Masuk ke Control Plane' : 'Buat Akun Studio'}
        </h1>
        <p style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: 13, color: '#94A3B8' }}>
          Akses PWA dari HP atau PC untuk mengontrol worker, channel, dan kill switch.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#020617',
                color: '#F8FAFC',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#020617',
                color: '#F8FAFC',
              }}
            />
          </label>

          {errorMessage && (
            <div style={{ padding: '0.65rem', borderRadius: 8, background: '#450A0A', color: '#FCA5A5', fontSize: 13 }}>
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div style={{ padding: '0.65rem', borderRadius: 8, background: '#052E16', color: '#86EFAC', fontSize: 13 }}>
              {statusMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem',
              borderRadius: 10,
              border: 'none',
              background: '#0284C7',
              color: '#FFFFFF',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar Sekarang'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setErrorMessage(null);
          }}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.5rem',
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {mode === 'login' ? 'Belum punya akun? Daftar akun baru' : 'Sudah punya akun? Kembali login'}
        </button>
      </section>
    </main>
  );
}
