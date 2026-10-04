from uuid import UUID, uuid4

from app.data.models import ItemCreate, ItemRecord, OutfitCreate, OutfitRecord


async def get_items() -> list[ItemRecord]:
    return []


async def add_item(item: ItemCreate) -> UUID:
    return uuid4()


async def delete_item(item_id: UUID) -> None:
    pass


async def get_outfits() -> list[OutfitRecord]:
    return []


async def create_outfit(outfit: OutfitCreate) -> UUID:
    return uuid4()


async def delete_outfit(outfit_id: UUID) -> None:
    pass