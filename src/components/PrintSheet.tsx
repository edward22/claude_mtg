import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardImageUrl } from "../lib/cardImage";
import { chunk, computeLayout } from "../lib/printLayout";
import type { PoolCard } from "../types";
import "./PrintSheet.css";

interface PrintSheetProps {
  cards: PoolCard[];
  cardsPerPage: number;
  onProgress: (loaded: number, total: number) => void;
  onDone: () => void;
}

// Generous safety nets, not the expected path - preloading below normally
// finishes well before this fires. Printing a full sealed deck can mean 40
// concurrent image requests; browsers cap concurrent connections per host
// (often ~6), so a short timeout was cutting off cards that just hadn't
// gotten a turn yet, not ones that were actually failing.
const PRELOAD_TIMEOUT_MS = 45000;
const FINAL_RENDER_TIMEOUT_MS = 8000;
const PRELOAD_CONCURRENCY = 6;

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/** Warms the browser's own HTTP cache for these URLs, a few at a time, so the
 * real <img> tags rendered afterward load instantly instead of all racing
 * each other (and the timeout) at once. */
async function preloadAll(urls: string[], onProgress: (loaded: number, total: number) => void): Promise<void> {
  let loaded = 0;
  onProgress(0, urls.length);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++];
      await preloadImage(url);
      loaded += 1;
      onProgress(loaded, urls.length);
    }
  }
  await Promise.race([
    Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, urls.length) }, worker)),
    new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
  ]);
}

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
export default function PrintSheet({ cards, cardsPerPage, onProgress, onDone }: PrintSheetProps) {
  const [preloaded, setPreloaded] = useState(false);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const layout = computeLayout(cardsPerPage);
  const pages = chunk(cards, layout.cardsPerPage);

  // Phase 1: warm the browser's cache for every unique image, a few at a time.
  useEffect(() => {
    let cancelled = false;
    const uniqueUrls = [...new Set(cards.map((pc) => cardImageUrl(pc.card)).filter((u): u is string => !!u))];
    preloadAll(uniqueUrls, (loaded, total) => !cancelled && onProgressRef.current(loaded, total)).then(() => {
      if (!cancelled) setPreloaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 2: mount the real grid (now serving from cache) and confirm every
  // <img> has actually settled before handing off to the print dialog.
  useEffect(() => {
    if (!preloaded) return;
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

    const timeout = setTimeout(() => !cancelled && setReady(true), FINAL_RENDER_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [preloaded]);

  useEffect(() => {
    if (!ready) return;
    const handleAfterPrint = () => onDoneRef.current();
    window.addEventListener("afterprint", handleAfterPrint);
    // Give the browser a couple of frames to finish painting before opening the print dialog.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  if (!preloaded) return null;

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
