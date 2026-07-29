import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundLeaves, Leaf } from '../components/Botanical';
import { Header } from '../components/Header';
import {
  adminLogin,
  clearAdminPassword,
  fetchSubmissions,
  getAdminPassword,
  type Submission,
} from '../api';
import ReviewTab from './admin/ReviewTab';
import EdmTab from './admin/EdmTab';
import ArchiveTab from './admin/ArchiveTab';

type Tab = 'review' | 'edm' | 'archive';

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('review');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSubmissions(await fetchSubmissions());
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  // On mount, if a password is already stored this session, try to use it.
  useEffect(() => {
    (async () => {
      if (getAdminPassword()) {
        try {
          setSubmissions(await fetchSubmissions());
          setAuthed(true);
        } catch {
          clearAdminPassword();
        }
      }
      setChecking(false);
    })();
  }, []);

  if (checking) return null;
  if (!authed) return <Login onSuccess={async () => { setAuthed(true); await reload(); }} />;

  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const pendingCount = submissions.filter((s) => s.status === 'awaiting-hr-review').length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'review', label: 'Review Submissions', badge: pendingCount },
    { key: 'edm', label: 'Generate eDM', badge: approvedCount },
    { key: 'archive', label: 'Archive' },
  ];

  return (
    <div className="relative min-h-screen">
      <BackgroundLeaves />
      <Header
        eyebrow="HR Admin Dashboard"
        title="GreenPass HR Console 🌿"
        subtitle="Review new-joiner introductions, add job details, and generate a warm welcome eDM."
        right={
          <div className="flex items-center gap-2">
            <Link to="/" className="gp-btn-secondary bg-white/10 text-cream hover:bg-white/20">Home</Link>
            <button
              className="gp-btn-secondary bg-white/10 text-cream hover:bg-white/20"
              onClick={() => { clearAdminPassword(); setAuthed(false); }}
            >
              Log out
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* AI first-pass disclaimer, always visible */}
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span aria-hidden>🤝</span>
          <p>
            <strong>AI moderation is a first-pass check only.</strong> Please review all content — including each
            photo — before approving. The final decision always rests with you.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-sage/50">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative -mb-px rounded-t-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === t.key
                  ? 'border-x border-t border-sage/60 bg-white text-forest'
                  : 'text-forest/60 hover:text-forest'
              }`}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span className="ml-2 rounded-full bg-forest px-2 py-0.5 text-xs text-cream">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}

        {tab === 'review' && <ReviewTab submissions={submissions} reload={reload} />}
        {tab === 'edm' && <EdmTab submissions={submissions} />}
        {tab === 'archive' && <ArchiveTab />}
      </main>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <BackgroundLeaves />
      <form onSubmit={submit} className="gp-card animate-fade-up mx-5 w-full max-w-sm p-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest">
            <Leaf className="h-8 w-8 text-cream" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-forest">HR Admin Login</h1>
          <p className="mt-1 text-sm text-forest/60">Enter the shared HR password to continue.</p>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}
        <input
          type="password"
          className="gp-input"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" className="gp-btn-primary mt-4 w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Log in 🌿'}
        </button>
        <Link to="/" className="mt-4 block text-center text-sm text-forest/60 hover:text-forest">
          ← Back to home
        </Link>
      </form>
    </div>
  );
}
