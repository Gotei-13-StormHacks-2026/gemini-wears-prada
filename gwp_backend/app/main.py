from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS
from app.routers import closet, vision
import uvicorn

app = FastAPI(title="Gemini Multimodal React Backend")

# Mount CORS settings globally
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints from routers
app.include_router(vision.router)
app.include_router(closet.router)

if __name__ == "__main__":

    # Local loopback server deployment targeting port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
