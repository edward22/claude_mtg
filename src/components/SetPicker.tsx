import { useEffect, useMemo, useState } from "react";
import { fetchAllSets } from "../api/scryfall";
import type { ScryfallSet } from "../types";
import { useSealedStore } from "../store/sealedStore";
import "./SetPicker.css";

const HIDDEN_SET_TYPES = new Set(["token", "memorabilia", "minigame"]);

function isUnreleased(set: ScryfallSet): boolean {
  if (!set.released_at) return true;
  return new Date(set.released_at).getTime() > Date.now();
}

export default function SetPicker() {
  const [sets, setSets] = useState<ScryfallSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [selected, setSelected] = useState<ScryfallSet | null>(null);
  const [packCount, setPackCount] = useState(6);

  const startSealedPool = useSealedStore((s) => s.startSealedPool);

  useEffect(() => {
    fetchAllSets()
      .then(setSets)
      .catch((e) => setError(e.message || "Failed to load sets from Scryfall."));
  }, []);

  const filtered = useMemo(() => {
    if (!sets) return [];
    const q = query.trim().toLowerCase();
    return sets
      .filter((s) => showAllTypes || !HIDDEN_SET_TYPES.has(s.set_type))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .sort((a, b) => {
        const aUn = isUnreleased(a);
        const bUn = isUnreleased(b);
        if (aUn !== bUn) return aUn ? -1 : 1;
        const aDate = a.released_at ?? "9999-99-99";
        const bDate = b.released_at ?? "9999-99-99";
        return bDate.localeCompare(aDate);
      });
  }, [sets, query, showAllTypes]);

  return (
    <div className="set-picker">
      <h1>MTG Sealed Simulator</h1>
      <p className="set-picker__intro">
        Pick a set (including unreleased/upcoming previews Scryfall has spoilers for), choose how many packs to open,
        and build a sealed deck.
      </p>

      {error && <div className="banner banner--error">{error}</div>}
      {!sets && !error && <div className="banner">Loading set list from Scryfall…</div>}

      {sets && (
        <>
          <div className="set-picker__controls">
            <input
              type="search"
              placeholder="Search sets by name or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search sets"
            />
            <label className="set-picker__checkbox">
              <input type="checkbox" checked={showAllTypes} onChange={(e) => setShowAllTypes(e.target.checked)} />
              Show token/memorabilia sets
            </label>
          </div>

          <div className="set-picker__list" role="listbox" aria-label="Available sets">
            {filtered.slice(0, 200).map((s) => (
              <button
                key={s.id}
                className={`set-picker__row ${selected?.id === s.id ? "set-picker__row--selected" : ""}`}
                onClick={() => setSelected(s)}
                type="button"
              >
                {s.icon_svg_uri && <img className="set-picker__icon" src={s.icon_svg_uri} alt="" />}
                <span className="set-picker__name">{s.name}</span>
                <span className="set-picker__code">{s.code.toUpperCase()}</span>
                <span className="set-picker__meta">
                  {isUnreleased(s) ? "Unreleased" : s.released_at} · {s.card_count} cards
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="set-picker__empty">No sets match “{query}”.</p>}
          </div>
        </>
      )}

      {selected && (
        <div className="set-picker__start">
          <label>
            Number of packs
            <input
              type="number"
              min={1}
              max={12}
              value={packCount}
              onChange={(e) => setPackCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => startSealedPool(selected.code, selected.name, packCount)}
          >
            Start sealed pool: {selected.name} × {packCount} packs
          </button>
        </div>
      )}
    </div>
  );
}
