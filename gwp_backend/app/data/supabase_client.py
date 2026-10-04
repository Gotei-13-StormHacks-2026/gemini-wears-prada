import os
import asyncio
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv
from supabase import AsyncClient, acreate_client

load_dotenv()


@dataclass(frozen=True)
class Settings:
    url: str
    key: str
    bucket: str


@lru_cache
def get_settings() -> Settings:
    missing = [name for name in ("SUPABASE_URL", "SUPABASE_KEY") if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    return Settings(
        url=os.environ["SUPABASE_URL"].rstrip("/"),
        key=os.environ["SUPABASE_KEY"],
        bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "closet-images"),
    )


_client: AsyncClient | None = None
_lock = asyncio.Lock()

async def get_client() -> AsyncClient:
    """Return the shared async Supabase client, creating it on first use."""
    global _client
    if _client is None:
        async with _lock:
            if _client is None:
                settings = get_settings()
                _client = await acreate_client(settings.url, settings.key)
    return _client
