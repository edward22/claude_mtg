# claude_mtg

Play Magic: The Gathering against Claude, from two MTG Arena (MTGA) deck
exports, with a live MTGA-style board view.

## How it works

Claude acts as the rules engine, judge, and opponent all at once, backed
by:

- `mtg_engine/deck_parser.py` — parses MTGA export `.txt` files into JSON.
- `mtg_engine/state.py` — owns everything that needs real randomness
  (shuffling, drawing, coin flips, mulligans) via a CSPRNG, not an LLM
  "picking" cards.
- `mtg_engine/render.py` — renders `games/<id>/game_state.json` into a
  self-contained MTGA-style HTML board (life totals, battlefield, hand,
  stack, graveyard/library counts), published live via Claude's Artifact
  tool and updated in place as the game progresses. It also prints a
  "Card reference" panel at the bottom of the board with full Oracle text
  for every card currently on either battlefield or in your hand, so you
  don't have to hover a tiny tooltip (or guess) to see what something
  actually does mid-game. It never includes the opponent's hand contents.
- `mtg_engine/rules_reference.md` — condensed MTG comprehensive rules
  (turn structure, priority/stack, combat, state-based actions, keywords)
  that Claude adjudicates from.
- `card_database.json` — per-card mana cost, type, P/T, keywords, and
  **Oracle text**, used for every ruling.
- `mtg_engine/oracle.py` — looks card data up against a local Scryfall
  "Oracle Cards" bulk data dump (`oracle-cards-*.jsonl.gz` at the repo
  root — this environment has no network access to query Scryfall live,
  so a local snapshot stands in for it) and merges authoritative entries
  straight into `card_database.json`. This is the primary source `mtg-
  import-deck` uses; Claude's own knowledge only fills in cards missing
  from the dump (flagged `"unverified": true` — worth double-checking
  those). Refresh the dump occasionally from
  https://scryfall.com/docs/api/bulk-data ("Oracle Cards") to pick up new
  sets; `oracle.py` always uses whichever `oracle-cards-*.jsonl.gz` sorts
  latest by filename.

## Playing a game

Four Claude Code skills, meant to be used in order:

1. **`/mtg-import-deck`** — import your MTGA export as the `user` deck,
   and (a second time) import an opponent decklist as the `opponent` deck
   for Claude to play. Two ready-made samples exist for testing without
   real decks: `decks/sample_user.txt` (mono-red aggro) and
   `decks/sample_opponent.txt` (mono-blue tempo).
2. **`/mtg-new-game`** — shuffles both decks, draws opening hands, walks
   through mulligans, and publishes the initial board.
3. **`/mtg-play`** — the main loop. Keep invoking this (or just keep
   talking — Claude will re-enter it) to take turns; it stops to ask you
   for decisions on your turn and plays its own side automatically,
   re-publishing the board artifact after every meaningful change.
4. **`/mtg-board`** — read-only: just refresh/show the current board
   without advancing anything.

## Caveats

- **No live network lookups.** Card data comes from the local
  `oracle-cards-*.jsonl.gz` bulk dump (see above), which is authoritative
  but a point-in-time snapshot — refresh it occasionally for new sets.
  Anything genuinely missing from the dump falls back to Claude's own
  knowledge and gets flagged `"unverified"` in `card_database.json`;
  double-check those. Turn-structure/stack/combat rulings come from
  `mtg_engine/rules_reference.md`.
- **Hidden information lives in a plaintext file.** `game_state.json`
  contains the true library order and the opponent's hand — don't open it
  mid-game if you want the fog of war to feel real; the board artifact is
  the intended window into the game.
- This engine targets standard 2-player constructed Magic (no Commander-
  specific rules like command zone tax, partner, etc.).
