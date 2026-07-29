import { useEffect, useState } from "react";
import type { Vacancy } from "../types";

interface Props {
  vacancy: Vacancy;
  index: number;
  total: number;
  onSaveSummary: (id: number, summary: string) => void;
  onToggleHidden: (id: number, hidden: boolean) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

/** An editable admin row for a single vacancy. */
export default function VacancyRow({
  vacancy,
  index,
  total,
  onSaveSummary,
  onToggleHidden,
  onMove,
}: Props) {
  const [summary, setSummary] = useState(vacancy.summary);
  const dirty = summary.trim() !== vacancy.summary.trim();
  const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0;

  // Keep local state in sync when the vacancy is refreshed from the server.
  useEffect(() => setSummary(vacancy.summary), [vacancy.summary]);

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        vacancy.hidden ? "border-slate-200 opacity-60" : "border-nparks-soft"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-nparks-dark">
            {vacancy.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {vacancy.division || "Division not specified"}
            {vacancy.closing_date && (
              <>
                {" "}
                &middot; Closes{" "}
                <span className="font-medium">{vacancy.closing_date}</span>
              </>
            )}
            {vacancy.summary_edited && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                edited
              </span>
            )}
            {!vacancy.is_open && (
              <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                closed at source
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Reorder */}
          <button
            title="Move up"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            title="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-30"
          >
            ↓
          </button>
          {/* Hide / show */}
          <button
            title={vacancy.hidden ? "Show in eDM" : "Hide from eDM"}
            onClick={() => onToggleHidden(vacancy.id, !vacancy.hidden)}
            className={`ml-1 rounded-md px-3 py-1 text-xs font-medium ${
              vacancy.hidden
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-nparks-soft text-nparks-dark hover:bg-nparks-accent/20"
            }`}
          >
            {vacancy.hidden ? "Hidden" : "Visible"}
          </button>
        </div>
      </div>

      {/* Editable summary */}
      <div className="mt-3">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-slate-200 p-2 text-sm text-slate-700 focus:border-nparks-accent focus:outline-none focus:ring-1 focus:ring-nparks-accent"
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-xs ${
              wordCount < 25 || wordCount > 40
                ? "text-amber-600"
                : "text-slate-400"
            }`}
          >
            {wordCount} words {wordCount >= 25 && wordCount <= 40 ? "✓" : "(aim 25–40)"}
          </span>
          <div className="flex gap-2">
            {dirty && (
              <button
                onClick={() => setSummary(vacancy.summary)}
                className="rounded-md px-3 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Reset
              </button>
            )}
            <button
              disabled={!dirty}
              onClick={() => onSaveSummary(vacancy.id, summary)}
              className="rounded-md bg-nparks px-3 py-1 text-xs font-medium text-white enabled:hover:bg-nparks-dark disabled:opacity-40"
            >
              Save summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
