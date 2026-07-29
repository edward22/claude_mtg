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
  const [failedImageCount, setFailedImageCount] = useState(0);

  const layout = useMemo(() => computeLayout(cardsPerPage), [cardsPerPage]);
  const pageCount = Math.max(1, Math.ceil(deckCards.length / layout.cardsPerPage));

  const generate = async () => {
    // Open the tab synchronously, in direct response to the click, so Safari/iOS
    // doesn't treat window.open() as a popup once the async image fetching below
    // has finished (by then the "user gesture" that permits it has expired) -
    // and so the app's own tab is never navigated away from (that was causing
    // "back" to look like it reset the app: the PDF was replacing this tab).
    const targetTab = window.open("", "_blank");
    setGenerating(true);
    setError(null);
    setFailedImageCount(0);
    setProgress({ loaded: 0, total: deckCards.length });
    try {
      const { blob, failedImageCount } = await buildDeckPdf(deckCards, cardsPerPage, setProgress);
      setFailedImageCount(failedImageCount);
      const url = URL.createObjectURL(blob);
      if (targetTab) {
        targetTab.location.href = url;
      } else {
        // Popup was blocked - fall back to an in-tab download link.
        const a = document.createElement("a");
        a.href = url;
        a.download = "sealed-deck-proxies.pdf";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      targetTab?.close();
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
          Generates one card image per physical copy, tiled onto A4 pages with cut guides. Each page is a single
          sheet - printing double-sided isn't offered since a different card would end up on the back of each
          cutout.
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
          sheet{pageCount === 1 ? "" : "s"} of paper.
        </div>

        {error && <div className="banner banner--error">{error}</div>}

        {!generating && failedImageCount > 0 && (
          <div className="banner banner--warning">
            Couldn't load artwork for {failedImageCount} card{failedImageCount === 1 ? "" : "s"} - printed as a text
            placeholder instead. This is usually a browser privacy setting blocking cross-site images; try again or
            use a different browser if it affects many cards.
          </div>
        )}

        {generating && progress && (
          <div className="banner">
            Fetching card images… {progress.loaded}/{progress.total}
          </div>
        )}

        <div className="export-modal__actions">
          <button type="button" className="btn btn--primary" onClick={generate} disabled={generating || deckCards.length === 0}>
            {generating ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
