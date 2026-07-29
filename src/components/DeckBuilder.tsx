import { useEffect, useMemo, useState } from "react";
import { fetchCardsForSet } from "../api/scryfall";
import { countLands, countNonLands } from "../lib/mtgaExport";
import type { PoolCard, ScryfallCard } from "../types";
import { useSealedStore } from "../store/sealedStore";
import CardTile from "./CardTile";
import ManaCurveChart from "./ManaCurveChart";
import LandPicker from "./LandPicker";
import ExportModal from "./ExportModal";
import PrintExportModal from "./PrintExportModal";
import "./DeckBuilder.css";

type SortMode = "rarity" | "color" | "cmc" | "name";

const RARITY_ORDER: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3, special: 4, bonus: 4 };
const COLOR_ORDER = ["W", "U", "B", "R", "G"];

function sortCards(cards: PoolCard[], mode: SortMode): PoolCard[] {
  const sorted = [...cards];
  sorted.sort((a, b) => {
    switch (mode) {
      case "rarity": {
        const r = (RARITY_ORDER[a.card.rarity] ?? 9) - (RARITY_ORDER[b.card.rarity] ?? 9);
        return r !== 0 ? r : a.card.name.localeCompare(b.card.name);
      }
      case "cmc": {
        const c = (a.card.cmc ?? 0) - (b.card.cmc ?? 0);
        return c !== 0 ? c : a.card.name.localeCompare(b.card.name);
      }
      case "color": {
        const colorKey = (pc: PoolCard) => {
          const colors = pc.card.colors ?? [];
          if (colors.length === 0) return 6;
          if (colors.length > 1) return 5;
          return COLOR_ORDER.indexOf(colors[0]);
        };
        const c = colorKey(a) - colorKey(b);
        return c !== 0 ? c : a.card.name.localeCompare(b.card.name);
      }
      default:
        return a.card.name.localeCompare(b.card.name);
    }
  });
  return sorted;
}

export default function DeckBuilder() {
  const setCode = useSealedStore((s) => s.setCode);
  const pool = useSealedStore((s) => s.pool);
  const deckUids = useSealedStore((s) => s.deckUids);
  const moveToDeck = useSealedStore((s) => s.moveToDeck);
  const moveToSideboard = useSealedStore((s) => s.moveToSideboard);
  const removeLand = useSealedStore((s) => s.removeLand);

  const [setCards, setSetCards] = useState<ScryfallCard[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [showExport, setShowExport] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    if (!setCode) return;
    fetchCardsForSet(setCode).then(setSetCards).catch(() => setSetCards([]));
  }, [setCode]);

  const deckSet = useMemo(() => new Set(deckUids), [deckUids]);
  const deckCards = useMemo(() => pool.filter((p) => deckSet.has(p.uid)), [pool, deckSet]);
  const sideboardCards = useMemo(() => pool.filter((p) => !deckSet.has(p.uid) && !p.fromLand), [pool, deckSet]);

  const sortedDeck = useMemo(() => sortCards(deckCards, sortMode), [deckCards, sortMode]);
  const sortedSideboard = useMemo(() => sortCards(sideboardCards, sortMode), [sideboardCards, sortMode]);

  const handleDeckCardClick = (pc: PoolCard) => {
    if (pc.fromLand) removeLand(pc.uid);
    else moveToSideboard(pc.uid);
  };

  return (
    <div className="deck-builder">
      <div className="deck-builder__toolbar">
        <h2>Build your deck</h2>
        <div className="deck-builder__toolbar-right">
          <label>
            Sort:
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="rarity">Rarity</option>
              <option value="color">Color</option>
              <option value="cmc">Mana value</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={() => setShowPrint(true)}>
            Print proxies (PDF)
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setShowExport(true)}>
            Export to MTGA
          </button>
        </div>
      </div>

      <ManaCurveChart cards={deckCards} />

      <section className="deck-builder__section">
        <div className="deck-builder__section-header">
          <h3>
            Deck ({countNonLands(deckCards)} spells, {countLands(deckCards)} lands, {deckCards.length} total)
          </h3>
          <span className="deck-builder__hint">Tap a card to move it back to your pool.</span>
        </div>
        <div className="deck-builder__grid">
          {sortedDeck.map((pc) => (
            <CardTile key={pc.uid} card={pc.card} foil={pc.foil} onClick={() => handleDeckCardClick(pc)} size="small" />
          ))}
          {sortedDeck.length === 0 && <p className="deck-builder__empty">No cards in your deck yet.</p>}
        </div>
      </section>

      <LandPicker setCards={setCards} />

      <section className="deck-builder__section">
        <div className="deck-builder__section-header">
          <h3>Sealed pool ({sideboardCards.length} cards)</h3>
          <span className="deck-builder__hint">Tap a card to add it to your deck.</span>
        </div>
        <div className="deck-builder__grid">
          {sortedSideboard.map((pc) => (
            <CardTile key={pc.uid} card={pc.card} foil={pc.foil} onClick={() => moveToDeck(pc.uid)} size="small" />
          ))}
          {sortedSideboard.length === 0 && <p className="deck-builder__empty">Your whole pool is in the deck.</p>}
        </div>
      </section>

      {showExport && (
        <ExportModal deckCards={deckCards} sideboardCards={sideboardCards} onClose={() => setShowExport(false)} />
      )}
      {showPrint && <PrintExportModal deckCards={sortedDeck} onClose={() => setShowPrint(false)} />}
    </div>
  );
}
