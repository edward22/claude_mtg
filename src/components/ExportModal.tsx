import { useMemo, useState } from "react";
import { buildMtgaExport, countLands, countNonLands } from "../lib/mtgaExport";
import type { PoolCard } from "../types";
import "./ExportModal.css";

interface ExportModalProps {
  deckCards: PoolCard[];
  sideboardCards: PoolCard[];
  onClose: () => void;
}

export default function ExportModal({ deckCards, sideboardCards, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildMtgaExport(deckCards, sideboardCards), [deckCards, sideboardCards]);
  const deckTotal = deckCards.length;
  const belowMinimum = deckTotal < 40;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    // Opened in a new tab rather than via an <a download> click: iOS Safari
    // doesn't reliably honor the download attribute and instead navigates
    // the current tab to view the file, which replaces the app itself -
    // then "back" looks like it reset everything. Opening a new tab leaves
    // this tab (and its state) untouched.
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "sealed-deck.txt";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="export-modal__overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal__header">
          <h3>Export to MTG Arena</h3>
          <button type="button" className="export-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="export-modal__hint">
          Copy this list, then in MTG Arena go to Decks → Import and paste it. Format: quantity, card name, set code,
          collector number.
        </p>
        {belowMinimum && (
          <div className="banner banner--warning">
            Your deck has {deckTotal} cards ({countNonLands(deckCards)} spells + {countLands(deckCards)} lands) —
            sealed decks need a minimum of 40.
          </div>
        )}
        <textarea readOnly value={text} onFocus={(e) => e.target.select()} />
        <div className="export-modal__actions">
          <button type="button" className="btn btn--primary" onClick={copy}>
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          <button type="button" className="btn" onClick={download}>
            Download .txt
          </button>
        </div>
      </div>
    </div>
  );
}
