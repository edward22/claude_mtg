import type { PoolCard, ScryfallCard } from "../types";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function isBasicLandCard(card: ScryfallCard): boolean {
  return card.type_line?.includes("Basic Land") ?? false;
}

function isMainRarityCard(card: ScryfallCard): boolean {
  return (
    card.lang === "en" &&
    !isBasicLandCard(card) &&
    (card.rarity === "common" || card.rarity === "uncommon" || card.rarity === "rare" || card.rarity === "mythic")
  );
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
export function classifyCardsForBoosters(cards: ScryfallCard[]): BoosterCardPools {
  const warnings: string[] = [];

  const byRarity = (pool: ScryfallCard[], rarity: ScryfallCard["rarity"]) =>
    pool.filter((c) => c.rarity === rarity);

  const boosterEligible = cards.filter((c) => c.booster && isMainRarityCard(c));
  const allMainRarity = cards.filter(isMainRarityCard);

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
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks: T[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(shuffled[i % shuffled.length]);
    // Reshuffle once we've wrapped around so repeats aren't in a fixed pattern.
    if ((i + 1) % shuffled.length === 0) shuffled.sort(() => Math.random() - 0.5);
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
