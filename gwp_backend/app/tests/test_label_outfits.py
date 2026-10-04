import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from app.data.models import ItemMetadata
from app.services.label_outfits import (
    COLOR_VOCAB,
    _clean,
    _dominant_colors,
    _prepare,
    label_item,
)


SAMPLE_DIR = Path(__file__).resolve().parents[1] / "data" / "sample"


def sample_images():
    return sorted(
        path
        for path in SAMPLE_DIR.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )


# ---------------------------------------------------------------------------
# _dominant_colors
# ---------------------------------------------------------------------------


def make_rgba_image(
    size=(100, 100),
    background=(255, 0, 0, 255),
):
    return Image.new("RGBA", size, background)


def test_dominant_colors_returns_empty_for_fully_transparent_image():
    image = Image.new("RGBA", (100, 100), (255, 0, 0, 0))

    assert _dominant_colors(image) == []


def test_dominant_colors_ignores_transparent_pixels():
    image = Image.new("RGBA", (100, 100), (255, 0, 0, 0))

    # Opaque blue square.
    for x in range(50):
        for y in range(50):
            image.putpixel((x, y), (0, 0, 255, 255))

    colors = _dominant_colors(image, n=3)

    assert colors
    assert colors[0][1] == pytest.approx(1.0)


def test_dominant_colors_returns_largest_colour_first():
    image = Image.new("RGBA", (100, 100), (255, 0, 0, 255))

    # Make 25% blue.
    for x in range(50):
        for y in range(100):
            image.putpixel((x, y), (0, 0, 255, 255))

    colors = _dominant_colors(image, n=2)

    assert len(colors) == 2

    # Red occupies roughly 50%, blue roughly 50%.
    shares = [share for _, share in colors]

    assert sum(shares) == pytest.approx(1.0)


def test_dominant_colors_shares_sum_to_one():
    image = make_rgba_image()

    colors = _dominant_colors(image)

    assert colors
    assert sum(share for _, share in colors) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# _prepare
# ---------------------------------------------------------------------------


def test_prepare_returns_valid_png():
    sticker = make_rgba_image((200, 100), (255, 0, 0, 255))

    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    flat_png, hint = _prepare(buf.getvalue())

    output = Image.open(io.BytesIO(flat_png))

    assert output.format == "PNG"
    assert output.mode == "RGB"
    assert output.size == (200, 100)


def test_prepare_removes_transparency():
    sticker = Image.new("RGBA", (100, 100), (0, 0, 0, 0))

    # Opaque red centre.
    for x in range(25, 75):
        for y in range(25, 75):
            sticker.putpixel((x, y), (255, 0, 0, 255))

    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    flat_png, _ = _prepare(buf.getvalue())

    output = Image.open(io.BytesIO(flat_png)).convert("RGB")

    # The output has no alpha channel.
    assert output.mode == "RGB"

    # Transparent areas should now be gray.
    assert output.getpixel((0, 0)) == (128, 128, 128)

    # Opaque red area should remain red.
    assert output.getpixel((50, 50)) == (255, 0, 0)


def test_prepare_includes_colour_hint():
    sticker = make_rgba_image((100, 100), (255, 0, 0, 255))

    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    _, hint = _prepare(buf.getvalue())

    assert "Dominant pixel colours:" in hint
    assert "#" in hint
    assert "%" in hint


# ---------------------------------------------------------------------------
# _clean
# ---------------------------------------------------------------------------


def test_clean_normalizes_colour_casing_and_whitespace():
    metadata = ItemMetadata(
        category="top",
        primary_color=" RED ",
        secondary_color=" Blue ",
        description="  red shirt  ",
    )

    cleaned = _clean(metadata)

    assert cleaned.primary_color == "red"
    assert cleaned.secondary_color == "blue"
    assert cleaned.description == "red shirt"


def test_clean_handles_null_secondary_colour():
    metadata = ItemMetadata(
        category="top",
        primary_color="BLACK",
        secondary_color=None,
        description=" Black shirt ",
    )

    cleaned = _clean(metadata)

    assert cleaned.primary_color == "black"
    assert cleaned.secondary_color is None
    assert cleaned.description == "Black shirt"


# ---------------------------------------------------------------------------
# Sample images
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "image_path",
    sample_images(),
    ids=lambda path: path.stem,
)
def test_prepare_all_sample_images(image_path):
    """Every real sample sticker should be processable by the label pipeline."""
    raw = image_path.read_bytes()

    flat_png, hint = _prepare(raw)

    image = Image.open(io.BytesIO(flat_png))

    assert image.format == "PNG"
    assert image.mode == "RGB"
    assert image.width > 0
    assert image.height > 0

    assert hint.startswith("Dominant pixel colours:")


# ---------------------------------------------------------------------------
# label_item
# ---------------------------------------------------------------------------


def make_model_response(json_text: str):
    response = MagicMock()
    response.text = json_text
    return response


@pytest.mark.asyncio
async def test_label_item_parses_valid_model_response():
    response = make_model_response(
        """
        {
            "category": "top",
            "primary_color": " RED ",
            "secondary_color": " BLACK ",
            "description": "  red and black plaid shirt, casual  "
        }
        """
    )

    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        return_value=response
    )

    sticker = make_rgba_image((100, 100), (255, 0, 0, 255))
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        result = await label_item(buf.getvalue())

    assert isinstance(result, ItemMetadata)

    assert result.category == "top"
    assert result.primary_color == "red"
    assert result.secondary_color == "black"
    assert result.description == "red and black plaid shirt, casual"

    fake_client.aio.models.generate_content.assert_awaited_once()


@pytest.mark.asyncio
async def test_label_item_sends_png_to_model():
    response = make_model_response(
        """
        {
            "category": "top",
            "primary_color": "red",
            "secondary_color": null,
            "description": "red shirt"
        }
        """
    )

    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        return_value=response
    )

    sticker = make_rgba_image()
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        await label_item(buf.getvalue())

    call = fake_client.aio.models.generate_content.await_args

    assert call is not None

    contents = call.kwargs["contents"]

    # First content should be the image part.
    image_part = contents[0]

    assert image_part.inline_data is not None
    assert image_part.inline_data.mime_type == "image/png"

    # Second content should contain our colour hint.
    assert "Dominant pixel colours:" in contents[1]


@pytest.mark.asyncio
async def test_label_item_retries_after_invalid_json():
    invalid = make_model_response("this is not json")

    valid = make_model_response(
        """
        {
            "category": "bottom",
            "primary_color": "blue",
            "secondary_color": null,
            "description": "blue pants"
        }
        """
    )

    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        side_effect=[invalid, valid]
    )

    sticker = make_rgba_image()
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        result = await label_item(buf.getvalue(), attempts=2)

    assert result.category == "bottom"
    assert result.primary_color == "blue"

    assert fake_client.aio.models.generate_content.await_count == 2


@pytest.mark.asyncio
async def test_label_item_retries_after_empty_response():
    empty = make_model_response("")

    valid = make_model_response(
        """
        {
            "category": "outerwear",
            "primary_color": "black",
            "secondary_color": null,
            "description": "black jacket"
        }
        """
    )

    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        side_effect=[empty, valid]
    )

    sticker = make_rgba_image()
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        result = await label_item(buf.getvalue(), attempts=2)

    assert result.category == "outerwear"
    assert fake_client.aio.models.generate_content.await_count == 2


@pytest.mark.asyncio
async def test_label_item_raises_after_all_attempts_fail():
    invalid = make_model_response("not valid json")

    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        return_value=invalid
    )

    sticker = make_rgba_image()
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        with pytest.raises(
            RuntimeError,
            match="Could not label item after 2 attempts",
        ):
            await label_item(buf.getvalue(), attempts=2)

    assert fake_client.aio.models.generate_content.await_count == 2


@pytest.mark.asyncio
async def test_label_item_propagates_model_errors():
    fake_client = MagicMock()
    fake_client.aio.models.generate_content = AsyncMock(
        side_effect=RuntimeError("API exploded")
    )

    sticker = make_rgba_image()
    buf = io.BytesIO()
    sticker.save(buf, format="PNG")

    with patch(
        "app.services.label_outfits.client",
        fake_client,
    ):
        with pytest.raises(RuntimeError, match="API exploded"):
            await label_item(buf.getvalue(), attempts=2)


# ---------------------------------------------------------------------------
# Schema / vocabulary sanity check
# ---------------------------------------------------------------------------


def test_color_vocabulary_contains_expected_values():
    expected = {
        "black",
        "white",
        "gray",
        "beige",
        "brown",
        "navy",
        "blue",
        "red",
        "green",
        "pink",
        "purple",
        "multicolor",
    }

    assert expected.issubset(set(COLOR_VOCAB))
