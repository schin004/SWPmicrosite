import type { AppConfig } from "../types";

interface Props {
  config: AppConfig | null;
  busy: string | null;
  onRefresh: () => void;
  onPreview: () => void;
  onCopy: () => void;
}

/** Primary action bar: Refresh, Generate/Preview eDM, Copy HTML. */
export default function Toolbar({
  config,
  busy,
  onRefresh,
  onPreview,
  onCopy,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onRefresh}
        disabled={busy !== null}
        className="rounded-lg border border-nparks bg-white px-4 py-2 text-sm font-medium text-nparks-dark hover:bg-nparks-soft disabled:opacity-50"
      >
        {busy === "refresh" ? "Refreshing…" : "↻ Refresh Vacancies"}
      </button>
      <button
        onClick={onPreview}
        disabled={busy !== null}
        className="rounded-lg bg-nparks px-4 py-2 text-sm font-medium text-white hover:bg-nparks-dark disabled:opacity-50"
      >
        {busy === "edm" ? "Generating…" : "Generate & Preview eDM"}
      </button>
      <button
        onClick={onCopy}
        disabled={busy !== null}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Copy HTML
      </button>

      {config && (
        <span className="ml-auto text-xs text-slate-500">
          {config.ai_summaries_enabled ? "AI summaries: on" : "AI summaries: fallback"}
          {" · "}
          Auto-refresh:{" "}
          {config.auto_refresh_enabled
            ? config.auto_refresh_interval
            : "off (on demand)"}
        </span>
      )}
    </div>
  );
}
