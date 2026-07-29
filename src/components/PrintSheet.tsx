import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardImageUrl } from "../lib/cardImage";
import { chunk, computeLayout } from "../lib/printLayout";
import type { PoolCard } from "../types";
import "./PrintSheet.css";

interface PrintSheetProps {
  cards: PoolCard[];
  cardsPerPage: number;
  onDone: () => void;
}

const IMAGE_LOAD_TIMEOUT_MS = 8000;

/**
 * Renders the deck as plain <img> tags sized in mm and triggers the browser's
 * native print dialog. This deliberately avoids fetching image bytes into JS
 * (fetch/canvas readback) - Scryfall's image CDN doesn't grant that to
 * cross-origin scripts, which was the actual cause of the old jsPDF-based
 * export always falling back to blank placeholders. A plain <img> never
 * needs that permission; the browser paints it directly, CORS or not, so
 * routing through window.print() (Save as PDF from the print dialog) sidesteps
 * the restriction entirely.
 */
export default function PrintSheet({ cards, cardsPerPage, onDone }: PrintSheetProps) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const layout = computeLayout(cardsPerPage);
  const pages = chunk(cards, layout.cardsPerPage);

  useEffect(() => {
    const container = containerRef.current;
    const imgs = container ? Array.from(container.querySelectorAll("img")) : [];

    let settled = 0;
    let cancelled = false;
    const markSettled = () => {
      settled += 1;
      if (settled >= imgs.length && !cancelled) setReady(true);
    };

    if (imgs.length === 0) {
      setReady(true);
    } else {
      imgs.forEach((img) => {
        if (img.complete) markSettled();
        else {
          img.addEventListener("load", markSettled, { once: true });
          img.addEventListener("error", markSettled, { once: true });
        }
      });
    }

    const timeout = setTimeout(() => !cancelled && setReady(true), IMAGE_LOAD_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const handleAfterPrint = () => onDoneRef.current();
    window.addEventListener("afterprint", handleAfterPrint);
    // Give the browser a frame to finish layout before opening the print dialog.
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  return createPortal(
    <div className="print-sheet" ref={containerRef}>
      {pages.map((pageCards, pageIndex) => (
        <div
          key={pageIndex}
          className="print-page"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardWidthMm}mm)`,
            gridTemplateRows: `repeat(${layout.rows}, ${layout.cardHeightMm}mm)`,
          }}
        >
          {pageCards.map((pc) => {
            const url = cardImageUrl(pc.card);
            return (
              <div className="print-card" key={pc.uid}>
                {url ? (
                  <img src={url} alt={pc.card.name} />
                ) : (
                  <div className="print-card__placeholder">{pc.card.name}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>,
    document.body
  );
}
