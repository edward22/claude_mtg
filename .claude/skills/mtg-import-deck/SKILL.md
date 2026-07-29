---
name: mtg-import-deck
description: Import an MTG Arena (MTGA) deck export .txt file as either the "user" deck or the "opponent" deck for the mtg-play game engine, parsing it and enriching card_database.json with each card's actual rules text. Use when the user provides/mentions an MTGA deck file, asks to import/register a deck, or wants to set up decks before playing a game.
---

# Import an MTGA deck

Goal: turn a raw MTGA export text file into (a) a parsed deck JSON the
engine can shuffle into a library, and (b) confirmed rules-text entries in
`card_database.json` for every card in it.

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

3. **Look up every card against the local Oracle dump — this is the
   primary, authoritative path:**
   ```
   python3 -m mtg_engine.oracle merge decks/<label>.json
   ```
   This reads `oracle-cards-*.jsonl.gz` at the repo root (a Scryfall
   "Oracle Cards" bulk data file — see `mtg_engine/oracle.py`'s docstring
   for where to get/refresh one) and merges an authoritative entry for
   every name it finds straight into `card_database.json`: exact mana
   cost, type line, P/T, keywords, and Oracle text, no guessing involved.
   It prints `{"found": [...], "missing": [...]}`.

   Trust this over your own memory of a card — real Oracle text is
   frequently more precise or has been updated by errata since training
   (e.g. templating changes, functional reprints), and this has already
   caught several cases where recalled wording was subtly wrong.

4. **Only for names in `"missing"`** (not present in the bulk dump — e.g.
   a brand-new set released after the dump was generated, or a name typo)
   fall back to your own MTG knowledge and add the entry by hand, in the
   same shape `oracle.py` produces:
   ```json
   {
     "name": "...", "mana_cost": "{1}{R}", "cmc": 2, "colors": ["R"],
     "type_line": "Creature — Human Warrior", "power": "2", "toughness": "2",
     "loyalty": null, "keywords": ["First strike", "Haste"],
     "oracle_text": "First strike, haste. Whenever this creature deals combat damage to a player, ..."
   }
   ```
   - Set `"unverified": true` on any hand-added entry you're not fully
     confident about — the board renderer flags these with a `?` badge.
   - Double-faced/split/adventure cards looked up via `oracle.py` already
     get a `"back_face"` key in the same shape when relevant; do the same
     by hand if you're adding one manually.
   - If `oracle-cards-*.jsonl.gz` is missing entirely, tell the user and
     fall back to doing this step for every card, same as before.

5. **Report to the user**: how many cards were found in the bulk dump vs.
   filled in by hand, and list anything still `"unverified"` so they can
   correct it if they know the real wording.

6. **Ask which slot** this deck fills if not already told — `user` or
   `opponent` — and remember `decks/<label>.json` as that slot's deck for
   the upcoming `mtg-new-game` call. Two decks (one per slot) are required
   before a game can start.

Do not invent card names that aren't in the actual export — if a line in
the file doesn't parse (rare formatting variants), show it to the user
rather than silently dropping it.
