import { useState } from 'react';
import { Leaf } from '../../components/Botanical';
import { ModerationBadge } from '../../components/ModerationBadge';
import { updateSubmission, type Submission, type SubmissionStatus } from '../../api';

const GROUPS: { key: SubmissionStatus; label: string; hint: string }[] = [
  { key: 'awaiting-hr-review', label: 'Awaiting HR Review', hint: 'Add job details and approve, or reject.' },
  { key: 'approved', label: 'Approved', hint: 'Ready to include in an eDM.' },
  { key: 'rejected', label: 'Rejected', hint: 'Not included in any eDM.' },
];

export default function ReviewTab({
  submissions,
  reload,
}: {
  submissions: Submission[];
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const items = submissions.filter((s) => s.status === group.key);
        return (
          <section key={group.key}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-xl font-extrabold text-forest">{group.label}</h2>
              <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-sm font-bold text-forest">{items.length}</span>
              <span className="text-sm text-forest/50">{group.hint}</span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-sage/60 bg-white/50 px-4 py-6 text-center text-sm text-forest/50">
                Nothing here yet.
              </p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {items.map((s) => (
                  <SubmissionCard key={s.id} sub={s} reload={reload} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SubmissionCard({ sub, reload }: { sub: Submission; reload: () => Promise<void> }) {
  const [jobTitle, setJobTitle] = useState(sub.job_title ?? '');
  const [division, setDivision] = useState(sub.division ?? '');
  const [startDate, setStartDate] = useState(sub.start_date ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    full_name: sub.full_name,
    email: sub.email ?? '',
    intro: sub.intro,
    fun_fact: sub.fun_fact ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApprove = jobTitle.trim() !== '' && division.trim() !== '' && startDate.trim() !== '';

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveHrFields = () =>
    run(() => updateSubmission(sub.id, { job_title: jobTitle.trim(), division: division.trim(), start_date: startDate.trim() }));

  const approve = () =>
    run(() => updateSubmission(sub.id, { job_title: jobTitle.trim(), division: division.trim(), start_date: startDate.trim(), status: 'approved' }));

  const reject = () => run(() => updateSubmission(sub.id, { status: 'rejected' }));

  const restore = () => run(() => updateSubmission(sub.id, { status: 'awaiting-hr-review' }));

  const saveEdit = () =>
    run(async () => {
      await updateSubmission(sub.id, {
        full_name: draft.full_name.trim(),
        email: draft.email.trim(),
        intro: draft.intro.trim(),
        fun_fact: draft.fun_fact.trim(),
      });
      setEditing(false);
    });

  return (
    <article className="gp-card animate-fade-up flex flex-col p-5">
      {/* header: photo + name */}
      <div className="flex items-start gap-4">
        {sub.photo_path ? (
          <img
            src={sub.photo_path}
            alt={sub.full_name}
            className="w-24 shrink-0 rounded-lg border-2 border-sage bg-sage-light"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-sage-light">
            <Leaf className="h-6 w-6 text-forest/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                className="gp-input py-1.5"
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                placeholder="Full name"
              />
              <input
                type="email"
                className="gp-input py-1.5"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="Personal email"
              />
            </div>
          ) : (
            <>
              <h3 className="truncate text-lg font-extrabold text-forest">{sub.full_name}</h3>
              <p className="text-sm text-forest/60">
                {sub.start_date ? `Starts ${sub.start_date}` : '📅 Start date — to be added by HR'}
              </p>
              {sub.email && <p className="truncate text-sm text-forest/60">📧 {sub.email}</p>}
            </>
          )}
        </div>
      </div>

      {/* intro + fun fact */}
      <div className="mt-4 space-y-2">
        {editing ? (
          <>
            <textarea
              className="gp-input min-h-[100px]"
              value={draft.intro}
              onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
            />
            <input
              className="gp-input"
              placeholder="Fun fact (optional)"
              value={draft.fun_fact}
              onChange={(e) => setDraft({ ...draft, fun_fact: e.target.value })}
            />
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-forest-dark/85">{sub.intro}</p>
            {sub.fun_fact && (
              <p className="text-sm italic text-earth">🌼 Fun fact: {sub.fun_fact}</p>
            )}
          </>
        )}
      </div>

      {/* AI moderation */}
      <div className="mt-4">
        <ModerationBadge status={sub.ai_status} confidence={sub.ai_confidence} reason={sub.ai_reason} />
        {sub.photo_status === 'manual-review' && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-cream/70 px-3 py-2 text-xs text-earth">
            <span aria-hidden>📷</span> {sub.photo_reason}
          </p>
        )}
      </div>

      {/* HR-only fields */}
      <div className="mt-4 rounded-xl border border-forest/15 bg-sage-light/50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="gp-tag bg-earth text-cream">✎ Added by HR</span>
          <span className="text-xs text-forest/60">Not submitted by the new joiner</span>
        </div>
        {sub.status === 'rejected' ? (
          <p className="text-sm text-forest/60">
            {sub.job_title || division ? `${sub.job_title ?? '—'} · ${sub.division ?? '—'}` : 'No job details added.'}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-forest">Job Title</label>
              <input
                className="gp-input py-1.5"
                placeholder="e.g. Park Manager"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-forest">Division / Branch</label>
              <input
                className="gp-input py-1.5"
                placeholder="e.g. Parks Division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-forest">Start Date</label>
              <input
                type="date"
                className="gp-input py-1.5"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-sage/40 pt-4">
        {editing ? (
          <>
            <button className="gp-btn-primary" onClick={saveEdit} disabled={busy}>Save changes</button>
            <button className="gp-btn-secondary" onClick={() => { setEditing(false); setDraft({ full_name: sub.full_name, email: sub.email ?? '', intro: sub.intro, fun_fact: sub.fun_fact ?? '' }); }} disabled={busy}>
              Cancel
            </button>
          </>
        ) : sub.status === 'awaiting-hr-review' ? (
          <>
            <button
              className="gp-btn-primary"
              onClick={approve}
              disabled={busy || !canApprove}
              title={canApprove ? 'Approve this entry' : 'Fill in Job Title and Division first'}
            >
              ✓ Approve
            </button>
            <button className="gp-btn-secondary" onClick={saveHrFields} disabled={busy || !canApprove}>
              Save HR details
            </button>
            <button className="gp-btn-secondary text-red-700" onClick={reject} disabled={busy}>Reject</button>
            <button className="gp-btn-secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
          </>
        ) : sub.status === 'approved' ? (
          <>
            <button className="gp-btn-secondary" onClick={saveHrFields} disabled={busy || !canApprove}>Save HR details</button>
            <button className="gp-btn-secondary text-red-700" onClick={reject} disabled={busy}>Reject</button>
            <button className="gp-btn-secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
          </>
        ) : (
          <>
            <button className="gp-btn-secondary" onClick={restore} disabled={busy}>↩ Restore to review</button>
            <button className="gp-btn-secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
          </>
        )}
      </div>
    </article>
  );
}
