import os

# Centralize configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "closet-items")

# Explicit list of origins allowed to cross the browser boundary
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite
    "http://127.0.0.1:5173",  # Vite loopback address
    "http://localhost:3000",  # Create React App
    "http://127.0.0.1:3000",  # Create React App loopback address
]
