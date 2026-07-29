# MTG Sealed Simulator

A browser-based sealed-deck simulator for Magic: The Gathering. Pick any
Scryfall-known set — including unreleased/preview sets — open a batch of
boosters generated from real card data with standard rarity slotting, then
build and export a sealed deck.

## Features

- **Any set, including unreleased ones.** Pulls the full set list from
  Scryfall, so upcoming previewed sets show up as soon as Scryfall has
  spoiler data for them.
- **Standard booster rules.** 10 commons / 3 uncommons / 1 rare-or-mythic
  (1-in-8 mythic ratio) / 1 basic land, with a roughly 1-in-3 chance of a
  bonus foil, drawn from the set's actual card pool and rarities.
- **Deck builder** with mana curve chart (colored by color identity),
  sortable pool/deck views, and a basic-land picker that adds lands from
  outside your sealed pool for free.
- **MTGA export** — copy or download a `Deck` / `Sideboard` list in the
  format MTG Arena's Import feature expects.
- **iPad-friendly** touch UI.
- Respects [Scryfall's rate limits](https://scryfall.com/docs/api/rate-limits)
  by throttling requests and caching all API responses in `localStorage`.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build
```

This is a pure client-side app (no backend) — it calls the Scryfall API
directly from the browser.

## Legal

This is unofficial Fan Content permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC. Card data and
images courtesy of the [Scryfall API](https://scryfall.com/docs/api).
