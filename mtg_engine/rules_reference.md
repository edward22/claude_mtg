# MTG Rules Reference (condensed, for the mtg-play skill)

This is a working digest of the Magic: The Gathering Comprehensive Rules for
a **two-player, best-of-one, non-Commander, no-day/night, standard 60+ card
constructed game**. It is not a replacement for a card's own Oracle text —
`card_database.json` entries take precedence over generic rules whenever a
card explicitly says "unless"/"instead"/"can't"/etc. When a card's text and
this document conflict, the card wins (that's the rule in real Magic too:
card text overrides the rulebook).

## 1. Zones

Library, Hand, Battlefield, Graveyard, Stack, Exile, Command. In this
engine each player object in `game_state.json` has `library`, `hand`,
`battlefield`, `graveyard`, `exile`, `command` arrays plus shared `stack`.
Library/hand order and contents are hidden information from the human
player's perspective — the board renderer never reveals them, but remember
the JSON file itself is plaintext, so don't `cat`/open it in front of the
user mid-game if you want the fog of war to feel real.

## 2. Turn structure

Each turn has phases/steps, in order. Track `phase` and `step` on the game
state and advance one step at a time, applying state-based actions (SBA,
section 6) and letting both players get priority (section 3) before moving
on if anything happened.

1. **Beginning phase**
   - *Untap step*: active player untaps all their permanents. No player
     gets priority; no triggers normally go on the stack here (usually).
   - *Upkeep step*: triggers that say "at the beginning of upkeep" go on
     the stack now. Both players get priority.
   - *Draw step*: active player draws a card (skip on turn 1 for the
     player going first). Both players get priority afterward.
2. **Precombat main phase**: active player may play one land (once per
   turn, unless a card says otherwise) and cast sorcery-speed spells /
   activate sorcery-speed abilities, only while the stack is empty and
   they have priority.
3. **Combat phase**
   - *Beginning of combat*: triggers, priority.
   - *Declare attackers*: active player declares attackers (must be
     untapped, no summoning sickness unless haste; declaring taps them
     unless they have vigilance). Attack triggers go on stack, priority.
   - *Declare blockers*: defending player declares blockers (each blocker
     must be untapped; a creature can normally block only one attacker
     unless it has an ability granting more). Block triggers, priority.
   - *Combat damage step*: all combat damage is assigned and dealt
     simultaneously (unless first strike/double strike creatures are
     involved, which adds an extra first-strike damage step before the
     regular one). Priority after damage.
   - *End of combat*: triggers, priority.
4. **Postcombat main phase**: same rules as precombat main.
5. **Ending phase**
   - *End step*: "at the beginning of the end step" triggers, priority.
   - *Cleanup step*: active player discards down to their maximum hand
     size (7, unless modified), damage marked on permanents is removed,
     "until end of turn" effects end. Normally no priority unless
     something triggers here.

## 3. Priority & the stack

- A player with priority may cast an instant, activate an ability, or pass.
- When both players pass in succession with a nonempty stack, the top
  (most recently added) object on the stack resolves, then priority
  starts over with the active player.
- When both players pass with an empty stack, the game moves to the next
  step/phase.
- Casting a spell/activating an ability puts it on the stack; it does not
  resolve immediately. This is how "responses" work — e.g. a player can
  cast a removal spell in response to a creature's ETB trigger, before
  that trigger resolves.
- Represent stack items as `{"kind":"spell"|"ability"|"trigger", "name":...,
  "controller":..., "description":..., "targets":[...]}` in `state["stack"]`
  (index 0 = bottom, last = top; resolve from the end of the list).

## 4. Casting spells & costs

- Sorcery-speed: only during your own main phase, stack empty, you have
  priority. Instant-speed: any time you have priority.
- Steps to cast: move to stack -> choose modes/targets -> determine total
  cost (mana cost + additional/alternative costs, mana abilities applied)
  -> pay costs -> spell becomes cast (triggers "when you cast" abilities).
- A spell needs legal targets, if it has any, both when put on the stack
  and again on resolution (illegal-target spells with all targets illegal
  are countered by game rules and do nothing).
- Mana abilities don't use the stack and resolve instantly.

## 5. Combat quick rules

- Attackers must be untapped and not summoning-sick (haste bypasses this)
  unless an effect says otherwise (e.g. vigilance means attacking doesn't
  tap it).
- A defending creature can block an attacker if it's untapped and not
  prevented (e.g. by "can't block" or the attacker having menace, which
  requires 2+ blockers).
- Flying/reach: a creature with flying can only be blocked by
  flying/reach. Menace: can only be blocked by 2+ creatures. Intimidate/
  fear/skulk/protection: check the specific card's exact wording.
- Damage assignment order for multiple blockers is chosen by the attacking
  player; damage must be lethal to an earlier blocker before assigning to
  the next unless the attacker has trample (excess tramples through to
  the defending player/planeswalker).
- First strike/double strike creatures deal damage in a separate,
  earlier combat damage step; double strike deals damage in both steps.
- Deathtouch: any nonzero damage from a deathtouch source is lethal.
- Lifelink: damage dealt also gains its controller that much life.

## 6. State-based actions (checked continuously, whenever a player would get priority)

- A player with life <= 0 loses.
- A player who was instructed to draw from an empty library loses (as
  soon as SBAs are next checked).
- A player with 10+ poison counters loses.
- A creature with toughness <= 0 is put into its owner's graveyard.
- A creature with damage marked >= toughness (and toughness > 0) is
  destroyed (goes to graveyard), unless it has indestructible.
- A planeswalker with loyalty 0 is put into its owner's graveyard.
- Legend rule: if a player controls two+ legendary permanents with the
  same name, they choose one to keep and put the rest into the graveyard.
- Auras attached illegally (e.g. its enchanted permanent left the
  battlefield, or it's attached to something it can't legally enchant)
  are put into the graveyard.
- A token in a graveyard/hand/library/anywhere but the battlefield ceases
  to exist (this is a state-based action too, applied as soon as it
  changes zones).
- Apply ALL applicable SBAs simultaneously as a single event, then check
  again (they can cascade), before anyone gets priority.

## 7. Keyword glossary (most common; consult card_database.json oracle text for exact wording on a specific card, since some have reminder-text variants)

| Keyword | Effect |
|---|---|
| Flying | Can only be blocked by flying/reach |
| Reach | Can block flying |
| Trample | Excess combat damage past lethal goes to defending player/PW |
| Vigilance | Doesn't tap to attack |
| Haste | Can attack/tap the turn it enters |
| First strike | Deals combat damage in an earlier step |
| Double strike | Deals combat damage in both the first-strike and regular steps |
| Deathtouch | Any nonzero damage it deals is lethal |
| Lifelink | Controller gains life equal to damage dealt |
| Menace | Must be blocked by two or more creatures |
| Defender | Can't attack |
| Hexproof | Can't be the target of spells/abilities your opponents control |
| Ward N | Whenever targeted by an opponent, counter unless they pay N |
| Indestructible | Not destroyed by lethal damage or "destroy" effects |
| Flash | Can be cast any time you could cast an instant |
| Protection from X | Can't be targeted, blocked, dealt damage, or enchanted by X |
| Prowess | +1/+1 until end of turn whenever you cast a noncreature spell |
| Flashback / etc. | Alternative casting method from graveyard, see card text |

## 8. Mulligans

London mulligan: shuffle your hand into your library, draw 7 new cards,
then put N cards on the bottom of your library in any order, where N is
the number of mulligans you've taken so far. Both players decide mulligans
in turn order (starting player first) before turn 1 begins.

## 9. Winning / losing

A player loses if: life total is 0 or less, they're required to draw with
an empty library, they have 10+ poison counters, or an effect says so. The
game is a draw if all remaining players lose simultaneously. In this
2-player engine, the other player simply wins.

## 10. Adjudication order for the mtg-play skill

When resolving anything, check in this order:
1. Does a card's own Oracle text (`card_database.json`) explicitly override
   the general rule? Card text wins.
2. Does a keyword in section 7 apply?
3. Fall back to the general procedures in sections 1-6, 8-9 above.
4. If genuinely ambiguous even under real tournament rules, make the most
   commonly-accepted ruling, note it plainly in the game log, and keep
   playing — don't stall the game on a rules-lawyering tangent.
