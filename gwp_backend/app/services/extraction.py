import asyncio
import io
import logging
import os
from uuid import uuid4

from PIL import Image, ImageOps
from rembg import new_session, remove

from app.data.models import ItemCreate, ItemRecord
from app.data.supabase_client import get_client, get_settings
from app.services.label_outfits import label_item

logger = logging.getLogger(__name__)

MAX_SIDE = 1024  # downscale big phone photos: faster segmentation, smaller storage/API cost
MIN_COVERAGE = 0.02  # reject cut-outs where less than 2% of the frame survived
CROP_PADDING = 0.04  # breathing room around the garment, as a fraction of its size
ALPHA_THRESHOLD = 16

_session = None


def _get_session():
    """Load the segmentation model once. Weights download on first use."""
    global _session
    if _session is None:
        _session = new_session(os.getenv("REMBG_MODEL", "isnet-general-use"))
    return _session


def _make_sticker(raw: bytes) -> bytes:
    """Remove the background, crop to the garment, and return transparent PNG bytes."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))

    # A (near-)uniform image can't contain a garment; skip the model entirely.
    if all(hi - lo <= 2 for lo, hi in img.getextrema()):
        raise ValueError("No clothing item detected in the image")

    cut = remove(img, session=_get_session()).convert("RGBA")
    alpha = cut.getchannel("A")

    opaque = sum(alpha.histogram()[ALPHA_THRESHOLD + 1 :])
    if opaque / (cut.width * cut.height) < MIN_COVERAGE:
        raise ValueError("No clothing item detected in the image")

    left, top, right, bottom = alpha.point(lambda a: 255 if a > ALPHA_THRESHOLD else 0).getbbox()
    pad_x = int((right - left) * CROP_PADDING)
    pad_y = int((bottom - top) * CROP_PADDING)
    box = (
        max(left - pad_x, 0),
        max(top - pad_y, 0),
        min(right + pad_x, cut.width),
        min(bottom + pad_y, cut.height),
    )

    buf = io.BytesIO()
    cut.crop(box).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def extract_outfit_as_stickers(item: ItemCreate) -> ItemRecord:
    """Fetch the original upload, cut out the garment, label it, and store the sticker.

    The returned record's image_ref points at the sticker (stickers/<item_id>.png), so
    signed URLs in the app show the clean cut-out. The original upload is left untouched.
    """
    client = await get_client()
    bucket = client.storage.from_(get_settings().bucket)

    raw = await bucket.download(item.image_ref)
    sticker = await asyncio.to_thread(_make_sticker, raw)  # CPU-bound; keep the event loop free
    metadata = await label_item(sticker)  # label before uploading so failures leave no orphan

    item_id = uuid4()
    sticker_ref = f"stickers/{item_id}.png"
    await bucket.upload(sticker_ref, sticker, {"content-type": "image/png"})

    return ItemRecord(
        item_id=item_id,
        image_ref=sticker_ref,
        name=item.name,
        notes=item.notes,
        **metadata.model_dump(),
    )
