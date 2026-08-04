import { useEffect, useRef, useState } from 'react';
import { Leaf } from '../../components/Botanical';
import { ModerationBadge } from '../../components/ModerationBadge';
import { updatePhoto, updateSubmission, type Submission, type SubmissionStatus } from '../../api';

// Format a stored 'YYYY-MM-DD' start date for display as DD/MM/YY.
function fmtDate(s: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : String(s || '');
}

const GROUPS: { key: SubmissionStatus; label: string; hint: string }[] = [
  { key: 'awaiting-hr-review', label: 'Awaiting HR Review', hint: 'Add job details and approve, or reject.' },
  { key: 'approved', label: 'Approved', hint: 'Ready to include in an eDM.' },
  { key: 'archived', label: 'Archived', hint: 'eDM already sent — kept for records, not offered for new eDMs.' },
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
  const [editingPhoto, setEditingPhoto] = useState(false);
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

  const archive = () => run(() => updateSubmission(sub.id, { status: 'archived' }));

  const unarchive = () => run(() => updateSubmission(sub.id, { status: 'approved' }));

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
            src={`${sub.photo_path}?v=${sub.updated_at ? new Date(sub.updated_at).getTime() : ''}`}
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
                placeholder="Email"
              />
            </div>
          ) : (
            <>
              <h3 className="truncate text-lg font-extrabold text-forest">{sub.full_name}</h3>
              <p className="text-sm text-forest/60">
                {sub.start_date ? `Joined from ${fmtDate(sub.start_date)}` : '📅 Joining date — to be added by HR'}
              </p>
              {sub.email && <p className="truncate text-sm text-forest/60">📧 {sub.email}</p>}
            </>
          )}
        </div>
      </div>

      {/* in-app photo touch-up */}
      {sub.photo_path && (
        <div className="mt-3">
          <button
            className="gp-btn-secondary text-sm"
            onClick={() => setEditingPhoto((v) => !v)}
            disabled={busy}
          >
            {editingPhoto ? 'Close photo editor' : '✨ Adjust photo'}
          </button>
          {editingPhoto && (
            <PhotoEditor
              id={sub.id}
              photoUrl={sub.photo_path}
              onSaved={async () => {
                setEditingPhoto(false);
                await reload();
              }}
            />
          )}
        </div>
      )}

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
        {sub.status === 'rejected' || sub.status === 'archived' ? (
          <p className="text-sm text-forest/60">
            {sub.job_title || division ? `${sub.job_title ?? '—'} · ${sub.division ?? '—'}` : 'No job details added.'}
            {sub.start_date && ` · 📅 Joined from ${fmtDate(sub.start_date)}`}
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
              <label className="mb-1 block text-xs font-bold text-forest">Joined from (start date)</label>
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
            <button className="gp-btn-secondary" onClick={archive} disabled={busy}>📦 Archive</button>
            <button className="gp-btn-secondary text-red-700" onClick={reject} disabled={busy}>Reject</button>
            <button className="gp-btn-secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
          </>
        ) : sub.status === 'archived' ? (
          <>
            <span className="self-center text-sm text-forest/60">📦 Archived — kept for records, not offered for new eDMs.</span>
            <button className="gp-btn-secondary" onClick={unarchive} disabled={busy}>↩ Restore to Approved</button>
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

// Client-side canvas photo editor: HR can brighten / adjust / rotate the
// joiner's photo and save the result straight back to the database.
function PhotoEditor({
  id,
  photoUrl,
  onSaved,
}: {
  id: number;
  photoUrl: string;
  onSaved: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [angle, setAngle] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function draw() {
    const img = imgRef.current;
    const cv = canvasRef.current;
    if (!img || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    if (angle === 90 || angle === 270) {
      cv.width = h;
      cv.height = w;
    } else {
      cv.width = w;
      cv.height = h;
    }
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Load the photo once.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.onerror = () => setMsg('Could not load the photo to edit.');
    img.src = `${photoUrl}?t=${Date.now()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever a control changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => draw(), [angle, brightness, contrast, saturation]);

  function reset() {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setAngle(0);
  }

  // Load a completely different photo into the editor (full re-upload).
  function loadFile(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setAngle(0);
      draw();
      URL.revokeObjectURL(url);
      setMsg('New photo loaded — adjust if you like, then Save.');
    };
    img.onerror = () => {
      setMsg('Could not read that image — please try another file.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function save() {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    setMsg('Saving…');
    cv.toBlob(
      async (blob) => {
        if (!blob) {
          setMsg('Could not create the image.');
          setBusy(false);
          return;
        }
        try {
          await updatePhoto(id, blob);
          setMsg('✓ Saved!');
          onSaved();
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      },
      'image/jpeg',
      0.92,
    );
  }

  const sliders: [string, number, (v: number) => void, number, number][] = [
    ['Brightness', brightness, setBrightness, 50, 200],
    ['Contrast', contrast, setContrast, 50, 200],
    ['Saturation', saturation, setSaturation, 0, 200],
  ];

  return (
    <div className="mt-3 rounded-xl border border-forest/15 bg-sage-light/40 p-3">
      <p className="mb-2 text-xs text-forest/70">
        Adjust the current photo, or load a completely different one. Rotate if needed, then Save — the result replaces the stored photo.
      </p>
      <div className="mb-3">
        <label className="block text-xs font-bold text-forest">Replace with a different photo (JPG/PNG)</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="mt-1 text-sm"
          onChange={(e) => loadFile(e.target.files?.[0])}
          disabled={busy}
        />
        <p className="mt-1 text-xs text-forest/60">
          Choose a new file to load it into the editor — then adjust it, or just Save to replace the photo as-is.
        </p>
      </div>
      <div className="text-center">
        <canvas ref={canvasRef} className="mx-auto max-w-full rounded-lg border border-sage bg-white" />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sliders.map(([label, value, setter, min, max]) => (
          <label key={label} className="block text-xs font-bold text-forest">
            {label} ({value}%)
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        ))}
        <div className="flex items-end">
          <button className="gp-btn-secondary text-sm" onClick={() => setAngle((a) => (a + 90) % 360)} disabled={busy}>
            ⟳ Rotate 90°
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="gp-btn-primary text-sm" onClick={save} disabled={busy}>💾 Save adjusted photo</button>
        <button className="gp-btn-secondary text-sm" onClick={reset} disabled={busy}>↺ Reset</button>
        {msg && <span className="text-sm text-forest/70">{msg}</span>}
      </div>
    </div>
  );
}
