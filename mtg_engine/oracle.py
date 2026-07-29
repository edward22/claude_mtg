"""Authoritative card-text lookups against a local Scryfall "Oracle Cards"
bulk data dump (a gzipped JSONL file, one card object per line), so
card_database.json can be filled in from a real source instead of guesswork
-- this environment has no network access to query Scryfall live.

Drop a fresh dump at the repo root as `oracle-cards-*.jsonl.gz` (get one
from https://scryfall.com/docs/api/bulk-data, "Oracle Cards") and this
module picks the most recent one by filename automatically.

CLI usage:
    python3 -m mtg_engine.oracle lookup "Lightning Bolt" "Delver of Secrets"
    python3 -m mtg_engine.oracle merge decks/mydeck.json
"""
import argparse
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARD_DB_PATH = ROOT / "card_database.json"


def find_oracle_file() -> Path:
    candidates = sorted(ROOT.glob("oracle-cards-*.jsonl.gz"))
    if not candidates:
        raise FileNotFoundError(
            "No oracle-cards-*.jsonl.gz found at repo root. Get one from "
            "https://scryfall.com/docs/api/bulk-data (the 'Oracle Cards' bulk file)."
        )
    return candidates[-1]  # filenames embed a timestamp, so latest sorts last


def _face_data(rec: dict, idx):
    faces = rec.get("card_faces") or []
    if idx is None:
        return {
            "mana_cost": rec.get("mana_cost") or "",
            "type_line": rec.get("type_line") or "",
            "oracle_text": rec.get("oracle_text") or "",
            "power": rec.get("power"),
            "toughness": rec.get("toughness"),
            "colors": rec.get("colors") or [],
        }
    face = faces[idx]
    return {
        "mana_cost": face.get("mana_cost") or "",
        "type_line": face.get("type_line") or "",
        "oracle_text": face.get("oracle_text") or "",
        "power": face.get("power"),
        "toughness": face.get("toughness"),
        "colors": face.get("colors") or rec.get("colors") or [],
    }


def _clean_cmc(cmc):
    if isinstance(cmc, (int, float)) and float(cmc).is_integer():
        return int(cmc)
    return cmc


def to_entry(rec: dict, face_index=None) -> dict:
    """Convert one Scryfall card record (optionally a specific face of a
    double-faced/split card) into this repo's card_database.json shape."""
    faces = rec.get("card_faces") or []
    use_face = face_index
    if use_face is None and not rec.get("mana_cost") and faces:
        use_face = 0  # DFC/meld looked up by its combined "Front // Back" name
    front = _face_data(rec, use_face)
    name = faces[use_face]["name"] if (use_face is not None and faces) else rec.get("name")
    loyalty = rec.get("loyalty")
    if use_face is not None and faces:
        loyalty = faces[use_face].get("loyalty", loyalty)

    entry = {
        "name": name,
        "mana_cost": front["mana_cost"],
        "cmc": _clean_cmc(rec.get("cmc")),
        "colors": front["colors"],
        "type_line": front["type_line"],
        "power": front["power"],
        "toughness": front["toughness"],
        "loyalty": loyalty,
        "keywords": rec.get("keywords") or [],
        "oracle_text": front["oracle_text"],
    }
    if len(faces) > 1:
        other_idx = 1 if use_face in (0, None) else 0
        other = faces[other_idx]
        entry["back_face"] = {
            "name": other.get("name"),
            "mana_cost": other.get("mana_cost") or "",
            "type_line": other.get("type_line") or "",
            "oracle_text": other.get("oracle_text") or "",
            "power": other.get("power"),
            "toughness": other.get("toughness"),
            "colors": other.get("colors") or [],
        }
    return entry


# Non-gameplay/collectible layouts that reuse real card names as a face
# name (double-sided art cards, tokens, etc.) -- never trust a face-name
# match against one of these, only an exact top-level name match.
_NON_CARD_LAYOUTS = {"art_series", "token", "double_faced_token", "emblem",
                     "vanguard", "scheme", "planar"}


def lookup_cards(names, oracle_path: Path = None) -> dict:
    """Look up each of `names` (exact card name, case-insensitive) against
    the bulk dump. Two passes: first an exact top-level name match (the
    overwhelmingly common case), then -- only for names still unmatched --
    a fallback search through card_faces for double-faced/meld cards,
    skipping non-gameplay layouts (art cards, tokens) that reuse real card
    names for a face. Returns {original_name: card_database_entry}; names
    absent from the dump are simply absent from the result."""
    path = oracle_path or find_oracle_file()
    wanted = {n.strip().lower(): n for n in names}
    found = {}

    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if not wanted:
                break
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            key = (rec.get("name") or "").lower()
            if key in wanted:
                original = wanted.pop(key)
                found[original] = to_entry(rec)

    if not wanted:
        return found

    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if not wanted:
                break
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if rec.get("layout") in _NON_CARD_LAYOUTS:
                continue
            for i, face in enumerate(rec.get("card_faces") or []):
                fkey = (face.get("name") or "").lower()
                if fkey in wanted:
                    original = wanted.pop(fkey)
                    found[original] = to_entry(rec, face_index=i)

    return found


def merge_into_card_database(names, oracle_path: Path = None) -> dict:
    """Look up `names` and merge any matches into card_database.json.
    Returns {"found": [...names...], "missing": [...names...]}."""
    db = {}
    if CARD_DB_PATH.exists():
        db = json.loads(CARD_DB_PATH.read_text(encoding="utf-8"))
    found = lookup_cards(names, oracle_path)
    for name, entry in found.items():
        db[name] = entry
    CARD_DB_PATH.write_text(json.dumps(db, indent=2) + "\n", encoding="utf-8")
    missing = [n for n in names if n not in found]
    return {"found": sorted(found.keys()), "missing": sorted(missing)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_lookup = sub.add_parser("lookup", help="Print matching card_database.json entries as JSON (does not write anything)")
    p_lookup.add_argument("names", nargs="+")

    p_merge = sub.add_parser("merge", help="Look up every unique_card_names entry in a parsed deck JSON and merge into card_database.json")
    p_merge.add_argument("deck_json", help="Path to a deck JSON produced by mtg_engine.deck_parser")

    p_merge_names = sub.add_parser("merge-names", help="Look up specific card names and merge into card_database.json")
    p_merge_names.add_argument("names", nargs="+")

    args = ap.parse_args()

    if args.cmd == "lookup":
        result = lookup_cards(args.names)
        print(json.dumps(result, indent=2))
    elif args.cmd == "merge":
        names = json.loads(Path(args.deck_json).read_text())["unique_card_names"]
        print(json.dumps(merge_into_card_database(names), indent=2))
    elif args.cmd == "merge-names":
        print(json.dumps(merge_into_card_database(args.names), indent=2))


if __name__ == "__main__":
    main()
