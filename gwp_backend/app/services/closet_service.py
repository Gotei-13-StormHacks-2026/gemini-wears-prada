from uuid import UUID, uuid4

from app.data.models import ItemCreate, ItemRecord, OutfitCreate, OutfitRecord
from app.data.supabase_client import get_client, get_settings
from app.services.extraction import extract_outfit_as_stickers 
from app.services.outfit_algorithm import outfit_algo 

async def get_items() -> list[ItemRecord]:
    """Retrieve all item records from the database by email or user ID (if applicable)"""
    client = await get_client()
    response = await client.table(ITEMS).select("*").order("created_at", desc=True).execute()
    rows = response.data or []
    urls = await _signed_urls([r["image_ref"] for r in rows])
    return [_to_item(r, urls) for r in rows]

async def add_item(item: ItemCreate) -> UUID:
    """Given an ItemCreate object, extract outfit from image, store it in the database, and return its UUID"""
    record = await extract_outfit_as_stickers(item) # calls extract_outfit_as_stickers which returns ItemRecord object with item_id populated
    client = await get_client()
    await client.table(ITEMS).insert(record.model_dump(mode="json", exclude={"image_url"})).execute()
    return record.item_id
    return uuid4()

async def delete_item(item_id: UUID) -> None:
    """Delete an item record by its UUID"""
    client = await get_client()

    found = await client.table(ITEMS).select("image_ref").eq("item_id", str(item_id)).execute()
    if not found.data:
        return
    image_ref = found.data[0]["image_ref"]

    links = await client.table(OUTFIT_ITEMS).select("outfit_id").eq("item_id", str(item_id)).execute()
    affected = {row["outfit_id"] for row in links.data or []}

    # outfit_items rows cascade-delete with the item (see schema.sql).
    await client.table(ITEMS).delete().eq("item_id", str(item_id)).execute()

    # An OutfitRecord needs at least one item, so remove outfits that are now empty.
    for outfit_id in affected:
        remaining = await client.table(OUTFIT_ITEMS).select("item_id").eq("outfit_id", outfit_id).limit(1).execute()
        if not remaining.data:
            await client.table(OUTFITS).delete().eq("outfit_id", outfit_id).execute()

    # Best-effort image cleanup; the DB row is already gone.
    try:
        await client.storage.from_(get_settings().bucket).remove([image_ref])
    except Exception:
        logger.exception("Could not remove storage object %s", image_ref)

async def get_outfits() -> list[OutfitRecord]:
    """Retrieve all outfit records from the database by email or user ID (if applicable)"""
    client = await get_client()
    response = (
        await client.table(OUTFITS)
        .select("*, outfit_items(position, items(*))")
        .order("created_at", desc=True)
        .execute()
    )
    outfits = response.data or []

    all_refs = [
        link["items"]["image_ref"]
        for outfit in outfits
        for link in outfit["outfit_items"]
        if link.get("items")
    ]
    urls = await _signed_urls(all_refs)

    records: list[OutfitRecord] = []
    for outfit in outfits:
        links = sorted(outfit["outfit_items"], key=lambda link: link["position"])
        items = [_to_item(link["items"], urls) for link in links if link.get("items")]
        if not items:
            continue  # orphaned outfit; can't satisfy OutfitRecord.items min_length=1
        records.append(
            OutfitRecord.model_validate(
                {
                    "outfit_id": outfit["outfit_id"],
                    "name": outfit["name"],
                    "items": items,
                    "overall_rating": outfit["overall_rating"],
                    "is_favorite": outfit["is_favorite"],
                    "created_at": outfit["created_at"],
                }
            )
        )
    return records

async def _persist_outfit(outfit: OutfitCreate) -> UUID:
    item_ids = list(dict.fromkeys(outfit.item_ids))  # de-dupe, keep order
    if not item_ids:
        raise ValueError("An outfit needs at least one item")

    client = await get_client()
    found = await client.table(ITEMS).select("item_id").in_("item_id", [str(i) for i in item_ids]).execute()
    missing = set(map(str, item_ids)) - {row["item_id"] for row in found.data or []}
    if missing:
        raise LookupError(f"Unknown item ids: {', '.join(sorted(missing))}")

    created = await client.table(OUTFITS).insert({"name": outfit.name}).execute()
    outfit_id = created.data[0]["outfit_id"]
    try:
        await client.table(OUTFIT_ITEMS).insert(
            [
                {"outfit_id": outfit_id, "item_id": str(item_id), "position": position}
                for position, item_id in enumerate(item_ids)
            ]
        ).execute()
    except Exception:
        # No multi-statement transactions via PostgREST, so undo manually.
        await client.table(OUTFITS).delete().eq("outfit_id", outfit_id).execute()
        raise
    return UUID(outfit_id)

async def create_outfit(outfit: OutfitCreate) -> UUID:
    """Create an outfit from item_ids; an empty list falls back to automatic selection."""
    if not outfit.item_ids:
        draft = await outfit_algo(await get_items())
        outfit = OutfitCreate(name=outfit.name or draft.name, item_ids=draft.item_ids)
    return await _persist_outfit(outfit)

async def generate_outfit() -> UUID:
    """Generate a new combination from the closet via outfit_algo and persist it."""
    items = await get_items()
    if not items:
        raise ValueError("Add some items to the closet before generating an outfit")
    return await _persist_outfit(await outfit_algo(items))

async def delete_outfit(outfit_id: UUID) -> None:
    """Delete an outfit; its outfit_items rows cascade."""
    client = await get_client()
    await client.table(OUTFITS).delete().eq("outfit_id", str(outfit_id)).execute()
