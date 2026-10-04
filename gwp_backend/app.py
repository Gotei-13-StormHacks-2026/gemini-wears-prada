from google import genai
from google.genai import types
from PIL import Image


img = Image.open("path_to_your_image.jpg")  # Replace with the path to your image file
client = genai.Client(api_key="YOUR_API_KEY_HERE")  # Replace with Your actual API key

def main():
    print("Analyzing vehicle request...")
    response = client.models.generate_content(
        model='gemini-3.8-flash', # Fully eligible for the free tier
        contents=[
            "Look at the fashion features provided in the image uploaded and roast this outfit in a funny manner. "
            "You MUST run the `outfit_score` tool to get the rating, then write a short summary explaining it.",
            img
        ],
        config=types.GenerateContentConfig(
            # tools=[calculate_car_score], # Give Gemini your function as a tool
            temperature=0.0              # Keeps reasoning focused and stable
        )
    )

    print("Response:", response.text)

main()