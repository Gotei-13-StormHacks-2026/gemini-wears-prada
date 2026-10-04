import asyncio

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY
from app.data.models import ItemMetadata
from app.data.supabase_client import get_client, get_settings

MODEL_NAME = "gemini-3.8-flash"
client = genai.Client(api_key=GEMINI_API_KEY)


_IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _image_mime_type(image_ref: str) -> str:
    suffix = "." + image_ref.rsplit(".", 1)[-1].lower() if "." in image_ref else ""
    mime_type = _IMAGE_MIME_TYPES.get(suffix)
    if mime_type is None:
        raise ValueError("The uploaded image has an unsupported file type.")
    return mime_type


async def _download_image(image_ref: str) -> bytes:
    settings = get_settings()
    supabase = await get_client()
    return await supabase.storage.from_(settings.bucket).download(image_ref)


async def analyze_item_image(image_data: bytes, mime_type: str) -> ItemMetadata:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    def generate_metadata():
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                "Identify this clothing item. Return its category (top, bottom, outerwear, shoes, or accessory), "
                "primary color, optional secondary color, and a concise visual description. Do not infer brand or fabric.",
                types.Part.from_bytes(data=image_data, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=ItemMetadata,
            ),
        )
        if not response.text:
            raise ValueError("Gemini returned an empty item description.")
        return ItemMetadata.model_validate_json(response.text)

    return await asyncio.to_thread(generate_metadata)


async def generate_roast_for_image(image_ref: str) -> str:
    """Generate a short roast for an image stored in Supabase Storage."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    mime_type = _image_mime_type(image_ref)
    image_data = await _download_image(image_ref)

    def generate_roast():
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                "Give a short, funny but kind roast of this outfit. Include an outfit score from 0 to 10 "
                "and briefly explain the score. Focus only on visible details.",
                types.Part.from_bytes(data=image_data, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(temperature=0.7),
        )
        if not response.text:
            raise ValueError("Gemini returned an empty fit check response.")
        return response.text

    return await asyncio.to_thread(generate_roast)
