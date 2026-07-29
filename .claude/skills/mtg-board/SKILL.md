---
name: mtg-board
description: Re-render and republish the current board view for an in-progress MTG game without advancing anything, e.g. "show me the board", "refresh the board", or after resuming a game/session where the artifact link was lost. Use for on-demand board display only, not for taking a turn.
---

# Show the current board state

A read-only refresh — does not change game state, draw cards, or advance
turns.

1. If more than one game exists under `games/`, ask which `game_id` (or
   infer from recent conversation context).
2. Regenerate the HTML:
   ```
   python3 -m mtg_engine.render <game_id>
   ```
3. Publish/redeploy it with the Artifact tool. If this game already has a
   published artifact from earlier in the session, redeploy to that same
   file path so the URL stays the same; otherwise publish fresh (title
   "MTG — <game_id>", favicon 🃏).

If the user actually wants to take an action (play a card, pass turn,
declare attackers, etc.) rather than just look at the board, use
**mtg-play** instead.
