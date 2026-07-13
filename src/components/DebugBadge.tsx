import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';

interface WriteLog {
  fn: string;
  ok: boolean;
  detail: string;
  at: string;
}

// db.ts dispatches window CustomEvent('sb-debug', { detail: {...} }) on every write.
export default function DebugBadge() {
  const [logs, setLogs] = useState<WriteLog[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    function onWrite(e: Event) {
      const d = (e as CustomEvent).detail as WriteLog;
      setLogs(prev => [{ ...d, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 6));
    }
    window.addEventListener('sb-debug', onWrite);
    return () => window.removeEventListener('sb-debug', onWrite);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[9999] bg-gray-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg opacity-80"
      >
        🐛 debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[9999] w-80 max-w-[90vw] bg-gray-900 text-white text-xs rounded-2xl shadow-2xl p-4 font-mono leading-relaxed">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">Supabase debug</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button>
      </div>
      <div className="mb-2">
        client configured:{' '}
        <span className={isSupabaseConfigured ? 'text-green-400' : 'text-red-400'}>
          {String(isSupabaseConfigured)}
        </span>
      </div>
      <div className="border-t border-gray-700 pt-2">
        {logs.length === 0 ? (
          <span className="text-gray-500">No writes yet. Submit an idea / pledge to test.</span>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="mb-1.5">
              <span className={l.ok ? 'text-green-400' : 'text-red-400'}>
                {l.ok ? '✓' : '✗'} {l.fn}
              </span>{' '}
              <span className="text-gray-400">{l.at}</span>
              {!l.ok && <div className="text-red-300 break-words">{l.detail}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
