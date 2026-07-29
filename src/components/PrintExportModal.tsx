import { useMemo, useState } from "react";
import { computeLayout, PRINT_PRESETS } from "../lib/printLayout";
import type { PoolCard } from "../types";
import PrintSheet from "./PrintSheet";
import "./ExportModal.css";

interface PrintExportModalProps {
  deckCards: PoolCard[];
  onClose: () => void;
}

export default function PrintExportModal({ deckCards, onClose }: PrintExportModalProps) {
  const [cardsPerPage, setCardsPerPage] = useState(20);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);

  const layout = useMemo(() => computeLayout(cardsPerPage), [cardsPerPage]);
  const pageCount = Math.max(1, Math.ceil(deckCards.length / layout.cardsPerPage));

  return (
    <div className="export-modal__overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal__header">
          <h3>Print proxies</h3>
          <button type="button" className="export-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="export-modal__hint">
          Opens your browser/OS print dialog with one card image per physical copy, tiled with cut guides - choose
          "Save as PDF" there if you want a file instead of printing immediately. Each page is a single sheet -
          printing double-sided isn't offered since a different card would end up on the back of each cutout.
        </p>

        <label className="print-modal__field">
          Card size
          <select value={cardsPerPage} onChange={(e) => setCardsPerPage(Number(e.target.value))} disabled={printing}>
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

        {printing && progress && progress.loaded < progress.total && (
          <div className="banner">
            Loading card images… {progress.loaded}/{progress.total}
          </div>
        )}

        <div className="export-modal__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setProgress(null);
              setPrinting(true);
            }}
            disabled={printing || deckCards.length === 0}
          >
            {printing ? "Preparing…" : "Print / Save as PDF"}
          </button>
        </div>
      </div>

      {printing && (
        <PrintSheet
          cards={deckCards}
          cardsPerPage={cardsPerPage}
          onProgress={(loaded, total) => setProgress({ loaded, total })}
          onDone={() => {
            setPrinting(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
