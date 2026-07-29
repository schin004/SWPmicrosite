import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Toolbar from "./components/Toolbar";
import VacancyRow from "./components/VacancyRow";
import PreviewModal from "./components/PreviewModal";
import type { AppConfig, Vacancy } from "./types";

type Banner = { kind: "ok" | "error" | "info"; text: string } | null;

export default function App() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [preview, setPreview] = useState<{ html: string; count: number } | null>(
    null,
  );

  const notify = (b: Banner) => {
    setBanner(b);
    if (b) setTimeout(() => setBanner(null), 6000);
  };

  const loadAll = useCallback(async () => {
    try {
      const [vac, cfg] = await Promise.all([
        api.listVacancies(),
        api.getConfig(),
      ]);
      setVacancies(vac);
      setConfig(cfg);
    } catch (e) {
      notify({ kind: "error", text: `Could not load data: ${(e as Error).message}` });
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // --- Actions -----------------------------------------------------------
  async function handleRefresh() {
    setBusy("refresh");
    try {
      const res = await api.refresh();
      await loadAll();
      const summary = `${res.total_found} found · ${res.created} new · ${res.updated} updated · ${res.closed} closed`;
      notify({
        kind: res.source === "sample" ? "info" : "ok",
        text: `${res.message} (${summary})`,
      });
    } catch (e) {
      notify({ kind: "error", text: `Refresh failed: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate(): Promise<{ html: string; count: number } | null> {
    setBusy("edm");
    try {
      const res = await api.generateEdm();
      return { html: res.html, count: res.vacancy_count };
    } catch (e) {
      notify({ kind: "error", text: `Generate failed: ${(e as Error).message}` });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    const result = await handleGenerate();
    if (result) setPreview(result);
  }

  async function handleCopy() {
    const result = await handleGenerate();
    if (!result) return;
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([result.html], { type: "text/html" }),
        "text/plain": new Blob([result.html], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      notify({ kind: "ok", text: "eDM copied — paste into a new Outlook email." });
    } catch {
      try {
        await navigator.clipboard.writeText(result.html);
        notify({ kind: "ok", text: "eDM HTML copied to clipboard." });
      } catch {
        // If clipboard is blocked, open the preview so the user can copy manually.
        setPreview(result);
        notify({ kind: "info", text: "Clipboard blocked — use Copy HTML in the preview." });
      }
    }
  }

  async function handleSaveSummary(id: number, summary: string) {
    try {
      const updated = await api.updateVacancy(id, { summary });
      setVacancies((prev) => prev.map((v) => (v.id === id ? updated : v)));
      notify({ kind: "ok", text: "Summary saved." });
    } catch (e) {
      notify({ kind: "error", text: `Save failed: ${(e as Error).message}` });
    }
  }

  async function handleToggleHidden(id: number, hidden: boolean) {
    try {
      const updated = await api.updateVacancy(id, { hidden });
      setVacancies((prev) => prev.map((v) => (v.id === id ? updated : v)));
    } catch (e) {
      notify({ kind: "error", text: `Update failed: ${(e as Error).message}` });
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const next = [...vacancies];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setVacancies(next); // optimistic
    try {
      await api.reorder(next.map((v) => v.id));
    } catch (e) {
      notify({ kind: "error", text: `Reorder failed: ${(e as Error).message}` });
      loadAll(); // revert to server state
    }
  }

  const visibleCount = vacancies.filter((v) => !v.hidden).length;

  return (
    <div className="mx-auto min-h-full max-w-3xl px-4 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <h1 className="text-xl font-bold text-nparks-dark">
            NParks Internal Opportunities — eDM Generator
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Retrieve open {config?.careers_agency ?? "NParks"} vacancies, tidy the
          summaries, then generate an Outlook-ready email to encourage internal
          mobility.
        </p>
      </header>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur">
        <Toolbar
          config={config}
          busy={busy}
          onRefresh={handleRefresh}
          onPreview={handlePreview}
          onCopy={handleCopy}
        />
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            banner.kind === "ok"
              ? "bg-nparks-soft text-nparks-dark"
              : banner.kind === "error"
                ? "bg-rose-50 text-rose-700"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Count summary */}
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        {vacancies.length} vacancies · {visibleCount} shown in eDM
      </p>

      {/* List */}
      {vacancies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No vacancies yet. Click <strong>Refresh Vacancies</strong> to load the
          latest openings.
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v, i) => (
            <VacancyRow
              key={v.id}
              vacancy={v}
              index={i}
              total={vacancies.length}
              onSaveSummary={handleSaveSummary}
              onToggleHidden={handleToggleHidden}
              onMove={handleMove}
            />
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal
          html={preview.html}
          count={preview.count}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
