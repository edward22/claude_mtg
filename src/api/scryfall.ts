import type { ScryfallCard, ScryfallList, ScryfallSet } from "../types";

// --- Scryfall API client -------------------------------------------------
// Respects https://scryfall.com/docs/api/rate-limits : Scryfall asks for
// 50-100ms between requests and heavy caching of anything that doesn't
// change often. We enforce a minimum gap between outgoing requests with a
// simple queue, and cache every GET response in localStorage keyed by URL
// with a time-to-live so repeat visits (or repeated pack openings) don't
// re-hit the API at all.

const API_BASE = "https://api.scryfall.com";
const MIN_REQUEST_GAP_MS = 110;
const CACHE_PREFIX = "scryfall-cache:";

const SET_LIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h - set list / spoiler info can change
const CARD_SEARCH_TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface CacheEntry<T> {
  storedAt: number;
  ttl: number;
  data: T;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.storedAt > entry.ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T, ttl: number) {
  const entry: CacheEntry<T> = { storedAt: Date.now(), ttl, data };
  const payload = JSON.stringify(entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, payload);
  } catch {
    // Storage quota exceeded - evict the oldest scryfall cache entries and retry once.
    evictOldestCacheEntries(10);
    try {
      localStorage.setItem(CACHE_PREFIX + key, payload);
    } catch {
      // give up silently, caching is best-effort
    }
  }
}

function evictOldestCacheEntries(count: number) {
  const entries: { key: string; storedAt: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(CACHE_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key) || "{}");
      entries.push({ key, storedAt: entry.storedAt || 0 });
    } catch {
      entries.push({ key, storedAt: 0 });
    }
  }
  entries.sort((a, b) => a.storedAt - b.storedAt);
  for (const e of entries.slice(0, count)) localStorage.removeItem(e.key);
}

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttledFetch(url: string): Promise<Response> {
  const run = queue.then(async () => {
    const wait = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fetch(url, {
      headers: { Accept: "application/json" },
    });
  });
  // Keep the queue chain alive even if this particular request rejects.
  queue = run.catch(() => undefined);
  return run;
}

async function cachedGet<T>(url: string, ttl: number): Promise<T> {
  const cached = readCache<T>(url);
  if (cached) return cached;
  const res = await throttledFetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Scryfall rate limit hit - please wait a moment and try again.");
    }
    const body = await res.json().catch(() => null);
    throw new Error(body?.details || `Scryfall request failed (${res.status})`);
  }
  const data: T = await res.json();
  writeCache(url, data, ttl);
  return data;
}

export async function fetchAllSets(): Promise<ScryfallSet[]> {
  const data = await cachedGet<ScryfallList<ScryfallSet>>(`${API_BASE}/sets`, SET_LIST_TTL_MS);
  return data.data;
}

/** Fetches every printed card (all prints, all languages excluded) for a set code, paginating as needed. */
export async function fetchCardsForSet(setCode: string): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  const code = setCode.toLowerCase();
  let url: string | undefined =
    `${API_BASE}/cards/search?q=` +
    encodeURIComponent(`set:${code} lang:en`) +
    `&unique=prints&order=set&include_extras=true&include_variations=true`;

  while (url) {
    const page: ScryfallList<ScryfallCard> = await cachedGet<ScryfallList<ScryfallCard>>(url, CARD_SEARCH_TTL_MS);
    cards.push(...page.data);
    url = page.has_more ? page.next_page : undefined;
  }
  return cards;
}

/** Looks a card up by its exact name (used for basic-land fallback art). */
export async function fetchCardByExactName(name: string): Promise<ScryfallCard> {
  const url = `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}`;
  return cachedGet<ScryfallCard>(url, CARD_SEARCH_TTL_MS);
}

export function clearScryfallCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
