"""Outfit algorithm: pick a coherent outfit from the closet, optionally for a dress code / season.

Deterministic and dependency-free (no LLM call), so it is fast and testable.

How it works:
1. Profile every item. Formality, warmth and "busy pattern" are inferred from the free-text
   description via weighted keyword lexicons; colours are resolved to a fixed palette.
2. Score each item against the criteria (dress code -> formality range, season -> target warmth).
3. Shortlist the best few items per category (with a little jitter so results vary), then
   score every top x bottom x shoes x outerwear x accessory combination on colour harmony,
   criteria fit and formality coherence.
4. Sample from the best-scoring outfits (softmax) instead of always returning the single
   winner, so "generate" keeps producing fresh looks.
"""

import asyncio
import itertools
import math
import random
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal, Sequence

from app.data.models import ItemRecord, OutfitCreate

DressCode = Literal["casual", "smart casual", "business", "formal", "athletic"]
Season = Literal["spring", "summer", "fall", "winter"]

# --------------------------------------------------------------------------- criteria

DRESS_CODE_ALIASES: dict[str, DressCode] = {
    "casual": "casual", "everyday": "casual", "relaxed": "casual", "weekend": "casual",
    "smart casual": "smart casual", "business casual": "smart casual", "date night": "smart casual",
    "business": "business", "work": "business", "office": "business", "professional": "business",
    "formal": "formal", "black tie": "formal", "dressy": "formal", "cocktail": "formal", "wedding": "formal",
    "athletic": "athletic", "gym": "athletic", "sport": "athletic", "sports": "athletic", "workout": "athletic",
}
SEASON_ALIASES: dict[str, Season] = {
    "spring": "spring", "summer": "summer", "fall": "fall", "autumn": "fall", "winter": "winter",
}

# Acceptable formality band (0 = very casual, 1 = black tie) for each dress code.
DRESS_RANGES: dict[str, tuple[float, float]] = {
    "athletic": (0.0, 0.30),
    "casual": (0.15, 0.45),
    "smart casual": (0.40, 0.65),
    "business": (0.60, 0.85),
    "formal": (0.80, 1.00),
}
# Target warmth (0 = very light, 1 = very heavy) for each season.
SEASON_WARMTH: dict[str, float] = {"summer": 0.15, "spring": 0.40, "fall": 0.60, "winter": 0.90}


def _normalize(value: str | None, aliases: dict, label: str):
    if value is None:
        return None
    key = re.sub(r"[\s_-]+", " ", value.strip().lower())
    if key not in aliases:
        raise ValueError(f"Unknown {label} {value!r}. Choose from: {', '.join(sorted(set(aliases.values())))}")
    return aliases[key]


# --------------------------------------------------------------------------- lexicons


def _compile(weights: dict[str, float]) -> list[tuple[re.Pattern, float]]:
    # Whole-word match with optional plural, so "suit" does not hit "swimsuit".
    return [(re.compile(rf"(?<![a-z]){re.escape(k)}s?(?![a-z])"), w) for k, w in weights.items()]


# Offsets from a neutral 0.4 formality.
FORMALITY = _compile({
    "tuxedo": 0.5, "suit": 0.4, "blazer": 0.3, "dress shirt": 0.35, "dress pants": 0.35, "slacks": 0.3,
    "trouser": 0.3, "tailored": 0.25, "oxford": 0.25, "derby": 0.25, "brogue": 0.25, "heel": 0.25,
    "pump": 0.25, "overcoat": 0.25, "loafer": 0.2, "silk": 0.2, "satin": 0.2, "trench": 0.2,
    "button-down": 0.2, "button down": 0.2, "button-up": 0.15, "button up": 0.15, "collared": 0.15,
    "chino": 0.15, "bow tie": 0.2, "necktie": 0.2,
    "sweatpants": -0.35, "joggers": -0.3, "crocs": -0.3, "flip-flops": -0.3, "hoodie": -0.25,
    "sweatshirt": -0.25, "t-shirt": -0.2, "tee": -0.2, "tank": -0.2, "shorts": -0.2, "graphic": -0.2,
    "anime": -0.2, "ripped": -0.2, "distressed": -0.15, "sneaker": -0.15, "jeans": -0.1, "denim": -0.1,
    "flannel": -0.1, "cargo": -0.1, "sandal": -0.1, "logo": -0.1,
})
ATHLETIC = _compile({
    "athletic": 1, "gym": 1, "running": 1, "sport": 1, "track": 1, "jersey": 1, "legging": 1,
    "performance": 1, "workout": 1, "activewear": 1, "training": 1, "trainer": 1, "dri-fit": 1,
    "moisture-wicking": 1, "joggers": 1, "sweatpants": 1, "sneaker": 1, "running shoe": 1,
})
# Offsets from a per-category base warmth.
WARMTH = _compile({
    "puffer": 0.4, "parka": 0.4, "down jacket": 0.4, "scarf": 0.4, "beanie": 0.4, "glove": 0.4,
    "fleece": 0.3, "thermal": 0.3, "insulated": 0.3, "wool": 0.25, "sweater": 0.25, "boot": 0.25,
    "overcoat": 0.25, "turtleneck": 0.2, "cashmere": 0.2, "heavy": 0.2, "thick": 0.2, "coat": 0.2,
    "knit": 0.15, "flannel": 0.15, "corduroy": 0.15, "hoodie": 0.15, "sweatshirt": 0.15,
    "long-sleeve": 0.1, "long sleeve": 0.1, "lined": 0.1,
    "flip-flops": -0.35, "sandal": -0.35, "linen": -0.3, "tank": -0.3, "sleeveless": -0.3,
    "shorts": -0.3, "sundress": -0.3, "lightweight": -0.25, "breathable": -0.2, "sunglasses": -0.2,
    "straw": -0.2, "swim": -0.2, "short-sleeve": -0.15, "short sleeve": -0.15, "crop": -0.15,
    "mesh": -0.15, "t-shirt": -0.1,
})
BUSY = _compile({
    "plaid": 1, "tartan": 1, "striped": 1, "stripe": 1, "floral": 1, "polka": 1, "graphic": 1,
    "print": 1, "printed": 1, "checkered": 1, "gingham": 1, "houndstooth": 1, "argyle": 1,
    "paisley": 1, "camo": 1, "camouflage": 1, "leopard": 1, "tie-dye": 1, "sequin": 1, "anime": 1,
})
BASE_WARMTH = {"top": 0.45, "bottom": 0.5, "outerwear": 0.7, "shoes": 0.5, "accessory": 0.4}

# --------------------------------------------------------------------------- colour

NEUTRALS = {"black", "white", "gray", "beige", "cream", "tan", "navy", "brown", "silver"}
HUES = {
    "red": 0, "orange": 30, "gold": 45, "yellow": 55, "olive": 75, "green": 130, "teal": 175,
    "light blue": 200, "blue": 220, "purple": 280, "pink": 330, "burgundy": 345,
}
KNOWN_COLORS = NEUTRALS | set(HUES) | {"multicolor"}
_COLOR_PATTERNS = {c: re.compile(rf"\b{re.escape(c)}\b") for c in KNOWN_COLORS}


def _resolve_color(raw: str | None) -> str | None:
    """Map free text ("dark navy blue") onto the known palette; earliest, longest match wins."""
    if not raw:
        return None
    text = raw.strip().lower().replace("grey", "gray")
    hits = [(m.start(), -len(c), c) for c, p in _COLOR_PATTERNS.items() if (m := p.search(text))]
    return min(hits)[2] if hits else None


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _offset(text: str, lexicon: list[tuple[re.Pattern, float]]) -> float:
    """Sum matched keyword weights with diminishing returns (1, 1/2, 1/4, ...) per sign,
    so stacked cues ("tailored dress shirt, button-down") don't instantly saturate the scale."""
    hits = [w for pattern, w in lexicon if pattern.search(text)]
    total = 0.0
    for group in (sorted((w for w in hits if w > 0), reverse=True), sorted((w for w in hits if w < 0))):
        total += sum(w * 0.5**i for i, w in enumerate(group))
    return total


# --------------------------------------------------------------------------- profiles


@dataclass(eq=False)
class _Profile:
    idx: int
    item: ItemRecord
    color: str | None
    secondary: str | None
    formality: float
    warmth: float
    athletic: bool
    busy: bool
    fit: float = 0.5


def _profile(idx: int, item: ItemRecord) -> _Profile:
    text = " ".join(filter(None, (item.description, item.name, item.notes))).lower()
    formality = 0.4 + _offset(text, FORMALITY)
    athletic = any(p.search(text) for p, _ in ATHLETIC)
    if athletic:
        formality = min(formality, 0.2)
    return _Profile(
        idx=idx,
        item=item,
        color=_resolve_color(item.primary_color),
        secondary=_resolve_color(item.secondary_color),
        formality=_clamp(formality),
        warmth=_clamp(BASE_WARMTH[item.category] + _offset(text, WARMTH)),
        athletic=athletic,
        busy=any(p.search(text) for p, _ in BUSY),
    )


def _item_fit(p: _Profile, code: str | None, season: str | None) -> float:
    """How well one item suits the requested criteria (0..1), plus a small favourite bonus."""
    parts: list[float] = []
    if code:
        lo, hi = DRESS_RANGES[code]
        under, over = max(0.0, lo - p.formality), max(0.0, p.formality - hi)
        leniency = 0.4 if code in ("smart casual", "business") else 1.0  # a blazer is never wrong at work
        in_band = 1 - min(1.0, (under + over * leniency) / 0.4)
        parts.append(0.5 * in_band + 0.5 * (1.0 if p.athletic else 0.0) if code == "athletic" else in_band)
    if season:
        parts.append(1 - min(1.0, abs(p.warmth - SEASON_WARMTH[season]) / 0.5))
    else:  # no season given: gently prefer mild pieces over parkas, scarves and sandals
        parts.append(0.5 + 0.5 * (1 - min(1.0, abs(p.warmth - 0.45) / 0.5)))
    base = sum(parts) / len(parts) if parts else 0.5
    if p.athletic and code != "athletic" and p.item.category != "shoes":
        base -= 0.15  # gym clothes only when the gym is the plan (sneakers are fine anywhere)
    return _clamp(base + (0.05 if p.item.is_favorite else 0.0))


def _pair_score(a: _Profile, b: _Profile) -> float:
    """Colour harmony between two items (0..1)."""
    ca, cb = a.color, b.color
    if ca is None or cb is None:
        score = 0.55
    elif "multicolor" in (ca, cb):
        score = 0.65 if (ca in NEUTRALS or cb in NEUTRALS) else 0.5
    elif ca in NEUTRALS and cb in NEUTRALS:
        score = 0.55 if {ca, cb} in ({"black", "navy"}, {"black", "brown"}) else 0.9
    elif ca in NEUTRALS or cb in NEUTRALS:
        score = 0.85
    else:
        d = abs(HUES[ca] - HUES[cb])
        d = min(d, 360 - d)
        if d < 15:
            score = 0.7  # monochrome
        elif d <= 45:
            score = 0.8  # analogous
        elif d >= 150:
            score = 0.75  # complementary
        elif d >= 100:
            score = 0.55  # triadic-ish
        else:
            score = 0.35  # awkward in-between
    if (a.secondary and a.secondary == cb) or (b.secondary and b.secondary == ca):
        score += 0.08  # colour echoed across items
    if a.busy and b.busy:
        score -= 0.3  # two loud pieces fight each other
    return _clamp(score)


# --------------------------------------------------------------------------- search

TOP_K = {"top": 8, "bottom": 8, "shoes": 8, "outerwear": 4, "accessory": 3}
JITTER = 0.10  # random nudge when shortlisting so the same items don't always win
SAMPLE_POOL = 10  # sample among this many best outfits
SAMPLE_TEMPERATURE = 0.03  # lower = closer to always picking the best


def build_outfit(
    items: Sequence[ItemRecord],
    dress_code: str | None = None,
    season: str | None = None,
    rng: random.Random | None = None,
) -> OutfitCreate:
    """Synchronous core. Pass a seeded `rng` for reproducible results (e.g. in tests)."""
    rng = rng or random.Random()
    code = _normalize(dress_code, DRESS_CODE_ALIASES, "dress code")
    seas = _normalize(season, SEASON_ALIASES, "season")

    by_cat: dict[str, list[_Profile]] = defaultdict(list)
    for idx, item in enumerate(items):
        p = _profile(idx, item)
        p.fit = _item_fit(p, code, seas)
        by_cat[item.category].append(p)

    if not by_cat["top"] or not by_cat["bottom"]:
        raise ValueError(
            "Need at least one top and one bottom to build an outfit "
            f"(have {len(by_cat['top'])} tops, {len(by_cat['bottom'])} bottoms)"
        )

    def shortlist(cat: str) -> list[_Profile]:
        ranked = sorted(by_cat[cat], key=lambda p: p.fit + rng.uniform(0, JITTER), reverse=True)
        return ranked[: TOP_K[cat]]

    tops, bottoms = shortlist("top"), shortlist("bottom")
    shoes: list[_Profile | None] = shortlist("shoes") or [None]  # shoes are optional if the closet has none
    outer: list[_Profile | None] = [None] if seas == "summer" else [None, *shortlist("outerwear")]
    accessories: list[_Profile | None] = [None, *shortlist("accessory")]
    outerwear_available = len(outer) > 1
    cold_penalty = {"winter": 0.15, "fall": 0.08}.get(seas or "", 0.0)

    pair_cache: dict[tuple[int, int], float] = {}

    def pair(a: _Profile, b: _Profile) -> float:
        key = (a.idx, b.idx) if a.idx < b.idx else (b.idx, a.idx)
        if key not in pair_cache:
            pair_cache[key] = _pair_score(a, b)
        return pair_cache[key]

    scored: list[tuple[float, list[_Profile]]] = []
    for combo in itertools.product(tops, bottoms, shoes, outer, accessories):
        chosen = [p for p in combo if p is not None]
        pairs = list(itertools.combinations(chosen, 2))
        color = sum(pair(a, b) for a, b in pairs) / len(pairs)
        fits = [p.fit for p in chosen]
        fit = 0.5 * sum(fits) / len(fits) + 0.5 * min(fits)  # one bad piece drags the whole look down
        formalities = [p.formality for p in chosen if p.item.category != "accessory"]
        coherence = 1 - min(1.0, 2 * statistics.pstdev(formalities))

        total = 0.35 * color + 0.40 * fit + 0.25 * coherence
        if outerwear_available and combo[3] is None:
            total -= cold_penalty  # cold weather wants a layer if the closet has one
        scored.append((total, chosen))

    scored.sort(key=lambda s: s[0], reverse=True)
    pool = scored[:SAMPLE_POOL]
    best = pool[0][0]
    weights = [math.exp((s - best) / SAMPLE_TEMPERATURE) for s, _ in pool]
    _, chosen = rng.choices(pool, weights=weights, k=1)[0]

    order = {"top": 0, "bottom": 1, "outerwear": 2, "shoes": 3, "accessory": 4}
    chosen.sort(key=lambda p: order[p.item.category])
    label = " ".join(part.title() for part in (code, seas) if part)
    return OutfitCreate(
        name=f"{label} Outfit" if label else "Generated Outfit",
        item_ids=[p.item.item_id for p in chosen],
    )


async def outfit_algo(
    items: Sequence[ItemRecord],
    dress_code: str | None = None,
    season: str | None = None,
    *,
    rng: random.Random | None = None,
) -> OutfitCreate:
    """Async wrapper used by the repository; runs the search off the event loop."""
    return await asyncio.to_thread(build_outfit, items, dress_code, season, rng)
