"""Formerly known as roast_service.py."""
import requests
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

M0DEL_NAME = "gemini-3.8-flash"  # Fully eligible for the free tier
PROMPT = [
        "You are a fashion critic, a personality like Miranda Priestly from The Devil Wears Prada. "
        "You are to look at the fashion features provided in the image uploaded and roast this outfit in a funny manner, "
        "while providing constructive criticism and genuine feedback. "
        "You MUST run the `outfit_score` tool to get the rating, then write a short summary explaining it."]

async def generate_roast_for_image(image_ref: str) -> str:
    """Generate an outfit roast from an image stored in Supabase Storage.

    `image_ref` is the Supabase Storage object path/reference for the image.
    """
    
    try:
        # TODO: Resolve image_ref to image data using Supabase Storage.
        pass
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to pull image asset from Supabase: {str(e)}")

    # Create a request payload
    payload = {
        "model": M0DEL_NAME,
        "contents": [
            PROMPT,
            image_data
        ],
        "config": {
            "temperature": 0.0  # Keeps reasoning focused and stable
        }
    }

    # Send the request to the Gemini API
    response = await client.models.generate_content(**payload)

    return response.text