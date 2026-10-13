"""Tennessee county registry: the one place a county's identity lives.

Every record the county pull writes carries (county, fips) taken from here,
never typed in at a call site, so a county can't be misspelled into a second
county. Davidson (47037) is Metro Nashville: its records predate this module
and live in the legacy data/*.jsonl files; `legacy: true` on its registry row
is how readers know to take it from there rather than from data/counties/.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COUNTIES_DIR = ROOT / "data" / "counties"
REGISTRY = COUNTIES_DIR / "registry.json"

# Census order (Mc* sorts before Mac*). FIPS = 47000 + 1 + 2*index.
NAMES = [
    "Anderson", "Bedford", "Benton", "Bledsoe", "Blount", "Bradley", "Campbell", "Cannon",
    "Carroll", "Carter", "Cheatham", "Chester", "Claiborne", "Clay", "Cocke", "Coffee",
    "Crockett", "Cumberland", "Davidson", "Decatur", "DeKalb", "Dickson", "Dyer", "Fayette",
    "Fentress", "Franklin", "Gibson", "Giles", "Grainger", "Greene", "Grundy", "Hamblen",
    "Hamilton", "Hancock", "Hardeman", "Hardin", "Hawkins", "Haywood", "Henderson", "Henry",
    "Hickman", "Houston", "Humphreys", "Jackson", "Jefferson", "Johnson", "Knox", "Lake",
    "Lauderdale", "Lawrence", "Lewis", "Lincoln", "Loudon", "McMinn", "McNairy", "Macon",
    "Madison", "Marion", "Marshall", "Maury", "Meigs", "Monroe", "Montgomery", "Moore",
    "Morgan", "Obion", "Overton", "Perry", "Pickett", "Polk", "Putnam", "Rhea", "Roane",
    "Robertson", "Rutherford", "Scott", "Sequatchie", "Sevier", "Shelby", "Smith", "Stewart",
    "Sullivan", "Sumner", "Tipton", "Trousdale", "Unicoi", "Union", "Van Buren", "Warren",
    "Washington", "Wayne", "Weakley", "White", "Williamson", "Wilson",
]
assert len(NAMES) == 95


def slug_of(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fips_of(name: str) -> str:
    return str(47000 + 1 + 2 * NAMES.index(name))


def canonical(raw: str) -> str:
    """Sheet label -> canonical county name ('Davidson (Metro Nashville)' -> 'Davidson')."""
    base = re.sub(r"\(.*?\)", "", raw).replace(" County", "").strip()
    for n in NAMES:
        if n.lower() == base.lower():
            return n
    raise KeyError(f"not a Tennessee county: {raw!r}")


def load() -> list[dict]:
    return json.loads(REGISTRY.read_text())["counties"]


def by_slug() -> dict[str, dict]:
    return {c["slug"]: c for c in load()}
