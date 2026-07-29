"""Parse MTG Arena (MTGA) deck export text into structured JSON.

MTGA export format looks like:

    Deck
    1 Lightning Bolt (LEA) 161
    4 Mountain (M21) 269

    Sideboard
    2 Abrade (M20) 128

Set code / collector number suffixes are optional; plain "<count> <name>"
lines are also accepted. Section headers are case-insensitive and optional
-- a file with no headers is treated as entirely "Deck" (mainboard).
"""
import argparse
import json
import re
import sys
from pathlib import Path

SECTION_HEADERS = {
    "deck": "deck",
    "mainboard": "deck",
    "main": "deck",
    "sideboard": "sideboard",
    "commander": "commander",
    "companion": "companion",
}

# "4 Mountain (M21) 269" / "4 Mountain (M21) 269 *E*" / "1 Lightning Bolt"
LINE_RE = re.compile(
    r"^(?P<count>\d+)\s+(?P<name>.+?)"
    r"(?:\s+\([A-Za-z0-9]{2,6}\)\s+\S+)?"
    r"(?:\s+\*[A-Za-z]\*)?"
    r"\s*$"
)


def parse_deck_text(text: str) -> dict:
    sections = {"deck": [], "sideboard": [], "commander": [], "companion": []}
    current = "deck"
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        header = SECTION_HEADERS.get(line.lower())
        if header:
            current = header
            continue
        if line.lower().startswith("about") or line.startswith("//"):
            continue
        m = LINE_RE.match(line)
        if not m:
            # Not a recognized card line (e.g. stray metadata) -- skip.
            continue
        count = int(m.group("count"))
        name = m.group("name").strip()
        sections[current].append({"count": count, "name": name})
    return sections


def card_names(sections: dict) -> list:
    """All unique card names across every section, sorted."""
    names = set()
    for cards in sections.values():
        for c in cards:
            names.add(c["name"])
    return sorted(names)


def expand_to_library(sections: dict, include_sideboard: bool = False) -> list:
    """Flatten the 'deck' (and optionally sideboard) section into one card
    per copy, e.g. [{"count":4,"name":"Mountain"}] -> ["Mountain"]*4."""
    library = []
    keys = ["deck", "commander"] if not include_sideboard else ["deck", "commander", "sideboard"]
    for key in keys:
        for c in sections.get(key, []):
            library.extend([c["name"]] * c["count"])
    return library


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("deck_file", help="Path to an MTGA export .txt file")
    ap.add_argument("-o", "--output", help="Write parsed JSON here instead of stdout")
    args = ap.parse_args()

    text = Path(args.deck_file).read_text(encoding="utf-8")
    sections = parse_deck_text(text)
    total = sum(c["count"] for c in sections["deck"]) + sum(c["count"] for c in sections["commander"])
    result = {
        "source_file": str(args.deck_file),
        "mainboard_count": total,
        "sections": sections,
        "unique_card_names": card_names(sections),
    }
    out = json.dumps(result, indent=2)
    if args.output:
        Path(args.output).write_text(out + "\n", encoding="utf-8")
    else:
        print(out)


if __name__ == "__main__":
    main()
