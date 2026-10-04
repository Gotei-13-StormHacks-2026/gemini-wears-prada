from uuid import UUID, uuid4

from app.data.models import ItemCreate, ItemRecord, OutfitCreate, OutfitRecord

# Retrieve all item records from the database by email or user ID (if applicable)
async def get_items() -> list[ItemRecord]:
    return []

# Given an ItemCreate object, extract outfit from image, store it in the database, and return its UUID
async def add_item(item: ItemCreate) -> UUID:
    # calls extract_outfit_as_stickers which returns ItemRecord object with item_id populated
    return uuid4()

# Delete an item from the closet by its UUID
async def delete_item(item_id: UUID) -> None:
    pass

# Retrieve all outfit records from the database by email or user ID (if applicable)
async def get_outfits() -> list[OutfitRecord]:
    return []

# Given an array of item IDs, create a new outfit record and return its UUID
async def create_outfit(outfit: OutfitCreate) -> UUID:
    return uuid4()

# Given nothing or a set of criteria (dress code, season) generate a new outfit combination via outfit_algo and return its UUID 
async def generate_outfit() -> UUID:
    # calls outfit_algo, which returns OutfitCreate object with item_ids list populated
    return uuid4()

# Delete an outfit record by its UUID
async def delete_outfit(outfit_id: UUID) -> None:
    pass