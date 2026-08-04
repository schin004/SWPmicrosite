import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundLeaves, Leaf } from '../components/Botanical';
import { Header } from '../components/Header';
import { lookupSubmission, type LookupResult } from '../api';
import Submit, { type AmendInitial } from './Submit';

// Two-step amend flow: the new hire enters the email they submitted with; if an
// editable (not-yet-approved) entry is found, the Submit form is rendered
// pre-filled in amend mode. Otherwise a friendly message is shown.
export default function Amend() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ initial: AmendInitial; photoUrl: string | null } | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const r: LookupResult = await lookupSubmission(email.trim());
      if (!r.found) {
        setError("We couldn't find a submission for that email address. If you haven't submitted yet, please start a new introduction.");
        return;
      }
      if (r.status === 'approved') {
        setError('Your introduction has already been approved by HR, so it can no longer be edited here. Please contact HR if something needs to change.');
        return;
      }
      setFound({
        initial: { full_name: r.full_name ?? '', email: r.email ?? '', intro: r.intro ?? '', fun_fact: r.fun_fact ?? '' },
        photoUrl: r.photo_path ?? null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (found) return <Submit amend initial={found.initial} photoUrl={found.photoUrl} />;

  return (
    <div className="relative min-h-screen">
      <BackgroundLeaves />
      <Header
        eyebrow="New Joiner Portal"
        title="Amend your introduction 🌱"
        subtitle="Enter the email you submitted with and we'll bring up your introduction so you can make changes."
        right={
          <Link to="/" className="gp-btn-secondary bg-white/10 text-cream hover:bg-white/20">
            ← Home
          </Link>
        }
      />

      <main className="mx-auto max-w-lg px-5 py-10">
        <form onSubmit={lookup} className="gp-card animate-fade-up space-y-5 p-6 sm:p-8">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}
          <p className="text-sm text-forest-dark/80">
            You can amend your introduction any time before HR approves your entry.
          </p>
          <div>
            <label className="gp-label" htmlFor="email">
              <Leaf className="h-4 w-4 text-forest" /> Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="gp-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="gp-btn-primary" disabled={busy}>
              {busy ? 'Looking…' : 'Find my introduction'}
            </button>
            <Link to="/submit" className="gp-btn-secondary">Start a new one instead</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
