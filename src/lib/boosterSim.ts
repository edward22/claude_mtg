import type { PoolCard, ScryfallCard } from "../types";
import { shuffle } from "./shuffle";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function isBasicLandCard(card: ScryfallCard): boolean {
  return card.type_line?.includes("Basic Land") ?? false;
}

// Layouts that aren't a normal single playable card - joke sticker sheets,
// tokens, emblems, etc. - and so aren't meaningful to open in a sealed pool.
const NON_STANDARD_LAYOUTS = new Set([
  "token",
  "double_faced_token",
  "emblem",
  "scheme",
  "vanguard",
  "planar",
  "art_series",
  "stickers",
  "augment",
  "host",
]);

/**
 * Excludes silver-border/"acorn"-stamped Un-set joke cards, other
 * non-standard game pieces (Attractions, Contraptions, sticker sheets, ...)
 * that need special rules or components most players won't have on hand,
 * and full-art/textless printings that don't show rules text on the card.
 */
export function isStandardPlayableCard(card: ScryfallCard): boolean {
  if (card.border_color === "silver") return false;
  if (card.security_stamp === "acorn") return false;
  if (NON_STANDARD_LAYOUTS.has(card.layout)) return false;
  if (card.type_line?.includes("Attraction") || card.type_line?.includes("Contraption")) return false;
  if (card.full_art) return false;
  if (card.textless) return false;
  return true;
}

function isMainRarityCard(card: ScryfallCard): boolean {
  return (
    card.lang === "en" &&
    !isBasicLandCard(card) &&
    (card.rarity === "common" || card.rarity === "uncommon" || card.rarity === "rare" || card.rarity === "mythic")
  );
}

function leadingCollectorNumber(card: ScryfallCard): number {
  const match = card.collector_number.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Collapses alternate treatments of the same card (showcase, extended art,
 * borderless, ...) down to one printing each, keeping the lowest collector
 * number - by Magic's numbering convention that's the main-set printing;
 * bonus/showcase treatments get appended after it with higher numbers.
 *
 * Only used for the "official booster data isn't available" fallback pool.
 * The primary boosterEligible pool is trusted as-is: Scryfall's per-printing
 * `booster` flag is what actually distinguishes which specific treatments
 * appear in packs (and modern Play Boosters can legitimately include a
 * showcase/borderless treatment as its own separate pull), so deduping
 * there could incorrectly remove a real possibility. The fallback pool has
 * no such distinction - it's just "every card of this rarity" - so without
 * this it would treat a bonus-sheet showcase printing as an equally likely
 * pull alongside the regular one, e.g. a card appearing at both a low
 * main-set number and a high bonus-sheet number would get drawn twice as
 * often as anything else.
 */
function dedupeAlternateTreatments(cards: ScryfallCard[]): ScryfallCard[] {
  const byName = new Map<string, ScryfallCard>();
  for (const card of cards) {
    const existing = byName.get(card.name);
    if (!existing || leadingCollectorNumber(card) < leadingCollectorNumber(existing)) {
      byName.set(card.name, card);
    }
  }
  return [...byName.values()];
}

export interface BoosterCardPools {
  commons: ScryfallCard[];
  uncommons: ScryfallCard[];
  rares: ScryfallCard[];
  mythics: ScryfallCard[];
  lands: ScryfallCard[];
  warnings: string[];
}

/**
 * Splits every printed card for a set into the pools a booster pack draws
 * from. Prefers cards Scryfall marks `booster: true`; falls back to the
 * full rarity pool (with a warning) when a set doesn't have enough booster
 * data yet - this happens for unreleased / freshly spoiled sets.
 */
export function classifyCardsForBoosters(rawCards: ScryfallCard[]): BoosterCardPools {
  const warnings: string[] = [];
  const cards = rawCards.filter(isStandardPlayableCard);

  const byRarity = (pool: ScryfallCard[], rarity: ScryfallCard["rarity"]) =>
    pool.filter((c) => c.rarity === rarity);

  const boosterEligible = cards.filter((c) => c.booster && isMainRarityCard(c));
  const allMainRarity = dedupeAlternateTreatments(cards.filter(isMainRarityCard));

  // Require a reasonable minimum for a 15-card pack to look "real" - if the
  // booster-flagged pool is too thin (common for spoiler-only/unreleased
  // sets), fall back to every card of that rarity in the set.
  let commons = byRarity(boosterEligible, "common");
  let uncommons = byRarity(boosterEligible, "uncommon");
  let rares = byRarity(boosterEligible, "rare");
  let mythics = byRarity(boosterEligible, "mythic");

  if (commons.length < 8) {
    commons = byRarity(allMainRarity, "common");
    if (commons.length) warnings.push("Using all commons in the set - official booster slot data isn't available yet.");
  }
  if (uncommons.length < 3) {
    uncommons = byRarity(allMainRarity, "uncommon");
    if (uncommons.length) warnings.push("Using all uncommons in the set - official booster slot data isn't available yet.");
  }
  if (rares.length < 1) {
    rares = byRarity(allMainRarity, "rare");
  }
  if (mythics.length < 1) {
    mythics = byRarity(allMainRarity, "mythic");
  }

  // A very small pool for a rarity means repeats are mathematically forced,
  // not a randomness bug - this is common for sets that are still being
  // previewed/spoiled and only have a handful of cards revealed so far.
  // Every pack needs 10 commons and 3 uncommons, so state the actual pool
  // size rather than a vague "expect repeats" - the number makes it obvious.
  if (commons.length > 0 && commons.length < 10) {
    warnings.push(
      `Only ${commons.length} common${commons.length === 1 ? "" : "s"} available for this set so far, but each pack needs 10 - expect heavy repeats until Scryfall has more spoiler data.`
    );
  }
  if (uncommons.length > 0 && uncommons.length < 3) {
    warnings.push(
      `Only ${uncommons.length} uncommon${uncommons.length === 1 ? "" : "s"} available for this set so far, but each pack needs 3 - expect repeats until Scryfall has more spoiler data.`
    );
  }
  if (rares.length > 0 && rares.length <= 3) {
    warnings.push(`Only ${rares.length} rare${rares.length === 1 ? "" : "s"} available for this set so far - expect repeats until Scryfall has more spoiler data.`);
  }
  if (mythics.length > 0 && mythics.length <= 3) {
    warnings.push(`Only ${mythics.length} mythic${mythics.length === 1 ? "" : "s"} available for this set so far - expect repeats until Scryfall has more spoiler data.`);
  }

  const boosterLands = cards.filter((c) => c.booster && isBasicLandCard(c));
  const lands = boosterLands.length ? boosterLands : cards.filter(isBasicLandCard);
  if (!lands.length) {
    warnings.push("This set has no basic lands printed in it, so packs won't include a land slot.");
  }

  if (!commons.length || !uncommons.length || (!rares.length && !mythics.length)) {
    warnings.push(
      "This set doesn't have enough Scryfall card data to fully simulate boosters (common for unreleased sets). Packs will use whatever cards are available."
    );
  }

  return { commons, uncommons, rares, mythics, lands, warnings };
}

function sampleWithoutReplacement<T>(pool: T[], count: number): T[] {
  if (!pool.length) return [];
  let shuffled = shuffle(pool);
  const picks: T[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(shuffled[i % shuffled.length]);
    // Reshuffle once we've wrapped around so repeats aren't in a fixed pattern.
    if ((i + 1) % shuffled.length === 0) shuffled = shuffle(pool);
  }
  return picks;
}

function pickOne<T>(pool: T[]): T | undefined {
  if (!pool.length) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface BoosterOptions {
  /** Standard draft booster is 15 cards: 10C/3U/1R-M/1 land. */
  commonCount: number;
  uncommonCount: number;
  landCount: number;
  /** Chance the rare slot is upgraded to a mythic rare (classic ratio: 1/8). */
  mythicChance: number;
  /** Modern packs (2016+) carry roughly a 1-in-3 chance of an extra foil replacing a random card. */
  foilChance: number;
}

export const DEFAULT_BOOSTER_OPTIONS: BoosterOptions = {
  commonCount: 10,
  uncommonCount: 3,
  landCount: 1,
  mythicChance: 1 / 8,
  foilChance: 1 / 3,
};

function toPoolCard(card: ScryfallCard, foil: boolean): PoolCard {
  return { uid: uid(), card, foil, fromLand: false };
}

export function generatePack(pools: BoosterCardPools, options: BoosterOptions = DEFAULT_BOOSTER_OPTIONS): PoolCard[] {
  const cards: ScryfallCard[] = [];

  cards.push(...sampleWithoutReplacement(pools.commons, options.commonCount));
  cards.push(...sampleWithoutReplacement(pools.uncommons, options.uncommonCount));

  const wantMythic = pools.mythics.length > 0 && Math.random() < options.mythicChance;
  const rareSlot = wantMythic ? pickOne(pools.mythics) : pickOne(pools.rares) ?? pickOne(pools.mythics);
  if (rareSlot) cards.push(rareSlot);

  if (options.landCount > 0 && pools.lands.length) {
    cards.push(...sampleWithoutReplacement(pools.lands, options.landCount));
  }

  const poolCards = cards.map((c) => toPoolCard(c, false));

  if (poolCards.length && Math.random() < options.foilChance) {
    const idx = Math.floor(Math.random() * poolCards.length);
    poolCards[idx] = { ...poolCards[idx], foil: true };
  }

  return poolCards;
}

export function generatePacks(pools: BoosterCardPools, count: number, options?: BoosterOptions): PoolCard[][] {
  return Array.from({ length: count }, () => generatePack(pools, options));
}
