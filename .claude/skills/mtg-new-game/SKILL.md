---
name: mtg-new-game
description: Start a fresh two-player Magic game from two already-imported decks (user vs. Claude) - shuffles, draws opening hands, handles mulligans, decides who plays first, and publishes the initial board view. Use when the user wants to start/begin a new MTG game, or asks for a new match/rematch.
---

# Start a new game

Prerequisite: both decks have been imported via the **mtg-import-deck**
skill (`decks/<user-label>.json` and `decks/<opponent-label>.json` exist,
and `card_database.json` has entries for their cards). If either is
missing, run that skill first — don't guess at a decklist.

## Steps

1. **Pick a game id.** Short slug, e.g. `game1`, or a timestamp if the
   user is likely to play multiple matches (`2026-07-29-1`). This becomes
   `games/<game_id>/`.

2. **Create the game state** (this is the only step that needs real
   randomness, so it goes through the script rather than you narrating a
   shuffle):
   ```
   python3 -m mtg_engine.state new-game <game_id> \
     --user-deck decks/<user-label>.json \
     --opponent-deck decks/<opponent-label>.json \
     --user-name "<user's name or 'You'>" --opponent-name "Claude"
   ```
   This shuffles both libraries with a CSPRNG, draws each player 7 cards,
   and flips a coin for who's on the play. It writes
   `games/<game_id>/game_state.json`.

3. **Mulligans.** In turn order starting with whoever goes first, ask
   each real decision-maker whether they want to mulligan (London
   mulligan: shuffle hand back in, draw a fresh 7, then bottom N cards
   where N = mulligans taken so far).
   - For the user: show their hand (from `game_state.json`, or re-render
     the board — see step 5) and ask via a normal chat question whether
     to keep or mulligan. Repeat for each mulligan they take.
   - For your own (opponent) hand: decide for yourself using ordinary
     mulligan judgment (keep most 2-5 land hands with some action; mulligan
     0-1 or 6-7 land hands), and just say what you did.
   - To take a mulligan: `python3 -m mtg_engine.state mulligan <game_id> user`
     or `... mulligan <game_id> opponent`. This does the shuffle+draw7 part
     automatically. Afterward, editing `game_state.json` directly, move
     `mulligans_taken` cards from that player's `hand` to the *bottom* of
     `library` (their choice for the user, your own reasonable choice for
     yourself) — the script only handles the randomized part.

4. **Set the true starting turn.** Once mulligans are resolved, in
   `game_state.json` set `turn: 1`, `phase: "beginning"`,
   `step: "upkeep"`, `priority` and `active_player` to whoever's on the
   play. The player on the play skips their first draw step (core rule) —
   note this so the mtg-play skill doesn't draw them a card on turn 1.

5. **Render and publish the board.**
   ```
   python3 -m mtg_engine.render <game_id>
   ```
   writes `games/<game_id>/board.html`. Publish/redeploy it with the
   Artifact tool (title e.g. "MTG — <game_id>", favicon 🃏) so the user has
   a live view of the table. Keep using the *same file path* for this
   game's whole lifetime so it updates in place rather than minting new
   URLs each turn.

6. Hand off to the **mtg-play** skill to actually run the turns.

Remind the user once, lightly: `game_state.json` contains true hidden
information (both libraries' order, your hand) in plaintext, so if they
want the fog-of-war experience to feel real they shouldn't go read that
file mid-game — the board.html view is the intended window into the game.
