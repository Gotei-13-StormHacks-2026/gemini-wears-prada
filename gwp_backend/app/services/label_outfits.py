import asyncio
import io

from google.genai import types
from PIL import Image
from pydantic import ValidationError

from app.data.models import ItemMetadata
from app.services.agent_service import MODEL_NAME, client  # shared Gemini client and model

# A small fixed vocabulary keeps colours comparable across items for the outfit algorithm.
COLOR_VOCAB = [
    "black", "white", "gray", "beige", "brown", "tan", "cream", "navy", "blue", "light blue",
    "teal", "green", "olive", "yellow", "orange", "red", "burgundy", "pink", "purple", "gold",
    "silver", "multicolor",
]

SYSTEM_PROMPT = f"""You label single clothing items for a wardrobe app. The image shows ONE item \
cut out and placed on a neutral gray background (the gray is not part of the item).

Rules:
- category: choose the closest of top, bottom, outerwear, shoes, accessory.
- primary_color: the dominant colour of the item itself, chosen from: {", ".join(COLOR_VOCAB)}.
- secondary_color: the next most visible colour from the same list, or null if the item is essentially one colour.
- description: one short sentence an outfit-matching algorithm could use. Cover pattern or \
graphics (plaid, striped, floral, logo, anime character, etc.), any other notable colours, \
material or style cues, and fit or formality (e.g. "red and black plaid flannel button-up, casual"). \
Describe only what is visible.
Use the pixel colour measurements as a guide, but trust your eyes for naming."""

def _dominant_colors(sticker: Image.Image, n: int = 5) -> list[tuple[str, float]]:
    """Return [(hex, share)] for the opaque pixels, largest first."""
    small = sticker.copy()
    small.thumbnail((128, 128))
    pixels = [p[:3] for p in small.getdata() if p[3] > 200]
    if not pixels:
        return []
    strip = Image.new("RGB", (len(pixels), 1))
    strip.putdata(pixels)
    quant = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    palette = quant.getpalette() or []
    total = len(pixels)
    out = []
    for count, idx in sorted(quant.getcolors(), reverse=True):
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        out.append((f"#{r:02x}{g:02x}{b:02x}", count / total))
    return out


def _prepare(sticker_png: bytes) -> tuple[bytes, str]:
    """Return (PNG bytes on neutral gray, human-readable colour hint)."""
    sticker = Image.open(io.BytesIO(sticker_png)).convert("RGBA")
    colors = _dominant_colors(sticker)
    backdrop = Image.new("RGBA", sticker.size, (128, 128, 128, 255))
    flat = Image.alpha_composite(backdrop, sticker).convert("RGB")
    buf = io.BytesIO()
    flat.save(buf, format="PNG")
    hint = "Dominant pixel colours: " + ", ".join(f"{h} ({s:.0%})" for h, s in colors)
    return buf.getvalue(), hint


def _clean(meta: ItemMetadata) -> ItemMetadata:
    """Normalise casing/whitespace so downstream matching is simple."""
    return meta.model_copy(
        update={
            "primary_color": meta.primary_color.strip().lower(),
            "secondary_color": meta.secondary_color.strip().lower() if meta.secondary_color else None,
            "description": meta.description.strip(),
        }
    )


async def label_item(sticker_png: bytes, attempts: int = 2) -> ItemMetadata:
    """Classify a sticker PNG (RGBA, transparent background) into ItemMetadata."""
    flat_png, hint = await asyncio.to_thread(_prepare, sticker_png)
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=ItemMetadata,
        temperature=0.0,
    )
    contents = [
        types.Part.from_bytes(data=flat_png, mime_type="image/png"),
        f"{hint}\nLabel this item.",
    ]

    last_error: Exception | None = None
    for _ in range(attempts):
        response = await client.aio.models.generate_content(
            model=MODEL_NAME, contents=contents, config=config
        )
        if not response.text:  # e.g. blocked or empty candidate
            last_error = RuntimeError("Model returned no text")
            continue
        try:
            return _clean(ItemMetadata.model_validate_json(response.text))
        except ValidationError as exc:
            last_error = exc

    raise RuntimeError(f"Could not label item after {attempts} attempts") from last_error
