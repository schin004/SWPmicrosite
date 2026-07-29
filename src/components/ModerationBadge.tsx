import type { AiStatus } from '../api';

const CONFIG: Record<AiStatus, { label: string; classes: string }> = {
  clear: { label: '✅ Clear', classes: 'bg-sage-light text-forest-dark border border-forest/20' },
  review: { label: '⚠️ Review Needed', classes: 'bg-amber-100 text-amber-800 border border-amber-300' },
  flagged: { label: '🚫 Flagged', classes: 'bg-red-100 text-red-800 border border-red-300' },
};

export function ModerationBadge({
  status,
  confidence,
  reason,
}: {
  status: AiStatus | null;
  confidence: number | null;
  reason: string | null;
}) {
  const cfg = CONFIG[status ?? 'review'];
  return (
    <div className="rounded-xl border border-sage/50 bg-cream/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`gp-tag ${cfg.classes}`}>{cfg.label}</span>
        <span className="text-xs font-semibold text-forest/60">AI moderation</span>
        {typeof confidence === 'number' && confidence > 0 && (
          <span className="text-xs text-forest/50">· {confidence}% confidence</span>
        )}
      </div>
      {reason && <p className="mt-1.5 text-sm text-forest-dark/80">{reason}</p>}
    </div>
  );
}
