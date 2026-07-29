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
  **Oracle text**, filled in from Claude's own MTG knowledge when a deck
  is imported. This exists because **this environment has no network
  access to Scryfall or any other card database** — the local file is the
  only source of truth for what a card actually does, so it's worth
  skimming after an import for any card flagged `"unverified": true` and
  correcting if you know the real wording.

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

- **No live rules lookups.** Card rulings come from Claude's own training
  knowledge plus `mtg_engine/rules_reference.md`, not a live database.
  For obscure or errata-heavy cards, double-check anything marked
  `unverified` in `card_database.json`.
- **Hidden information lives in a plaintext file.** `game_state.json`
  contains the true library order and the opponent's hand — don't open it
  mid-game if you want the fog of war to feel real; the board artifact is
  the intended window into the game.
- This engine targets standard 2-player constructed Magic (no Commander-
  specific rules like command zone tax, partner, etc.).
