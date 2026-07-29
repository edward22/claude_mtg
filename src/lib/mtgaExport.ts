import type { PoolCard } from "../types";

function groupKey(pc: PoolCard) {
  return `${pc.card.name}|${pc.card.set}|${pc.card.collector_number}`;
}

function isLand(pc: PoolCard) {
  return pc.card.type_line?.includes("Land") ?? false;
}

function toLines(cards: PoolCard[]): string[] {
  const counts = new Map<string, { count: number; card: PoolCard["card"] }>();
  for (const pc of cards) {
    const key = groupKey(pc);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, card: pc.card });
  }

  const rows = [...counts.values()];
  rows.sort((a, b) => {
    const aLand = a.card.type_line?.includes("Land") ?? false;
    const bLand = b.card.type_line?.includes("Land") ?? false;
    if (aLand !== bLand) return aLand ? 1 : -1;
    if (!aLand && a.card.cmc !== b.card.cmc) return a.card.cmc - b.card.cmc;
    return a.card.name.localeCompare(b.card.name);
  });

  return rows.map(
    ({ count, card }) => `${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`
  );
}

/**
 * Builds an MTGA-importable deck list: a "Deck" section (the built deck,
 * lands included) followed by a "Sideboard" section (everything opened but
 * left out of the deck) - this is the format MTG Arena's "Import" button
 * expects when pasted from the clipboard.
 */
export function buildMtgaExport(deckCards: PoolCard[], sideboardCards: PoolCard[]): string {
  const deckLines = toLines(deckCards);
  const sideboardLines = toLines(sideboardCards);

  const parts = ["Deck", ...deckLines];
  if (sideboardLines.length) {
    parts.push("", "Sideboard", ...sideboardLines);
  }
  return parts.join("\n") + "\n";
}

export function countNonLands(cards: PoolCard[]): number {
  return cards.filter((c) => !isLand(c)).length;
}

export function countLands(cards: PoolCard[]): number {
  return cards.filter(isLand).length;
}
