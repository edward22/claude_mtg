"""Game state helpers for a two-player Magic: the Gathering game.

This module owns everything that needs *real* randomness -- shuffling,
drawing the top card of a library, coin flips -- because an LLM narrating
"I shuffle and reveal..." is not an acceptable substitute for an RNG. All
other game-state bookkeeping (moving cards between zones, tapping
permanents, adjusting life, resolving the stack, etc.) is expected to be
done directly by whoever is running the game (Claude, per the mtg-play
skill), editing games/<id>/game_state.json as a plain JSON file.

CLI usage (mutates games/<id>/game_state.json in place unless noted):

    python3 -m mtg_engine.state new-game <game_id> \\
        --user-deck decks/user.json --opponent-deck decks/opponent.json \\
        [--user-name "Edward"] [--opponent-name "Claude"]

    python3 -m mtg_engine.state mulligan <game_id> <player> \\
        --keep N        # London mulligan: shuffle hand back in, draw 7, bottom (mulligans_taken) cards
    python3 -m mtg_engine.state draw <game_id> <player> [--count N]
    python3 -m mtg_engine.state coinflip
    python3 -m mtg_engine.state shuffle-library <game_id> <player>
"""
import argparse
import json
import secrets
from pathlib import Path

GAMES_DIR = Path(__file__).resolve().parent.parent / "games"

ZONES = ("library", "hand", "battlefield", "graveyard", "exile", "command")


def _game_path(game_id: str) -> Path:
    return GAMES_DIR / game_id / "game_state.json"


def load_game(game_id: str) -> dict:
    return json.loads(_game_path(game_id).read_text(encoding="utf-8"))


def save_game(game_id: str, state: dict) -> None:
    path = _game_path(game_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def secure_shuffle(cards: list) -> list:
    """Fisher-Yates shuffle using the `secrets` CSPRNG (not Claude's 'judgment')."""
    deck = list(cards)
    for i in range(len(deck) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        deck[i], deck[j] = deck[j], deck[i]
    return deck


def coinflip() -> str:
    return "heads" if secrets.randbelow(2) == 0 else "tails"


def new_player_state(name: str, library: list) -> dict:
    return {
        "name": name,
        "life": 20,
        "poison": 0,
        "mulligans_taken": 0,
        "land_drops_used": 0,
        "library": list(library),
        "hand": [],
        "battlefield": [],
        "graveyard": [],
        "exile": [],
        "command": [],
        "mana_pool": {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0, "C": 0},
        "next_permanent_id": 1,
    }


def draw_n(player: dict, n: int) -> list:
    drawn = []
    for _ in range(n):
        if not player["library"]:
            break
        drawn.append(player["library"].pop(0))
    player["hand"].extend(drawn)
    return drawn


def new_game(game_id: str, user_deck: list, opponent_deck: list,
             user_name: str = "You", opponent_name: str = "Claude") -> dict:
    user = new_player_state(user_name, secure_shuffle(user_deck))
    opponent = new_player_state(opponent_name, secure_shuffle(opponent_deck))
    draw_n(user, 7)
    draw_n(opponent, 7)
    starting = "user" if coinflip() == "heads" else "opponent"
    state = {
        "game_id": game_id,
        "turn": 1,
        "active_player": starting,
        "phase": "beginning",
        "step": "upkeep",
        "priority": starting,
        "stack": [],
        "players": {"user": user, "opponent": opponent},
        "log": [f"{starting} won the coin flip and chooses to play first (pending mulligans)."],
    }
    save_game(game_id, state)
    return state


def mulligan(game_id: str, player_key: str, keep: int = None) -> dict:
    """London mulligan: shuffle hand back into library, draw a fresh 7,
    then the player must bottom `mulligans_taken` cards (that bookkeeping,
    i.e. *which* cards to bottom, is a game decision left to the caller --
    this just performs the shuffle-and-draw-7 part and increments the
    counter)."""
    state = load_game(game_id)
    player = state["players"][player_key]
    player["library"].extend(player["hand"])
    player["hand"] = []
    player["library"] = secure_shuffle(player["library"])
    player["mulligans_taken"] += 1
    draw_n(player, 7)
    state["log"].append(f"{player['name']} takes a mulligan (#{player['mulligans_taken']}), "
                         f"will bottom {player['mulligans_taken']} card(s).")
    save_game(game_id, state)
    return state


def draw(game_id: str, player_key: str, count: int = 1) -> dict:
    state = load_game(game_id)
    player = state["players"][player_key]
    drawn = draw_n(player, count)
    if len(drawn) < count:
        state["log"].append(f"{player['name']} attempted to draw {count} but the library is empty "
                             f"(drew {len(drawn)}) -- this is a loss condition, see rules_reference.md.")
    else:
        state["log"].append(f"{player['name']} draws {count} card(s).")
    save_game(game_id, state)
    return state


def shuffle_library(game_id: str, player_key: str) -> dict:
    state = load_game(game_id)
    player = state["players"][player_key]
    player["library"] = secure_shuffle(player["library"])
    state["log"].append(f"{player['name']}'s library is shuffled.")
    save_game(game_id, state)
    return state


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_new = sub.add_parser("new-game")
    p_new.add_argument("game_id")
    p_new.add_argument("--user-deck", required=True, help="Path to parsed deck JSON for the user")
    p_new.add_argument("--opponent-deck", required=True, help="Path to parsed deck JSON for the opponent")
    p_new.add_argument("--user-name", default="You")
    p_new.add_argument("--opponent-name", default="Claude")
    p_new.add_argument("--include-sideboard", action="store_true")

    p_mull = sub.add_parser("mulligan")
    p_mull.add_argument("game_id")
    p_mull.add_argument("player", choices=["user", "opponent"])

    p_draw = sub.add_parser("draw")
    p_draw.add_argument("game_id")
    p_draw.add_argument("player", choices=["user", "opponent"])
    p_draw.add_argument("--count", type=int, default=1)

    p_shuf = sub.add_parser("shuffle-library")
    p_shuf.add_argument("game_id")
    p_shuf.add_argument("player", choices=["user", "opponent"])

    sub.add_parser("coinflip")

    args = ap.parse_args()

    if args.cmd == "new-game":
        from . import deck_parser
        user_sections = json.loads(Path(args.user_deck).read_text())["sections"]
        opp_sections = json.loads(Path(args.opponent_deck).read_text())["sections"]
        user_lib = deck_parser.expand_to_library(user_sections, args.include_sideboard)
        opp_lib = deck_parser.expand_to_library(opp_sections, args.include_sideboard)
        state = new_game(args.game_id, user_lib, opp_lib, args.user_name, args.opponent_name)
        print(json.dumps({"game_id": args.game_id, "active_player": state["active_player"],
                           "user_hand": state["players"]["user"]["hand"],
                           "opponent_hand": state["players"]["opponent"]["hand"]}, indent=2))
    elif args.cmd == "mulligan":
        state = mulligan(args.game_id, args.player)
        print(json.dumps({"hand": state["players"][args.player]["hand"],
                           "mulligans_taken": state["players"][args.player]["mulligans_taken"]}, indent=2))
    elif args.cmd == "draw":
        state = draw(args.game_id, args.player, args.count)
        print(json.dumps({"hand": state["players"][args.player]["hand"]}, indent=2))
    elif args.cmd == "shuffle-library":
        shuffle_library(args.game_id, args.player)
        print("shuffled")
    elif args.cmd == "coinflip":
        print(coinflip())


if __name__ == "__main__":
    main()
