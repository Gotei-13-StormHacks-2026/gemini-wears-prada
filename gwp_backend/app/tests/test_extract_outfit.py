import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from PIL import Image

from app.data.models import ItemCreate, ItemMetadata, ItemRecord
from app.services.extraction import (
    ALPHA_THRESHOLD,
    MAX_SIDE,
    _make_sticker,
    extract_outfit_as_stickers,
)


SAMPLE_DIR = Path(__file__).resolve().parents[1] / "data" / "sample"


def sample_images():
    """Return all sample clothing images in data/sample."""
    return sorted(
        path
        for path in SAMPLE_DIR.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )


@pytest.mark.parametrize("image_path", sample_images(), ids=lambda p: p.stem)
def test_make_sticker_extracts_clothing(image_path):
    """Every sample clothing image should produce a valid transparent PNG."""
    raw = image_path.read_bytes()

    sticker = _make_sticker(raw)

    assert sticker, f"No sticker produced for {image_path.name}"

    result = Image.open(io.BytesIO(sticker))

    # The output must be a PNG with transparency.
    assert result.format == "PNG"
    assert result.mode == "RGBA"

    # The sticker should actually contain pixels.
    assert result.width > 0
    assert result.height > 0

    alpha = result.getchannel("A")

    # There should be some opaque/semi-opaque clothing pixels.
    opaque_pixels = sum(
        count
        for value, count in enumerate(alpha.histogram())
        if value > ALPHA_THRESHOLD
    )

    assert opaque_pixels > 0, (
        f"Sticker for {image_path.name} contains no visible clothing pixels"
    )


@pytest.mark.parametrize("image_path", sample_images(), ids=lambda p: p.stem)
def test_make_sticker_is_cropped(image_path):
    """The resulting sticker should be substantially smaller than the source frame."""
    raw = image_path.read_bytes()

    source = Image.open(io.BytesIO(raw))
    sticker = Image.open(io.BytesIO(_make_sticker(raw)))

    # _make_sticker downsizes the source to MAX_SIDE before segmentation.
    source.thumbnail((MAX_SIDE, MAX_SIDE))

    # The crop should not simply be the entire source image in normal samples.
    assert sticker.width <= source.width
    assert sticker.height <= source.height

    # At least one dimension should have been cropped.
    assert sticker.size != source.size, (
        f"{image_path.name} was not cropped: "
        f"source={source.size}, sticker={sticker.size}"
    )


@pytest.mark.parametrize("image_path", sample_images(), ids=lambda p: p.stem)
def test_make_sticker_has_transparent_background(image_path):
    """The output should contain transparent pixels around the garment."""
    raw = image_path.read_bytes()

    sticker = Image.open(io.BytesIO(_make_sticker(raw))).convert("RGBA")
    alpha = sticker.getchannel("A")

    transparent_pixels = sum(alpha.histogram()[: ALPHA_THRESHOLD + 1])

    assert transparent_pixels > 0, (
        f"{image_path.name} has no transparent background pixels"
    )


def test_make_sticker_rejects_empty_image():
    """An image containing no detectable object should be rejected."""
    image = Image.new("RGB", (500, 500), "white")

    buf = io.BytesIO()
    image.save(buf, format="JPEG")

    with pytest.raises(ValueError, match="No clothing item detected"):
        _make_sticker(buf.getvalue())


@pytest.mark.asyncio
async def test_extract_outfit_as_stickers():
    """The full extraction pipeline should download, label, upload and return a record."""
    sample = SAMPLE_DIR / "shirt.jpg"

    if not sample.exists():
        pytest.skip("data/sample/shirt.jpg does not exist")

    raw = sample.read_bytes()

    item = ItemCreate(
        image_ref="uploads/shirt.jpg",
        name="Test Shirt",
        notes="Test item",
    )

    # Fake Supabase storage.
    storage = MagicMock()
    storage.download = AsyncMock(return_value=raw)
    storage.upload = AsyncMock()

    bucket = MagicMock()
    bucket.download = storage.download
    bucket.upload = storage.upload

    storage.from_.return_value = bucket

    client = MagicMock()
    client.storage = storage

    settings = MagicMock()
    settings.bucket = "test-bucket"

    # A real ItemMetadata, so the fake can't drift from the actual model again.
    fake_metadata = ItemMetadata(
        category="top", primary_color="black", description="Test shirt"
    )
    label = AsyncMock(return_value=fake_metadata)

    with (
        patch(
            "app.services.extraction.get_client",
            new=AsyncMock(return_value=client),
        ),
        patch(
            "app.services.extraction.get_settings",
            return_value=settings,
        ),
        patch("app.services.extraction.label_item", new=label),
    ):
        result = await extract_outfit_as_stickers(item)

    assert isinstance(result, ItemRecord)
    assert isinstance(result.item_id, UUID)

    assert result.name == "Test Shirt"
    assert result.notes == "Test item"

    assert result.image_ref.startswith("stickers/")
    assert result.image_ref.endswith(".png")

    # Make sure the original was downloaded.
    storage.download.assert_awaited_once_with("uploads/shirt.jpg")

    # Make sure the generated sticker was uploaded.
    storage.upload.assert_awaited_once()

    upload_args = storage.upload.await_args
    uploaded_ref = upload_args.args[0]
    uploaded_bytes = upload_args.args[1]

    assert uploaded_ref == result.image_ref
    assert uploaded_ref.startswith("stickers/")
    assert uploaded_ref.endswith(".png")

    # Verify what was uploaded is actually a valid PNG.
    uploaded_image = Image.open(io.BytesIO(uploaded_bytes))

    assert uploaded_image.format == "PNG"
    assert uploaded_image.mode == "RGBA"

    # The labelled metadata should end up on the returned record.
    assert result.category == "top"
    assert result.primary_color == "black"

    # Labeling should receive the exact sticker that was uploaded.
    label.assert_awaited_once()
    assert label.await_args.args[0] == uploaded_bytes


@pytest.mark.asyncio
async def test_extract_outfit_does_not_upload_when_labeling_fails():
    """A labeling failure should not leave an orphaned sticker in storage."""
    sample = SAMPLE_DIR / "shirt.jpg"

    if not sample.exists():
        pytest.skip("data/sample/shirt.jpg does not exist")

    raw = sample.read_bytes()

    item = ItemCreate(
        image_ref="uploads/shirt.jpg",
        name="Test Shirt",
        notes=None,
    )

    storage = MagicMock()
    storage.download = AsyncMock(return_value=raw)
    storage.upload = AsyncMock()

    bucket = MagicMock()
    bucket.download = storage.download
    bucket.upload = storage.upload

    storage.from_.return_value = bucket

    client = MagicMock()
    client.storage = storage

    settings = MagicMock()
    settings.bucket = "test-bucket"

    with (
        patch(
            "app.services.extraction.get_client",
            new=AsyncMock(return_value=client),
        ),
        patch(
            "app.services.extraction.get_settings",
            return_value=settings,
        ),
        patch(
            "app.services.extraction.label_item",
            new=AsyncMock(side_effect=RuntimeError("labeling failed")),
        ),
    ):
        with pytest.raises(RuntimeError, match="labeling failed"):
            await extract_outfit_as_stickers(item)

    # The implementation intentionally labels before uploading.
    storage.upload.assert_not_awaited()