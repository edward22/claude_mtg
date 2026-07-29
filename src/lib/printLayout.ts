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
  pageWidthMm: number;
  pageHeightMm: number;
}

// Every preset is single-sided: printing a deck of N distinct cards
// double-sided would put an unrelated card on the back of each cutout
// (whatever landed at the same grid position on the next page), so we
// don't offer that as a paper-saving option - density is the only lever.
export const PRINT_PRESETS: { label: string; cardsPerPage: number }[] = [
  { label: "Large (9/page)", cardsPerPage: 9 },
  { label: "Medium (12/page)", cardsPerPage: 12 },
  { label: "Small (16/page)", cardsPerPage: 16 },
  { label: "Compact (20/page)", cardsPerPage: 20 },
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
  return {
    cardsPerPage: cols * rows,
    cols,
    rows,
    cardWidthMm,
    cardHeightMm,
    pageWidthMm: PAGE_W_MM,
    pageHeightMm: PAGE_H_MM,
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}
