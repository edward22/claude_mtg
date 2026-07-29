import { useMemo, useState } from "react";
import { buildDeckPdf, computeLayout, PRINT_PRESETS, type PdfProgress } from "../lib/pdfExport";
import type { PoolCard } from "../types";
import "./ExportModal.css";

interface PrintExportModalProps {
  deckCards: PoolCard[];
  onClose: () => void;
}

export default function PrintExportModal({ deckCards, onClose }: PrintExportModalProps) {
  const [cardsPerPage, setCardsPerPage] = useState(20);
  const [progress, setProgress] = useState<PdfProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(cardsPerPage), [cardsPerPage]);
  const pageCount = Math.max(1, Math.ceil(deckCards.length / layout.cardsPerPage));

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setProgress({ loaded: 0, total: deckCards.length });
    try {
      const blob = await buildDeckPdf(deckCards, cardsPerPage, setProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sealed-deck-proxies.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="export-modal__overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal__header">
          <h3>Print proxies (PDF)</h3>
          <button type="button" className="export-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="export-modal__hint">
          Generates one card image per physical copy, tiled onto A4 pages. Print double-sided to use fewer sheets.
        </p>

        <label className="print-modal__field">
          Card size
          <select value={cardsPerPage} onChange={(e) => setCardsPerPage(Number(e.target.value))} disabled={generating}>
            {PRINT_PRESETS.map((p) => (
              <option key={p.cardsPerPage} value={p.cardsPerPage}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="banner">
          {deckCards.length} cards, {layout.cols}×{layout.rows} grid ({layout.cardsPerPage}/page) → {pageCount}{" "}
          page{pageCount === 1 ? "" : "s"}
          {pageCount === 2 ? " (print both sides of one A4 sheet)" : ""}.
        </div>

        {error && <div className="banner banner--error">{error}</div>}

        {generating && progress && (
          <div className="banner">
            Fetching card images… {progress.loaded}/{progress.total}
          </div>
        )}

        <div className="export-modal__actions">
          <button type="button" className="btn btn--primary" onClick={generate} disabled={generating || deckCards.length === 0}>
            {generating ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
