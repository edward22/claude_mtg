---
name: mtg-import-deck
description: Import an MTG Arena (MTGA) deck export .txt file as either the "user" deck or the "opponent" deck for the mtg-play game engine, parsing it and enriching card_database.json with each card's actual rules text. Use when the user provides/mentions an MTGA deck file, asks to import/register a deck, or wants to set up decks before playing a game.
---

# Import an MTGA deck

Goal: turn a raw MTGA export text file into (a) a parsed deck JSON the
engine can shuffle into a library, and (b) confirmed rules-text entries in
`card_database.json` for every card in it, since the game engine has no
network access to look cards up live (Scryfall etc. are blocked in this
sandbox) — the card database is the only source of truth for what a card
actually does.

## Steps

1. **Locate the input.** The user will give you a path to an MTGA export
   `.txt` file (or paste its contents — if pasted, write it to
   `decks/<label>.txt` first). `decks/sample_user.txt` and
   `decks/sample_opponent.txt` are example fixtures already in the repo if
   you need something to test against.

2. **Parse it:**
   ```
   python3 -m mtg_engine.deck_parser decks/<label>.txt -o decks/<label>.json
   ```
   This produces `mainboard_count`, the `deck`/`sideboard` sections, and
   `unique_card_names`. Sanity-check `mainboard_count` — constructed decks
   should be 60+ (or 100 + 1 commander for Commander, but this engine
   currently assumes standard 2-player constructed; flag it to the user if
   the count looks like a Commander/Limited deck instead).

3. **Diff against the card database.** Read `card_database.json` (repo
   root) and find which of `unique_card_names` are missing.

4. **Fill in missing cards from your own MTG knowledge.** For each missing
   card, add an entry to `card_database.json` keyed by exact card name:
   ```json
   {
     "name": "...", "mana_cost": "{1}{R}", "cmc": 2, "colors": ["R"],
     "type_line": "Creature — Human Warrior", "power": 2, "toughness": 2,
     "loyalty": null, "keywords": ["First strike", "Haste"],
     "oracle_text": "First strike, haste. Whenever ~ deals combat damage to a player, ..."
   }
   ```
   - `mana_cost` uses `{}` symbols per pip, e.g. `{2}{U}{U}`; empty string
     for lands/tokens with no mana cost.
   - `oracle_text` should be the card's actual current Oracle wording as
     best you know it — this is what mtg-play will adjudicate rulings
     from, alongside `mtg_engine/rules_reference.md`.
   - Basic lands just need `type_line: "Basic Land — <Type>"` and a note
     like `({T}: Add {R}.)` in oracle_text.
   - If you are **not confident** you have the exact current wording
     (recent set, errata-heavy card, or you're simply unsure), still fill
     in your best understanding but set `"unverified": true` on that
     entry. The board renderer flags unverified cards with a `?` badge.
   - Double-faced/adventure/split cards: represent both faces if it
     matters for play (e.g. `"back_face": {...same shape...}`); note it
     plainly since the engine doesn't have special DFC handling beyond
     what you track by hand.

5. **Report unverified cards to the user** at the end: "I've added N new
   cards; I'm not fully confident about the exact wording of: X, Y — let
   me know if you have the real Oracle text so I can correct it before we
   play." Since there's no live card lookup available in this
   environment, this is the main integrity check available.

6. **Ask which slot** this deck fills if not already told — `user` or
   `opponent` — and remember `decks/<label>.json` as that slot's deck for
   the upcoming `mtg-new-game` call. Two decks (one per slot) are required
   before a game can start.

Do not invent card names that aren't in the actual export — if a line in
the file doesn't parse (rare formatting variants), show it to the user
rather than silently dropping it.
