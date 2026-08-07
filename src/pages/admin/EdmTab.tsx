import { useState } from 'react';
import html2canvas from 'html2canvas';
import { generateEdm, updateSubmission, type Submission } from '../../api';

export default function EdmTab({ submissions, reload }: { submissions: Submission[]; reload: () => Promise<void> }) {
  const approved = submissions.filter((s) => s.status === 'approved');
  const [selected, setSelected] = useState<Set<number>>(new Set(approved.map((s) => s.id)));
  const [occasion, setOccasion] = useState('July 2025 New Joiners');
  const [sendDate, setSendDate] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<number[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function generate() {
    setError(null);
    setBusy(true);
    setCopied(false);
    setArchiveMsg(null);
    try {
      const ids = [...selected];
      const res = await generateEdm(ids, occasion, sendDate);
      setHtml(res.html);
      setGeneratedIds(ids);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Bulk-archive everyone who was included in the eDM just generated.
  async function archiveAll() {
    if (!generatedIds.length) return;
    if (!window.confirm(`Archive ${generatedIds.length} joiner(s) included in this eDM? They will move to the Archived list.`)) return;
    setArchiving(true);
    setArchiveMsg(null);
    setError(null);
    try {
      let n = 0;
      for (const id of generatedIds) {
        if (approved.some((s) => s.id === id)) {
          await updateSubmission(id, { status: 'archived' });
          n++;
        }
      }
      setArchiveMsg(`Archived ${n} joiner(s) — they've moved to the Archived list.`);
      setGeneratedIds([]);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setArchiving(false);
    }
  }

  async function copy() {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy automatically — please select the HTML in the box below and copy it manually.');
    }
  }

  // Render the eDM to a PNG the admin can download and insert into Outlook.
  async function savePng() {
    if (!html) return;
    setError(null);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;background:#F8F4E3';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder, { backgroundColor: '#F8F4E3', scale: 2, width: 640, windowWidth: 640, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'nparks-welcome-edm.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    } catch (e) {
      setError('Could not create the image: ' + (e as Error).message);
    } finally {
      holder.remove();
    }
  }

  if (approved.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-sage/60 bg-white/50 px-4 py-8 text-center text-forest/60">
        No approved entries yet. Approve some submissions in the <strong>Review Submissions</strong> tab first.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* selection panel */}
      <div className="space-y-4">
        <div className="gp-card p-5">
          <h2 className="text-lg font-extrabold text-forest">1 · Choose who to include</h2>
          <p className="mt-1 text-sm text-forest/60">{selected.size} of {approved.length} approved joiners selected.</p>
          <ul className="mt-3 space-y-2">
            {approved.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sage/50 bg-white px-3 py-2 hover:bg-sage-light/60">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-forest"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  {s.photo_path && (
                    <img src={s.photo_path} alt="" className="h-9 w-9 rounded-full border border-sage object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-forest">{s.full_name}</span>
                    <span className="block truncate text-xs text-forest/60">{s.job_title} · {s.division}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="gp-card space-y-3 p-5">
          <h2 className="text-lg font-extrabold text-forest">2 · Occasion &amp; date</h2>
          <div>
            <label className="mb-1 block text-sm font-bold text-forest">Occasion label</label>
            <input
              className="gp-input"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="e.g. July 2025 New Joiners"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-forest">Send date / label (optional)</label>
            <input
              className="gp-input"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              placeholder="e.g. 1 August 2025"
            />
          </div>
          <button className="gp-btn-primary w-full" onClick={generate} disabled={busy || selected.size === 0}>
            {busy ? 'Generating…' : 'Generate eDM 🌿'}
          </button>
          {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </div>

      {/* preview panel */}
      <div className="gp-card flex flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-forest">Preview</h2>
          {html && (
            <div className="flex gap-2">
              <button className="gp-btn-primary" onClick={savePng}>⬇ Save as PNG</button>
              <button className="gp-btn-secondary" onClick={copy}>
                {copied ? '✓ Copied!' : 'Copy HTML'}
              </button>
            </div>
          )}
        </div>
        {html ? (
          <>
            <div className="max-h-[520px] overflow-auto rounded-xl border border-sage/50 bg-white">
              <iframe title="eDM preview" srcDoc={html} className="h-[520px] w-full" />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-bold text-forest">View / copy raw HTML</summary>
              <textarea
                readOnly
                className="mt-2 h-40 w-full rounded-xl border border-sage/50 bg-cream/40 p-3 font-mono text-xs text-forest-dark"
                value={html}
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="mt-1 text-xs text-forest/60">
                Paste this straight into Outlook (or any email client) — all styles are inlined and images are embedded.
              </p>
            </details>
            {generatedIds.length > 0 && (
              <div className="mt-4 border-t border-sage/40 pt-3">
                <p className="mb-2 text-xs text-forest/70">
                  Done sending this eDM? Archive everyone included in it in one go — they move to the Archived list and won't appear when you generate the next eDM.
                </p>
                <button className="gp-btn-secondary text-sm" onClick={archiveAll} disabled={archiving}>
                  {archiving ? 'Archiving…' : `📦 Archive all ${generatedIds.length} joiner(s) in this eDM`}
                </button>
              </div>
            )}
            {archiveMsg && <p className="mt-2 text-sm font-semibold text-forest">{archiveMsg}</p>}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-sage/60 py-16 text-center text-sm text-forest/50">
            Your generated eDM will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
