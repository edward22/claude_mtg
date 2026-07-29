"""Render a game_state.json (+ card_database.json) into a self-contained
MTGA-style HTML board fragment, suitable for the Claude Artifact tool.

Deliberately produces only body-level markup (no <!DOCTYPE>/<html>/<head>/
<body>) per the Artifact tool's contract -- it gets wrapped automatically.

CLI usage:
    python3 -m mtg_engine.render <game_id> [-o games/<game_id>/board.html]
"""
import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "games"
CARD_DB_PATH = ROOT / "card_database.json"

PIP_RE = re.compile(r"\{([^}]+)\}")

PIP_COLORS = {
    "W": ("#f8f4e3", "#3a3424"),
    "U": ("#0e68ab", "#ffffff"),
    "B": ("#150b00", "#e0d9c8"),
    "R": ("#d3202a", "#ffffff"),
    "G": ("#00733e", "#ffffff"),
    "C": ("#ccd0d6", "#2a2a2a"),
}

COLOR_BORDER = {
    "W": "#d8cfa0", "U": "#3d7fc1", "B": "#4a4a4a",
    "R": "#c94a4a", "G": "#3f9e5f", "C": "#9aa0a6",
}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def render_pip(symbol: str) -> str:
    sym = symbol.upper()
    if sym.isdigit() or sym in ("X", "Y", "Z"):
        bg, fg = PIP_COLORS["C"]
        label = sym
    elif "/" in sym:
        # hybrid or Phyrexian mana - just show the first real color letter
        letters = [c for c in sym.split("/") if c in PIP_COLORS]
        bg, fg = PIP_COLORS[letters[0]] if letters else PIP_COLORS["C"]
        label = sym.replace("/", "")
    elif sym in PIP_COLORS:
        bg, fg = PIP_COLORS[sym]
        label = sym
    else:
        bg, fg = PIP_COLORS["C"]
        label = sym[:2]
    return (f'<span class="pip" style="background:{bg};color:{fg};" '
            f'title="{html.escape(symbol)}">{html.escape(label)}</span>')


def render_mana_cost(cost: str) -> str:
    if not cost:
        return ""
    pips = PIP_RE.findall(cost)
    return '<span class="mana-cost">' + "".join(render_pip(p) for p in pips) + "</span>"


def color_border(colors) -> str:
    if not colors:
        return "#7a7a7a"
    if len(colors) > 1:
        return "#b8952f"
    return COLOR_BORDER.get(colors[0], "#7a7a7a")


def card_face(name: str, card_db: dict) -> dict:
    return card_db.get(name, {"name": name, "mana_cost": "", "type_line": "", "colors": [],
                               "power": None, "toughness": None, "loyalty": None,
                               "oracle_text": "", "unverified": True})


def render_permanent(perm: dict, card_db: dict) -> str:
    face = card_face(perm["name"], card_db)
    colors = face.get("colors", [])
    border = color_border(colors)
    classes = ["card", "permanent"]
    if perm.get("tapped"):
        classes.append("tapped")
    if perm.get("summoning_sick"):
        classes.append("sick")
    pt = ""
    dmg = perm.get("damage", 0)
    if face.get("power") is not None and face.get("toughness") is not None:
        toughness_left = f"{face['toughness']}"
        if dmg:
            toughness_left = f"{face['toughness']}-{dmg}"
        pt = f'<span class="pt">{html.escape(str(face["power"]))}/{html.escape(str(toughness_left))}</span>'
    elif face.get("loyalty") is not None:
        loyalty = perm.get("loyalty", face.get("loyalty"))
        pt = f'<span class="pt loyalty">{html.escape(str(loyalty))}</span>'
    counters = perm.get("counters") or {}
    counter_badges = "".join(
        f'<span class="counter">{html.escape(str(v))}{html.escape(k)}</span>' for k, v in counters.items()
    )
    tags = ""
    if perm.get("attachments"):
        tags += "".join(f'<span class="tag">+{html.escape(a)}</span>' for a in perm["attachments"])
    title = html.escape(face.get("oracle_text", "") or "")
    return (
        f'<div class="{" ".join(classes)}" style="border-color:{border}" title="{title}">'
        f'<div class="card-name">{html.escape(perm["name"])}</div>'
        f'{pt}{counter_badges}{tags}'
        f'</div>'
    )


def render_hand_card(name: str, card_db: dict) -> str:
    face = card_face(name, card_db)
    border = color_border(face.get("colors", []))
    pt = ""
    if face.get("power") is not None and face.get("toughness") is not None:
        pt = f'<span class="pt">{html.escape(str(face["power"]))}/{html.escape(str(face["toughness"]))}</span>'
    unverified = ' <span class="unverified" title="Card text not yet confirmed">?</span>' if face.get("unverified") else ""
    return (
        f'<div class="card hand-card" style="border-color:{border}" title="{html.escape(face.get("oracle_text","") or "")}">'
        f'<div class="card-top"><span class="card-name">{html.escape(name)}{unverified}</span>'
        f'{render_mana_cost(face.get("mana_cost",""))}</div>'
        f'<div class="type-line">{html.escape(face.get("type_line",""))}</div>'
        f'{pt}'
        f'</div>'
    )


def render_stack(stack: list, card_db: dict) -> str:
    if not stack:
        return '<div class="stack-empty">Stack empty</div>'
    items = []
    for item in reversed(stack):  # top of stack resolves first -> show first
        desc = html.escape(item.get("description", item.get("name", "?")))
        items.append(f'<div class="stack-item">{desc}</div>')
    return "".join(items)


def render_zone_counts(player: dict) -> str:
    return (
        f'<div class="zone-count" title="Library">📚 {len(player["library"])}</div>'
        f'<div class="zone-count" title="Graveyard">🪦 {len(player["graveyard"])}</div>'
        f'<div class="zone-count" title="Exile">🌀 {len(player["exile"])}</div>'
    )


def render_battlefield(player: dict, card_db: dict) -> str:
    land_ids = {p["id"] for p in player["battlefield"] if "Land" in card_face(p["name"], card_db).get("type_line", "")}
    lands = [p for p in player["battlefield"] if p["id"] in land_ids]
    others = [p for p in player["battlefield"] if p["id"] not in land_ids]
    parts = []
    if others:
        parts.append('<div class="bf-row">' + "".join(render_permanent(p, card_db) for p in others) + '</div>')
    if lands:
        parts.append('<div class="bf-row lands">' + "".join(render_permanent(p, card_db) for p in lands) + '</div>')
    if not parts:
        parts.append('<div class="bf-row empty">—</div>')
    return "".join(parts)


def render_reference_card(name: str, card_db: dict) -> str:
    face = card_face(name, card_db)
    border = color_border(face.get("colors", []))
    pt = ""
    if face.get("power") is not None and face.get("toughness") is not None:
        pt = f'<span class="ref-pt">{html.escape(str(face["power"]))}/{html.escape(str(face["toughness"]))}</span>'
    elif face.get("loyalty") is not None:
        pt = f'<span class="ref-pt">Loyalty {html.escape(str(face["loyalty"]))}</span>'
    unverified = (' <span class="unverified" title="Wording not confirmed against an official source">'
                  '(unverified text)</span>') if face.get("unverified") else ""
    text = html.escape(face.get("oracle_text", "") or "").replace("\n", "<br>")
    return (
        '<div class="ref-card" style="border-left-color:' + border + '">'
        f'<div class="ref-head"><span class="ref-name">{html.escape(name)}</span>'
        f'{render_mana_cost(face.get("mana_cost",""))}</div>'
        f'<div class="ref-type">{html.escape(face.get("type_line",""))}{pt}</div>'
        f'<div class="ref-text">{text}{unverified}</div>'
        '</div>'
    )


def render_reference(state: dict, card_db: dict) -> str:
    """Full oracle text for every card currently in a *public* zone: the
    user's own hand, and both players' battlefields. Never includes the
    opponent's hand (hidden information)."""
    user = state["players"]["user"]
    opp = state["players"]["opponent"]
    names = set(user["hand"])
    names.update(p["name"] for p in user["battlefield"])
    names.update(p["name"] for p in opp["battlefield"])
    if not names:
        return '<div class="ref-empty">No cards in play or in hand yet.</div>'
    return "".join(render_reference_card(n, card_db) for n in sorted(names))


def render_board(game_id: str) -> str:
    state = load_json(GAMES_DIR / game_id / "game_state.json")
    card_db = load_json(CARD_DB_PATH)
    user = state["players"]["user"]
    opp = state["players"]["opponent"]

    opp_hand_backs = "".join('<div class="card hand-back"></div>' for _ in opp["hand"])
    user_hand = "".join(render_hand_card(n, card_db) for n in user["hand"])

    html_out = f"""
<style>
  :root {{ color-scheme: light dark; }}
  .mtg-board {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 1100px; margin: 0 auto;
    background: radial-gradient(ellipse at center, #14342a 0%, #0b1f19 100%); color: #eee; border-radius: 12px;
    padding: 14px; box-sizing: border-box; }}
  :root[data-theme="light"] .mtg-board {{ background: radial-gradient(ellipse at center, #dfe9e2 0%, #cfe3d6 100%); color: #111; }}
  @media (prefers-color-scheme: light) {{ .mtg-board {{ background: radial-gradient(ellipse at center, #dfe9e2 0%, #cfe3d6 100%); color: #111; }} }}
  .mtg-board * {{ box-sizing: border-box; }}
  .topbar {{ display:flex; justify-content:space-between; align-items:center; padding:4px 10px; margin-bottom:8px;
    background: rgba(0,0,0,0.25); border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: .3px; }}
  .player-row {{ display:flex; align-items:flex-start; gap:10px; padding:6px; }}
  .player-info {{ display:flex; flex-direction:column; align-items:center; gap:4px; min-width:70px; }}
  .player-name {{ font-size:12px; opacity:.85; font-weight:600; }}
  .life {{ font-size:28px; font-weight:700; color:#ffd86b; text-shadow:0 1px 2px rgba(0,0,0,.6); }}
  .zone-counts {{ display:flex; gap:6px; font-size:12px; opacity:.9; }}
  .zone-count {{ background: rgba(0,0,0,.3); border-radius:6px; padding:2px 6px; }}
  .battlefield {{ flex:1; min-width:0; overflow-x:auto; }}
  .bf-row {{ display:flex; flex-wrap:wrap; gap:6px; min-height:74px; padding:4px; }}
  .bf-row.lands {{ min-height:60px; opacity:.95; }}
  .bf-row.empty {{ align-items:center; justify-content:center; opacity:.4; font-size:12px; }}
  .card {{ background: linear-gradient(160deg,#2b2b2b,#1a1a1a); border:2px solid #7a7a7a; border-radius:8px;
    padding:4px 6px; font-size:11px; min-width:64px; max-width:110px; position:relative; color:#f2f2f2; }}
  .card.permanent {{ min-height:60px; }}
  .card.tapped {{ transform: rotate(20deg); opacity:.85; }}
  .card.sick {{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.15); }}
  .card-name {{ font-weight:600; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
  .card-top {{ display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }}
  .type-line {{ opacity:.7; font-size:10px; margin-top:2px; }}
  .pt {{ position:absolute; bottom:3px; right:4px; background:rgba(0,0,0,.55); border-radius:4px; padding:0 4px; font-weight:700; }}
  .pt.loyalty {{ background:#5a2d82; }}
  .counter {{ display:inline-block; background:#3a6ea5; border-radius:50%; font-size:9px; padding:1px 4px; margin-right:2px; }}
  .tag {{ display:block; font-size:9px; opacity:.75; }}
  .unverified {{ color:#ffb84d; font-weight:700; cursor:help; }}
  .mana-cost .pip {{ display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px;
    border-radius:50%; font-size:9px; font-weight:700; margin-left:1px; }}
  .hand {{ display:flex; gap:6px; flex-wrap:wrap; padding:6px; min-height:70px; }}
  .hand-card {{ min-width:78px; }}
  .hand-back {{ width:46px; height:64px; background: repeating-linear-gradient(45deg,#3a2b52,#3a2b52 4px,#2a1d3d 4px,#2a1d3d 8px);
    border-radius:6px; border:2px solid #5a4a7a; }}
  .stack-col {{ min-width:150px; max-width:220px; background: rgba(0,0,0,.25); border-radius:8px; padding:6px; font-size:11px; }}
  .stack-col h4 {{ margin:2px 0 6px; font-size:11px; text-transform:uppercase; opacity:.7; }}
  .stack-item {{ background: rgba(255,255,255,.08); border-radius:6px; padding:4px 6px; margin-bottom:4px; }}
  .stack-empty {{ opacity:.4; font-style:italic; }}
  .mid-row {{ display:flex; gap:10px; align-items:flex-start; }}
  .log {{ margin-top:8px; background: rgba(0,0,0,.25); border-radius:8px; padding:6px 10px; font-size:11px; max-height:120px; overflow-y:auto; }}
  .log div {{ opacity:.85; padding:1px 0; }}
  .reference {{ margin-top:10px; background: rgba(0,0,0,.2); border-radius:8px; padding:8px 10px; }}
  .reference h4 {{ margin:0 0 8px; font-size:11px; text-transform:uppercase; opacity:.7; letter-spacing:.5px; }}
  .ref-grid {{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:8px; }}
  .ref-card {{ background: rgba(255,255,255,.06); border-left:3px solid #7a7a7a; border-radius:4px; padding:6px 8px; font-size:11px; }}
  .ref-head {{ display:flex; justify-content:space-between; align-items:baseline; gap:6px; font-weight:600; }}
  .ref-type {{ opacity:.7; font-size:10px; margin:2px 0 4px; display:flex; justify-content:space-between; }}
  .ref-pt {{ font-weight:700; opacity:1; }}
  .ref-text {{ line-height:1.4; }}
  .ref-empty {{ opacity:.5; font-style:italic; font-size:12px; }}
</style>
<div class="mtg-board">
  <div class="topbar">
    <span>Turn {state['turn']} — {html.escape(state['active_player'])}'s turn</span>
    <span>{html.escape(state['phase'])} / {html.escape(state['step'])}</span>
    <span>Priority: {html.escape(state['priority'])}</span>
  </div>

  <div class="player-row">
    <div class="player-info">
      <div class="player-name">{html.escape(opp['name'])}</div>
      <div class="life">{opp['life']}</div>
      <div class="zone-counts">{render_zone_counts(opp)}</div>
    </div>
    <div class="battlefield">{render_battlefield(opp, card_db)}</div>
  </div>
  <div class="hand" title="Opponent hand (face down)">{opp_hand_backs}</div>

  <div class="mid-row">
    <div style="flex:1"></div>
    <div class="stack-col"><h4>Stack (top resolves first)</h4>{render_stack(state['stack'], card_db)}</div>
    <div style="flex:1"></div>
  </div>

  <div class="hand">{user_hand}</div>
  <div class="player-row">
    <div class="player-info">
      <div class="player-name">{html.escape(user['name'])}</div>
      <div class="life">{user['life']}</div>
      <div class="zone-counts">{render_zone_counts(user)}</div>
    </div>
    <div class="battlefield">{render_battlefield(user, card_db)}</div>
  </div>

  <div class="log">
    {"".join(f"<div>{html.escape(l)}</div>" for l in state.get('log', [])[-12:])}
  </div>

  <div class="reference">
    <h4>Card reference (full text for everything in play or in your hand)</h4>
    <div class="ref-grid">{render_reference(state, card_db)}</div>
  </div>
</div>
""".strip()
    return html_out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("game_id")
    ap.add_argument("-o", "--output", help="Output HTML path (default games/<game_id>/board.html)")
    args = ap.parse_args()
    out_path = Path(args.output) if args.output else GAMES_DIR / args.game_id / "board.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_board(args.game_id), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
