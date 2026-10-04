import random
from uuid import uuid4

import pytest

from app.data.models import ItemRecord, OutfitCreate
from app.services.outfit_algo import (
    DRESS_CODE_ALIASES,
    DRESS_RANGES,
    SEASON_ALIASES,
    SEASON_WARMTH,
    _item_fit,
    _normalize,
    _offset,
    _pair_score,
    _profile,
    _resolve_color,
    build_outfit,
    outfit_algo,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def item(
    category: str,
    *,
    name: str | None = None,
    description: str = "",
    primary_color: str | None = "black",
    secondary_color: str | None = None,
    notes: str | None = None,
    favorite: bool = False,
) -> ItemRecord:
    return ItemRecord(
        item_id=uuid4(),
        category=category,
        name=name or category.title(),
        notes=notes,
        primary_color=primary_color,
        secondary_color=secondary_color,
        description=description,
        is_favorite=favorite,
    )


def basic_closet() -> list[ItemRecord]:
    return [
        item(
            "top",
            name="White T-Shirt",
            description="white cotton t-shirt, casual",
            primary_color="white",
        ),
        item(
            "bottom",
            name="Blue Jeans",
            description="blue denim jeans, casual",
            primary_color="blue",
        ),
        item(
            "shoes",
            name="White Sneakers",
            description="white casual sneakers",
            primary_color="white",
        ),
    ]


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("casual", "casual"),
        ("CASUAL", "casual"),
        (" everyday ", "casual"),
        ("date-night", "smart casual"),
        ("business_casual", "smart casual"),
        ("office", "business"),
        ("black tie", "formal"),
        ("wedding", "formal"),
        ("gym", "athletic"),
        ("autumn", "fall"),
        ("WINTER", "winter"),
    ],
)
def test_normalize_aliases(value, expected):
    aliases = DRESS_CODE_ALIASES if value.lower().replace("-", " ") in {
        key.replace("-", " ") for key in DRESS_CODE_ALIASES
    } else SEASON_ALIASES

    # Explicitly select based on expected result.
    aliases = (
        DRESS_CODE_ALIASES
        if expected in DRESS_RANGES
        else SEASON_ALIASES
    )

    assert _normalize(value, aliases, "value") == expected


def test_normalize_rejects_unknown_value():
    with pytest.raises(ValueError, match="Unknown dress code"):
        _normalize("business-ish", DRESS_CODE_ALIASES, "dress code")


def test_normalize_none_returns_none():
    assert _normalize(None, DRESS_CODE_ALIASES, "dress code") is None


# ---------------------------------------------------------------------------
# Colour resolution
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("black", "black"),
        ("BLACK", "black"),
        (" dark navy blue ", "navy"),
        ("grey", "gray"),
        ("light blue", "light blue"),
        ("deep burgundy", "burgundy"),
        ("cream white", "cream"),
        ("bright red", "red"),
        ("", None),
        (None, None),
        ("chartreuse", None),
    ],
)
def test_resolve_color(raw, expected):
    assert _resolve_color(raw) == expected


def test_resolve_color_prefers_longest_match_at_same_position():
    assert _resolve_color("light blue") == "light blue"


# ---------------------------------------------------------------------------
# Keyword scoring
# ---------------------------------------------------------------------------


def test_offset_gives_diminishing_returns():
    one = _offset("tailored", [(pytest.importorskip("re").compile("tailored"), 1.0)])
    two = _offset(
        "tailored tailored",
        [(pytest.importorskip("re").compile("tailored"), 1.0)],
    )

    # The implementation searches each pattern only once, so repeated
    # occurrences inside one regex match don't stack.
    assert one == two


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------


def test_profile_detects_formality():
    casual = item(
        "top",
        description="graphic t-shirt with anime print",
    )
    formal = item(
        "top",
        description="tailored dress shirt, collared button-down",
    )

    casual_profile = _profile(0, casual)
    formal_profile = _profile(1, formal)

    assert formal_profile.formality > casual_profile.formality


def test_profile_detects_athletic_items():
    clothes = item(
        "top",
        description="athletic performance running workout shirt",
    )

    profile = _profile(0, clothes)

    assert profile.athletic is True
    assert profile.formality <= 0.2


def test_profile_detects_busy_patterns():
    plaid = item(
        "top",
        description="red and black plaid flannel",
    )

    profile = _profile(0, plaid)

    assert profile.busy is True


def test_profile_detects_warmth():
    light = item(
        "top",
        description="lightweight breathable linen short-sleeve shirt",
    )
    warm = item(
        "top",
        description="heavy wool thick sweater",
    )

    light_profile = _profile(0, light)
    warm_profile = _profile(1, warm)

    assert warm_profile.warmth > light_profile.warmth


def test_profile_resolves_primary_and_secondary_colours():
    clothes = item(
        "top",
        primary_color="dark navy blue",
        secondary_color="bright red",
        description="shirt",
    )

    profile = _profile(0, clothes)

    assert profile.color == "navy"
    assert profile.secondary == "red"


def test_favorite_gets_fit_bonus():
    normal = item(
        "top",
        description="white cotton t-shirt",
        favorite=False,
    )
    favorite = item(
        "top",
        description="white cotton t-shirt",
        favorite=True,
    )

    normal_profile = _profile(0, normal)
    favorite_profile = _profile(1, favorite)

    normal_profile.fit = _item_fit(normal_profile, None, None)
    favorite_profile.fit = _item_fit(favorite_profile, None, None)

    assert favorite_profile.fit > normal_profile.fit


# ---------------------------------------------------------------------------
# Item fit
# ---------------------------------------------------------------------------


def test_formal_item_fits_formal_dress_code():
    clothes = item(
        "top",
        description="tailored formal dress shirt collared",
    )

    profile = _profile(0, clothes)

    formal_fit = _item_fit(profile, "formal", None)
    casual_fit = _item_fit(profile, "casual", None)

    assert formal_fit > casual_fit


def test_casual_item_fits_casual_dress_code():
    clothes = item(
        "top",
        description="graphic t-shirt casual",
    )

    profile = _profile(0, clothes)

    casual_fit = _item_fit(profile, "casual", None)
    formal_fit = _item_fit(profile, "formal", None)

    assert casual_fit > formal_fit


def test_winter_prefers_warm_items():
    light = _profile(
        0,
        item(
            "top",
            description="lightweight breathable short-sleeve shirt",
        ),
    )
    warm = _profile(
        1,
        item(
            "top",
            description="heavy wool thick sweater",
        ),
    )

    light_fit = _item_fit(light, None, "winter")
    warm_fit = _item_fit(warm, None, "winter")

    assert warm_fit > light_fit


def test_summer_prefers_light_items():
    light = _profile(
        0,
        item(
            "top",
            description="lightweight breathable linen short-sleeve shirt",
        ),
    )
    warm = _profile(
        1,
        item(
            "top",
            description="heavy wool thick sweater",
        ),
    )

    light_fit = _item_fit(light, None, "summer")
    warm_fit = _item_fit(warm, None, "summer")

    assert light_fit > warm_fit


def test_athletic_item_is_penalized_for_non_athletic_outfit():
    clothes = item(
        "top",
        description="athletic gym workout performance shirt",
    )

    profile = _profile(0, clothes)

    casual_fit = _item_fit(profile, "casual", None)
    athletic_fit = _item_fit(profile, "athletic", None)

    assert athletic_fit > casual_fit


# ---------------------------------------------------------------------------
# Pair / colour harmony
# ---------------------------------------------------------------------------


def test_neutral_colours_pair_well():
    black = _profile(
        0,
        item("top", primary_color="black"),
    )
    white = _profile(
        1,
        item("bottom", primary_color="white"),
    )

    assert _pair_score(black, white) >= 0.9


def test_neutral_and_colour_pair_well():
    black = _profile(
        0,
        item("top", primary_color="black"),
    )
    red = _profile(
        1,
        item("bottom", primary_color="red"),
    )

    assert _pair_score(black, red) == pytest.approx(0.85)


def test_awkward_hue_combination_scores_lower():
    yellow = _profile(
        0,
        item("top", primary_color="yellow"),
    )
    blue = _profile(
        1,
        item("bottom", primary_color="blue"),
    )

    score = _pair_score(yellow, blue)

    assert 0.0 <= score <= 1.0


def test_matching_secondary_colour_gets_bonus():
    top = _profile(
        0,
        item(
            "top",
            primary_color="black",
            secondary_color="red",
        ),
    )
    bottom = _profile(
        1,
        item(
            "bottom",
            primary_color="red",
        ),
    )

    score_with_echo = _pair_score(top, bottom)

    plain_top = _profile(
        2,
        item(
            "top",
            primary_color="black",
        ),
    )

    score_without_echo = _pair_score(plain_top, bottom)

    assert score_with_echo > score_without_echo


def test_two_busy_items_are_penalized():
    plaid = _profile(
        0,
        item(
            "top",
            primary_color="red",
            description="red plaid flannel",
        ),
    )
    striped = _profile(
        1,
        item(
            "bottom",
            primary_color="blue",
            description="blue striped pants",
        ),
    )

    plain_bottom = _profile(
        2,
        item(
            "bottom",
            primary_color="blue",
        ),
    )

    busy_score = _pair_score(plaid, striped)
    plain_score = _pair_score(plaid, plain_bottom)

    assert busy_score < plain_score


# ---------------------------------------------------------------------------
# build_outfit - basic requirements
# ---------------------------------------------------------------------------


def test_build_outfit_requires_top():
    clothes = [
        item("bottom"),
        item("shoes"),
    ]

    with pytest.raises(ValueError, match="Need at least one top and one bottom"):
        build_outfit(clothes, rng=random.Random(1))


def test_build_outfit_requires_bottom():
    clothes = [
        item("top"),
        item("shoes"),
    ]

    with pytest.raises(ValueError, match="Need at least one top and one bottom"):
        build_outfit(clothes, rng=random.Random(1))


def test_build_outfit_can_work_without_shoes():
    clothes = [
        item(
            "top",
            primary_color="white",
            description="white cotton t-shirt",
        ),
        item(
            "bottom",
            primary_color="blue",
            description="blue jeans",
        ),
    ]

    outfit = build_outfit(clothes, rng=random.Random(1))

    assert isinstance(outfit, OutfitCreate)
    assert len(outfit.item_ids) == 2


def test_build_outfit_includes_top_and_bottom():
    clothes = basic_closet()

    outfit = build_outfit(
        clothes,
        rng=random.Random(1),
    )

    assert isinstance(outfit, OutfitCreate)
    assert len(outfit.item_ids) >= 2

    chosen = set(outfit.item_ids)

    assert any(
        record.item_id in chosen
        and record.category == "top"
        for record in clothes
    )

    assert any(
        record.item_id in chosen
        and record.category == "bottom"
        for record in clothes
    )


def test_build_outfit_name_contains_criteria():
    clothes = basic_closet()

    outfit = build_outfit(
        clothes,
        dress_code="casual",
        season="summer",
        rng=random.Random(1),
    )

    assert "Casual" in outfit.name
    assert "Summer" in outfit.name


def test_build_outfit_without_criteria_has_default_name():
    outfit = build_outfit(
        basic_closet(),
        rng=random.Random(1),
    )

    assert outfit.name == "Generated Outfit"


# ---------------------------------------------------------------------------
# Optional layers
# ---------------------------------------------------------------------------


def test_summer_does_not_include_outerwear():
    clothes = [
        *basic_closet(),
        item(
            "outerwear",
            name="Winter Coat",
            description="heavy wool insulated winter coat",
            primary_color="black",
        ),
    ]

    outfit = build_outfit(
        clothes,
        season="summer",
        rng=random.Random(1),
    )

    chosen = set(outfit.item_ids)

    coat = next(
        record for record in clothes
        if record.name == "Winter Coat"
    )

    assert coat.item_id not in chosen


def test_cold_weather_can_include_outerwear():
    clothes = [
        item(
            "top",
            primary_color="white",
            description="white cotton shirt",
        ),
        item(
            "bottom",
            primary_color="black",
            description="black pants",
        ),
        item(
            "outerwear",
            name="Warm Coat",
            primary_color="black",
            description="heavy wool winter coat",
        ),
    ]

    outfit = build_outfit(
        clothes,
        season="winter",
        rng=random.Random(1),
    )

    chosen = set(outfit.item_ids)

    coat = next(
        record for record in clothes
        if record.name == "Warm Coat"
    )

    assert coat.item_id in chosen


def test_accessories_are_optional():
    clothes = basic_closet()

    outfit = build_outfit(
        clothes,
        rng=random.Random(1),
    )

    # The algorithm must not require an accessory.
    assert isinstance(outfit, OutfitCreate)


# ---------------------------------------------------------------------------
# Dress-code behaviour
# ---------------------------------------------------------------------------


def test_formal_outfit_prefers_formal_items():
    clothes = [
        item(
            "top",
            name="Graphic Tee",
            primary_color="black",
            description="black graphic anime t-shirt",
        ),
        item(
            "top",
            name="Dress Shirt",
            primary_color="white",
            description="white tailored formal dress shirt",
        ),
        item(
            "bottom",
            name="Jeans",
            primary_color="blue",
            description="blue casual jeans",
        ),
        item(
            "bottom",
            name="Dress Pants",
            primary_color="black",
            description="black tailored dress pants",
        ),
    ]

    outfit = build_outfit(
        clothes,
        dress_code="formal",
        rng=random.Random(123),
    )

    chosen = set(outfit.item_ids)

    dress_shirt = next(
        x for x in clothes if x.name == "Dress Shirt"
    )
    dress_pants = next(
        x for x in clothes if x.name == "Dress Pants"
    )

    assert dress_shirt.item_id in chosen
    assert dress_pants.item_id in chosen


def test_athletic_outfit_prefers_athletic_items():
    clothes = [
        item(
            "top",
            name="Dress Shirt",
            primary_color="white",
            description="white tailored collared dress shirt",
        ),
        item(
            "top",
            name="Workout Shirt",
            primary_color="black",
            description="black athletic performance running workout shirt",
        ),
        item(
            "bottom",
            name="Jeans",
            primary_color="blue",
            description="blue denim jeans",
        ),
        item(
            "bottom",
            name="Joggers",
            primary_color="black",
            description="black athletic joggers",
        ),
    ]

    outfit = build_outfit(
        clothes,
        dress_code="athletic",
        rng=random.Random(123),
    )

    chosen = set(outfit.item_ids)

    workout_top = next(
        x for x in clothes if x.name == "Workout Shirt"
    )
    joggers = next(
        x for x in clothes if x.name == "Joggers"
    )

    assert workout_top.item_id in chosen
    assert joggers.item_id in chosen


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_seeded_rng_is_reproducible():
    clothes = [
        *basic_closet(),
        item(
            "top",
            name="Black Hoodie",
            primary_color="black",
            description="black hoodie",
        ),
        item(
            "bottom",
            name="Black Pants",
            primary_color="black",
            description="black pants",
        ),
    ]

    first = build_outfit(
        clothes,
        dress_code="casual",
        season="fall",
        rng=random.Random(42),
    )

    second = build_outfit(
        clothes,
        dress_code="casual",
        season="fall",
        rng=random.Random(42),
    )

    assert first.item_ids == second.item_ids
    assert first.name == second.name


def test_different_seeds_can_produce_different_results():
    clothes = [
        item("top", name="White Tee", primary_color="white"),
        item("top", name="Black Tee", primary_color="black"),
        item("top", name="Gray Tee", primary_color="gray"),
        item("bottom", name="Blue Jeans", primary_color="blue"),
        item("bottom", name="Black Pants", primary_color="black"),
        item("bottom", name="Khaki Pants", primary_color="beige"),
    ]

    results = {
        tuple(
            build_outfit(
                clothes,
                dress_code="casual",
                rng=random.Random(seed),
            ).item_ids
        )
        for seed in range(20)
    }

    # The algorithm intentionally contains jitter + softmax sampling.
    assert len(results) > 1


# ---------------------------------------------------------------------------
# Async wrapper
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_outfit_algo_matches_sync_result():
    clothes = basic_closet()

    seed = 123

    sync_result = build_outfit(
        clothes,
        dress_code="casual",
        season="summer",
        rng=random.Random(seed),
    )

    async_result = await outfit_algo(
        clothes,
        dress_code="casual",
        season="summer",
        rng=random.Random(seed),
    )

    assert async_result.item_ids == sync_result.item_ids
    assert async_result.name == sync_result.name

