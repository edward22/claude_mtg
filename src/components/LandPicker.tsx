import { useEffect, useState } from "react";
import { fetchCardByExactName } from "../api/scryfall";
import { isBasicLandCard, isStandardPlayableCard } from "../lib/boosterSim";
import type { BasicLandName, ScryfallCard } from "../types";
import { useSealedStore } from "../store/sealedStore";
import "./LandPicker.css";

const LAND_NAMES: BasicLandName[] = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"];

export default function LandPicker({ setCards }: { setCards: ScryfallCard[] }) {
  const [lands, setLands] = useState<Partial<Record<BasicLandName, ScryfallCard>>>({});
  const pool = useSealedStore((s) => s.pool);
  const deckUids = useSealedStore((s) => s.deckUids);
  const addBasicLand = useSealedStore((s) => s.addBasicLand);
  const removeLand = useSealedStore((s) => s.removeLand);

  useEffect(() => {
    let cancelled = false;
    const inSetBasics = setCards.filter((c) => isBasicLandCard(c) && isStandardPlayableCard(c));

    async function resolve() {
      const resolved: Partial<Record<BasicLandName, ScryfallCard>> = {};
      for (const name of LAND_NAMES) {
        const inSet = inSetBasics.find((c) => c.name === name);
        if (inSet) {
          resolved[name] = inSet;
          continue;
        }
        if (name === "Wastes" && !inSetBasics.length) continue; // don't force Wastes on sets without colorless
        try {
          resolved[name] = await fetchCardByExactName(name);
        } catch {
          // skip silently - land just won't be offered
        }
      }
      if (!cancelled) setLands(resolved);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [setCards]);

  const deckLandCards = pool.filter((p) => p.fromLand && deckUids.includes(p.uid));

  const countFor = (name: BasicLandName) =>
    deckLandCards.filter((p) => p.card.name === name).length;

  const lastUidFor = (name: BasicLandName): string | undefined => {
    const matches = deckLandCards.filter((p) => p.card.name === name);
    return matches[matches.length - 1]?.uid;
  };

  return (
    <div className="land-picker">
      <h3>Add basic lands</h3>
      <p className="land-picker__hint">These come from outside your sealed pool and don't count against your packs.</p>
      <div className="land-picker__row">
        {LAND_NAMES.map((name) => {
          const card = lands[name];
          if (!card) return null;
          const count = countFor(name);
          return (
            <div className="land-picker__item" key={name}>
              <img src={card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal} alt={name} />
              <div className="land-picker__controls">
                <button
                  type="button"
                  onClick={() => {
                    const uid = lastUidFor(name);
                    if (uid) removeLand(uid);
                  }}
                  disabled={count === 0}
                  aria-label={`Remove ${name}`}
                >
                  −
                </button>
                <span className="land-picker__count">{count}</span>
                <button type="button" onClick={() => addBasicLand(card, name)} aria-label={`Add ${name}`}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
