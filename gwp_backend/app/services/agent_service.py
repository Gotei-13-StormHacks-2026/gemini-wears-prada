"""Formerly known as roast_service.py."""
import logging
import mimetypes

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY
from app.data.supabase_client import get_client, get_settings

logger = logging.getLogger(__name__)
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-3.8-flash"  # Fully eligible for the free tier
AGENT_PERSONA = [
    "You are a fashion critic, a personality like Miranda Priestly from The Devil Wears Prada. "
    "Look at the outfit in the image and roast it in no more than three short sentences. "
    "Then after that, give one or two genuine tip to fix it, and the score. "
    "First call the outfit_score tool with your 0 to 10 rating and a one-sentence reason, "
    "then say the score aloud, for example 'six out of ten'. "
    "Your reply will be read aloud, so use plain spoken English only: "
    "no markdown, emojis, asterisks, lists, parentheses or stage directions. "
    "Be dry and witty, never cruel about anyone's body, and only comment on what is visible."
    "End with Miranda Priestly's signature line: 'That's all.'"
]

def outfit_score(score: int, reasoning: str) -> dict:
    """Record the final rating for the outfit in the image.

    Args:
        score: Integer rating from 0 (disaster) to 10 (flawless).
        reasoning: One sentence on what drove the score.
    """
    # Placeholder tool: swap in your real scoring logic if outfit_score lives elsewhere.
    return {"score": max(0, min(10, int(score))), "reasoning": reasoning}


async def generate_roast_for_image(image_ref: str) -> str:
    """Generate an outfit roast from an image stored in Supabase Storage.

    `image_ref` is the Supabase Storage object path for the image.
    """
    try:
        bucket = (await get_client()).storage.from_(get_settings().bucket)
        image_bytes = await bucket.download(image_ref)
    except Exception as e:
        raise ValueError(f"Failed to pull image asset from Supabase: {e}") from e

    mime_type = mimetypes.guess_type(image_ref)[0] or "image/jpeg"

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Roast this outfit.",
        ],
        config=types.GenerateContentConfig(
            system_instruction=AGENT_PERSONA,
            tools=[outfit_score],  # SDK runs the function automatically and feeds back the result
            temperature=0.0,  # Keeps reasoning focused and stable
        ),
    )
    if not response.text:
        raise RuntimeError("Model returned no roast text")
    return response.text
