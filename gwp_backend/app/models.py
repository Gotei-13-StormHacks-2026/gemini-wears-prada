from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


ItemCategory = Literal["top", "bottom", "outerwear", "shoes", "accessory"]


class ItemCreate(BaseModel):
    """Input for adding an item; image_ref identifies its Supabase Storage object."""

    image_ref: str = Field(min_length=1)
    name: str | None = None
    notes: str | None = None


class ItemMetadata(BaseModel):
    """Clothing attributes returned by image analysis."""

    category: ItemCategory
    primary_color: str = Field(min_length=1)
    secondary_color: str | None = None
    description: str = Field(min_length=1)


class ItemRecord(ItemMetadata):
    item_id: UUID = Field(default_factory=uuid4)
    image_ref: str = Field(min_length=1)
    image_url: str | None = None
    name: str | None = None
    notes: str | None = None
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OutfitCreate(BaseModel):
    """An empty item_ids list asks the backend to select items automatically."""

    name: str | None = None
    item_ids: list[UUID] = Field(default_factory=list)


class OutfitRecord(BaseModel):
    outfit_id: UUID = Field(default_factory=uuid4)
    name: str | None = None
    items: list[ItemRecord] = Field(min_length=1)
    overall_rating: int | None = Field(default=None, ge=0, le=10)
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))