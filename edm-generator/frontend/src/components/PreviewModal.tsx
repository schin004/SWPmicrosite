import { useEffect, useRef, useState } from "react";

interface Props {
  html: string;
  count: number;
  onClose: () => void;
}

/**
 * Full-screen preview of the generated eDM with a Copy HTML action.
 *
 * Copy uses the rich `text/html` clipboard type so that pasting into Outlook
 * preserves the formatting; it falls back to copying the raw markup if the
 * rich clipboard API is unavailable.
 */
export default function PreviewModal({ html, count, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [copied, setCopied] = useState<"idle" | "rich" | "raw" | "error">("idle");

  // Render the eDM into the sandboxed iframe.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  async function copyHtml() {
    try {
      if (typeof navigator.clipboard?.write === "function") {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
        setCopied("rich");
      } else {
        await navigator.clipboard.writeText(html);
        setCopied("raw");
      }
    } catch {
      // Last-resort fallback for older browsers.
      try {
        await navigator.clipboard.writeText(html);
        setCopied("raw");
      } catch {
        setCopied("error");
      }
    }
    setTimeout(() => setCopied("idle"), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4 sm:p-8">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-nparks-dark">
              eDM Preview
            </h2>
            <p className="text-xs text-slate-500">
              {count} vacanc{count === 1 ? "y" : "ies"} included
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyHtml}
              className="rounded-lg bg-nparks px-4 py-2 text-sm font-medium text-white hover:bg-nparks-dark"
            >
              {copied === "rich"
                ? "Copied — paste into Outlook ✓"
                : copied === "raw"
                  ? "Copied HTML ✓"
                  : copied === "error"
                    ? "Copy failed — select & copy manually"
                    : "Copy HTML"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Rendered preview */}
        <iframe
          ref={iframeRef}
          title="eDM preview"
          className="h-full w-full flex-1 bg-nparks-soft"
          sandbox="allow-same-origin"
        />

        <p className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-xs text-slate-500">
          Tip: Click <strong>Copy HTML</strong>, open a new Outlook email, and
          paste (Ctrl/Cmd&nbsp;+&nbsp;V) into the body.
        </p>
      </div>
    </div>
  );
}
