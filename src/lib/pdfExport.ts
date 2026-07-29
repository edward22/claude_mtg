import type { jsPDF as JsPDF } from "jspdf";
import type { PoolCard, ScryfallCard } from "../types";

// Real MTG card aspect ratio (63mm x 88mm).
const CARD_ASPECT = 63 / 88;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PAGE_MARGIN_MM = 6;

export interface PrintLayout {
  cardsPerPage: number;
  cols: number;
  rows: number;
  cardWidthMm: number;
  cardHeightMm: number;
}

/** Presets balance legibility against paper use - "compact" fits a 40-card deck on two sides of one A4 sheet. */
export const PRINT_PRESETS: { label: string; cardsPerPage: number }[] = [
  { label: "Large (9/page)", cardsPerPage: 9 },
  { label: "Medium (12/page)", cardsPerPage: 12 },
  { label: "Small (16/page)", cardsPerPage: 16 },
  { label: "Compact (20/page) - fits 40 cards on 2 sides of A4", cardsPerPage: 20 },
  { label: "Tiny (25/page)", cardsPerPage: 25 },
];

function bestGrid(cardsPerPage: number): { cols: number; rows: number } {
  let best = { cols: 1, rows: cardsPerPage, area: 0 };
  for (let cols = 1; cols <= cardsPerPage; cols++) {
    const rows = Math.ceil(cardsPerPage / cols);
    const usableW = PAGE_W_MM - 2 * PAGE_MARGIN_MM;
    const usableH = PAGE_H_MM - 2 * PAGE_MARGIN_MM;
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    // Card is constrained by whichever dimension is tighter relative to its aspect ratio.
    const cardW = Math.min(cellW, cellH * CARD_ASPECT);
    const area = cardW * (cardW / CARD_ASPECT);
    if (area > best.area) best = { cols, rows, area };
  }
  return { cols: best.cols, rows: best.rows };
}

export function computeLayout(cardsPerPage: number): PrintLayout {
  const { cols, rows } = bestGrid(cardsPerPage);
  const usableW = PAGE_W_MM - 2 * PAGE_MARGIN_MM;
  const usableH = PAGE_H_MM - 2 * PAGE_MARGIN_MM;
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const cardWidthMm = Math.min(cellW, cellH * CARD_ASPECT);
  const cardHeightMm = cardWidthMm / CARD_ASPECT;
  return { cardsPerPage: cols * rows, cols, rows, cardWidthMm, cardHeightMm };
}

function cardImageUrl(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}

async function fetchImageDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface PdfProgress {
  loaded: number;
  total: number;
}

/**
 * Builds a print-ready PDF of the given cards (one image per physical copy),
 * laid out on A4 pages at the requested density. Cards whose image can't be
 * fetched (network hiccup, etc.) fall back to a text placeholder so one bad
 * image doesn't sink the whole export.
 */
export async function buildDeckPdf(
  cards: PoolCard[],
  cardsPerPage: number,
  onProgress?: (p: PdfProgress) => void
): Promise<Blob> {
  const layout = computeLayout(cardsPerPage);
  const { jsPDF } = await import("jspdf");

  const uniqueUrls = [...new Set(cards.map((pc) => cardImageUrl(pc.card)).filter((u): u is string => !!u))];
  let loaded = 0;
  const urlToDataUrl = new Map<string, string | null>();
  await mapWithConcurrency(uniqueUrls, 6, async (url) => {
    try {
      urlToDataUrl.set(url, await fetchImageDataUrl(url));
    } catch {
      urlToDataUrl.set(url, null);
    } finally {
      loaded += 1;
      onProgress?.({ loaded, total: uniqueUrls.length });
    }
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { cols, rows, cardWidthMm, cardHeightMm } = layout;
  const gridWidth = cols * cardWidthMm;
  const gridHeight = rows * cardHeightMm;
  const offsetX = (PAGE_W_MM - gridWidth) / 2;
  const offsetY = (PAGE_H_MM - gridHeight) / 2;

  cards.forEach((pc, i) => {
    const perPage = cols * rows;
    const pageIndex = Math.floor(i / perPage);
    const posInPage = i % perPage;
    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);

    if (posInPage === 0) {
      if (pageIndex > 0) doc.addPage();
    }

    const x = offsetX + col * cardWidthMm;
    const y = offsetY + row * cardHeightMm;

    doc.setDrawColor(200);
    doc.setLineDashPattern([1, 1], 0);
    doc.rect(x, y, cardWidthMm, cardHeightMm);

    const url = cardImageUrl(pc.card);
    const dataUrl = url ? urlToDataUrl.get(url) : null;
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "JPEG", x, y, cardWidthMm, cardHeightMm, undefined, "FAST");
      } catch {
        drawPlaceholder(doc, pc, x, y, cardWidthMm, cardHeightMm);
      }
    } else {
      drawPlaceholder(doc, pc, x, y, cardWidthMm, cardHeightMm);
    }
  });

  return doc.output("blob");
}

function drawPlaceholder(doc: JsPDF, pc: PoolCard, x: number, y: number, w: number, h: number) {
  doc.setFillColor(30, 30, 36);
  doc.rect(x, y, w, h, "F");
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(7);
  const lines = doc.splitTextToSize(pc.card.name, w - 4);
  doc.text(lines, x + w / 2, y + h / 2, { align: "center" });
}
