import { useEffect, useState } from 'react';
import { fetchArchive, type EdmArchiveEntry } from '../../api';

export default function ArchiveTab() {
  const [entries, setEntries] = useState<EdmArchiveEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetchArchive().then(setEntries).catch((err) => setError((err as Error).message));
  }, []);

  if (error) {
    return <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-sage/60 bg-white/50 px-4 py-8 text-center text-forest/60">
        No eDMs have been generated yet. Create one in the <strong>Generate eDM</strong> tab and it will be logged here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-forest/60">A read-only log of every eDM you've generated.</p>
      {entries.map((e) => (
        <div key={e.id} className="gp-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-forest">{e.occasion}</h3>
              <p className="text-sm text-forest/60">
                Generated {new Date(e.created_at).toLocaleString()}
                {e.send_date ? ` · ${e.send_date}` : ''}
              </p>
              <p className="mt-2 text-sm text-forest-dark/80">
                <span className="font-bold">{e.hire_names.length}</span> staff:{' '}
                {e.hire_names.join(', ')}
              </p>
            </div>
            <button
              className="gp-btn-secondary"
              onClick={() => setOpen(open === e.id ? null : e.id)}
            >
              {open === e.id ? 'Hide' : 'View eDM'}
            </button>
          </div>
          {open === e.id && (
            <div className="mt-4 max-h-[480px] overflow-auto rounded-xl border border-sage/50 bg-white">
              <iframe title={`eDM ${e.id}`} srcDoc={e.html} className="h-[480px] w-full" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
