import { useEffect, useMemo, useState } from "react";
import { fetchCardsForSet } from "../api/scryfall";
import { classifyCardsForBoosters, generatePack, type BoosterCardPools } from "../lib/boosterSim";
import { useSealedStore } from "../store/sealedStore";
import CardTile from "./CardTile";
import "./PackOpener.css";

export default function PackOpener() {
  const setCode = useSealedStore((s) => s.setCode);
  const setName = useSealedStore((s) => s.setName);
  const packCount = useSealedStore((s) => s.packCount);
  const openedPacks = useSealedStore((s) => s.openedPacks);
  const addOpenedPacks = useSealedStore((s) => s.addOpenedPacks);

  const [pools, setPools] = useState<BoosterCardPools | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealPack, setRevealPack] = useState<number | null>(null);
  const [showFullPool, setShowFullPool] = useState(false);

  useEffect(() => {
    if (!setCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCardsForSet(setCode)
      .then((cards) => {
        if (cancelled) return;
        setPools(classifyCardsForBoosters(cards));
      })
      .catch((e) => !cancelled && setError(e.message || "Failed to load card data from Scryfall."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [setCode]);

  const remaining = packCount - openedPacks.length;
  const latestPack = revealPack !== null ? openedPacks[revealPack] : null;

  const openOne = () => {
    if (!pools) return;
    const pack = generatePack(pools);
    const newIndex = openedPacks.length;
    addOpenedPacks([pack]);
    setRevealPack(newIndex);
  };

  const openAllRemaining = () => {
    if (!pools || remaining <= 0) return;
    const startIndex = openedPacks.length;
    const packs = Array.from({ length: remaining }, () => generatePack(pools));
    addOpenedPacks(packs);
    // Still reveal the last pack of the batch with the same animation as
    // opening one at a time, rather than skipping straight to the pool view.
    setRevealPack(startIndex + packs.length - 1);
  };

  const totalOpenedCards = useMemo(() => openedPacks.flat().length, [openedPacks]);

  if (!setCode) return null;

  return (
    <div className="pack-opener">
      <h2>
        {setName} — Opening Packs ({openedPacks.length}/{packCount})
      </h2>

      {loading && <div className="banner">Loading {setName} card data from Scryfall…</div>}
      {error && <div className="banner banner--error">{error}</div>}
      {pools?.warnings.map((w) => (
        <div className="banner banner--warning" key={w}>
          {w}
        </div>
      ))}

      {pools && (
        <div className="pack-opener__actions">
          <button type="button" className="btn btn--primary" disabled={remaining <= 0} onClick={openOne}>
            {remaining > 0 ? `Open Pack (${remaining} left)` : "All packs opened"}
          </button>
          {remaining > 1 && (
            <button type="button" className="btn" onClick={openAllRemaining}>
              Open all remaining ({remaining})
            </button>
          )}
        </div>
      )}

      {latestPack && (
        <div className="pack-opener__reveal">
          <h3>Pack {revealPack! + 1}</h3>
          <div className="pack-opener__grid">
            {latestPack.map((pc, i) => (
              <div key={pc.uid} className="pack-opener__card" style={{ animationDelay: `${i * 60}ms` }}>
                <CardTile card={pc.card} foil={pc.foil} />
              </div>
            ))}
          </div>
        </div>
      )}

      <details
        className="pack-opener__pool"
        open={showFullPool}
        onToggle={(e) => setShowFullPool(e.currentTarget.open)}
      >
        <summary>Full pool so far ({totalOpenedCards} cards)</summary>
        {showFullPool && (
          <div className="pack-opener__grid">
            {openedPacks.flat().map((pc) => (
              <CardTile key={pc.uid} card={pc.card} foil={pc.foil} size="small" />
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
