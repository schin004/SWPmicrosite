import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';

// Bump this string each deploy so we can visually confirm the fresh build loaded.
export const BUILD_TAG = 'BUILD-9';

interface WriteLog {
  fn: string;
  ok: boolean;
  detail: string;
  at: string;
}

// db.ts dispatches window CustomEvent('sb-debug', { detail: {...} }) on every write.
export default function DebugBadge() {
  const [logs, setLogs] = useState<WriteLog[]>([]);

  useEffect(() => {
    function onWrite(e: Event) {
      const d = (e as CustomEvent).detail as WriteLog;
      setLogs(prev => [{ ...d, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 4));
    }
    window.addEventListener('sb-debug', onWrite);
    return () => window.removeEventListener('sb-debug', onWrite);
  }, []);

  const last = logs[0];

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] bg-gray-900 text-white text-xs md:text-sm font-mono px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 shadow-lg">
      <span className="font-bold text-yellow-300">{BUILD_TAG}</span>
      <span>
        client:{' '}
        <span className={isSupabaseConfigured ? 'text-green-400' : 'text-red-400'}>
          {isSupabaseConfigured ? 'configured ✓' : 'NOT configured ✗'}
        </span>
      </span>
      {last ? (
        <span>
          last write:{' '}
          <span className={last.ok ? 'text-green-400' : 'text-red-400'}>
            {last.ok ? '✓' : '✗'} {last.fn} {last.at}
          </span>
          {!last.ok && last.detail && (
            <span className="text-red-300"> — {last.detail}</span>
          )}
        </span>
      ) : (
        <span className="text-gray-400">no writes yet — submit an idea or pledge to test</span>
      )}
    </div>
  );
}
