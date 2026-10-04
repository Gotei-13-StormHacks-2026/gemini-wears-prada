import os

# Centralize configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "PUT_API_KEY_HERE")  # Replace with your actual API key or set it as an environment variable

# Explicit list of origins allowed to cross the browser boundary
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite
    "http://localhost:3000",  # Create React App
]
