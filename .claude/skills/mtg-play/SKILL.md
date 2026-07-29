---
name: mtg-play
description: Play/referee a Magic the Gathering game turn by turn from an existing games/<game_id>/game_state.json - the user plays their deck, Claude plays the opponent deck and acts as rules judge for both, re-rendering the board after every meaningful change. Use whenever continuing an in-progress MTG game, or resuming one after mtg-new-game, or when asked to "take a turn", "keep playing", "what's the board state" during a game.
---

# Referee and play a game of Magic

You are the rules engine, the judge, and the opponent, all at once. The
human plays whichever side is `players.user`; you play `players.opponent`.
Read `mtg_engine/rules_reference.md` once at the start of a session if you
haven't already internalized it — it's the condensed comprehensive rules
this whole skill is built on. `card_database.json` is the authority on
what any given card actually does; it wins over the generic rules
whenever a card's text says otherwise.

**No live card lookups exist in this environment** (Scryfall etc. are
network-blocked). If you hit a card whose exact wording you're unsure of
mid-game, make the most standard ruling, log it, mark that card entry
`"unverified": true` if it isn't already, and move on — don't stall the
game.

## State conventions (read/write `games/<game_id>/game_state.json` directly)

- **Permanent objects** on a `battlefield` array:
  `{"id": <int>, "name": str, "tapped": bool, "summoning_sick": bool,
  "damage": int, "counters": {"+1/+1": n, ...}, "attachments": [names],
  "attacking": bool (combat only), "blocking": [ids] (combat only)}`.
  Assign new ids from that player's `next_permanent_id` and increment it —
  the renderer and your own bookkeeping rely on ids being stable and
  unique per player.
- **Stack items**: `{"kind": "spell"|"ability"|"trigger", "name": str,
  "controller": "user"|"opponent", "description": str, "targets": [...]}`.
  Append to the end of `state["stack"]`; the *last* element is the top and
  resolves first. Clear it out (pop) as things resolve.
- **Mana pool** (`players.<p>.mana_pool`) empties at the end of each step
  and phase (rule of thumb: clear it whenever you advance `step`/`phase`,
  unless something is explicitly keeping it, which is rare).
- **Land drops**: `land_drops_used` resets to 0 at the start of each of
  that player's turns; normally capped at 1 unless a card grants more.
- Only `mtg_engine/state.py` should touch shuffling, drawing, or coin
  flips (it uses a real CSPRNG) — never hand-wave "I draw a random card,"
  always call `python3 -m mtg_engine.state draw <game_id> <player> [--count N]`.

## The turn loop

Work through `mtg_engine/rules_reference.md` section 2 one step at a time.
For each step:

1. Apply automatic effects (untap, draw, whoever gets a step-based
   trigger).
2. Put any triggered abilities on the stack (active player's first, then
   nonactive player's, if both trigger at once).
3. Give priority starting with the active player. Resolve the stack from
   the top down between priority passes (see rules_reference.md section
   3). Check state-based actions (section 6) continuously, before anyone
   gets priority and after every resolution.
4. Once both players pass with an empty stack, move to the next step.

**Whose decision is it?**
- If it's the user's turn to act (their main phase, their attacker/blocker
  declarations, or any time they'd get priority with something worth
  responding to), stop and ask them in chat what they want to do. Show
  relevant options (untapped mana available, castable cards in hand,
  legal attackers/blockers) rather than making them recompute it.
- If it's your (opponent) turn to act, just decide reasonably (play to
  win, use removal on threats, don't misplay obvious lines) and narrate
  briefly what you did and why in 1-2 sentences.
- You do not need to stop and ask the user for permission on your own
  plays — only pause for input on choices that are actually theirs.
- Fast-forward uneventful steps (untap/upkeep/draw with nothing to do)
  without a full stop; still update state and re-render.

## Casting a spell / activating an ability

1. Verify timing is legal (sorcery-speed needs empty stack + your main
   phase + priority; instant-speed anytime you have priority) and the
   caster can pay costs (mana available, plus any additional costs).
2. Choose targets if required; illegal-target casts aren't allowed.
3. Move it conceptually onto `stack` (append the stack item), tap lands /
   deduct mana pool for cost payment, mark the permanent list changes.
4. Give the other player a chance at priority before it resolves (ask the
   user if it's their turn to respond; decide quickly yourself if it's
   your turn to respond, usually "no response").
5. Resolve top-of-stack per its oracle text, apply results to
   battlefield/graveyard/life/etc., pop it off the stack.

## Combat

Follow rules_reference.md section 5. Concretely:
- Declare attackers: mark `attacking: true` and tap each attacker unless
  vigilance; check summoning sickness/haste first.
- Declare blockers: set `blocking: [attacker_id]` on each blocking
  creature; validate flying/reach/menace/protection restrictions.
- Damage: compute simultaneously (first-strike/double-strike creatures
  get an earlier damage step). Apply keyword effects (deathtouch,
  trample, lifelink) per rules_reference.md section 7. Mark `damage` on
  permanents and adjust life totals, then run state-based actions
  (lethal damage -> graveyard).

## State-based actions

After *every* resolution, damage event, or life/loyalty change, sweep for:
life <= 0, empty-library draw, 10+ poison, lethal damage or toughness <= 0
creatures, 0-loyalty planeswalkers, illegal auras, the legend rule. Apply
them all as one simultaneous event (rules_reference.md section 6), then
check again in case that cascades, before continuing.

## Rendering cadence

After any change worth seeing — a card entering/leaving a zone, a tap/
untap, damage, a life total change, the stack changing, a phase/step
change — regenerate and republish the board:
```
python3 -m mtg_engine.render <game_id>
```
then redeploy it with the Artifact tool at the **same file path** used
since `mtg-new-game` (so it updates the same URL rather than minting a
new one). You don't need to narrate every micro-update in chat text if
the artifact already shows it — a short note of what changed is enough.

## Ending the game

When a state-based action causes a player to lose (or they concede),
announce the result, stop advancing turns, and leave the final board
state rendered. Offer to start a rematch via **mtg-new-game** (same
decks, freshly shuffled) if the user wants to keep playing.
