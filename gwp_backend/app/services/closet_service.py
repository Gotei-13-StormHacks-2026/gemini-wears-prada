import logging
from uuid import UUID, uuid4

from app.data.models import (
    ItemCreate,
    ItemRecord,
    ItemUploadRequest,
    ItemUploadResponse,
    OutfitCreate,
    OutfitRecord,
)
from app.data.supabase_client import get_client, get_settings
from app.services.extraction import extract_outfit_as_stickers
from app.services.outfit_algorithm import outfit_algo

ITEMS = "items"
OUTFITS = "outfits"
OUTFIT_ITEMS = "outfit_items"
logger = logging.getLogger(__name__)

_IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_ALLOWED_EXTENSIONS = set(_IMAGE_EXTENSIONS.values()) | {"jpeg"}


def _response_data(response):
    return getattr(response, "data", response)


def _to_item(record: dict, signed_urls: dict[str, str]) -> ItemRecord:
    return ItemRecord.model_validate(
        {**record, "image_url": signed_urls.get(record["image_ref"])}
    )


async def _signed_urls(image_refs: list[str]) -> dict[str, str]:
    """Map storage path -> signed URL using one batched call. Failures degrade to no URL."""
    paths = list(dict.fromkeys(image_refs))
    if not paths:
        return {}
    settings = get_settings()
    client = await get_client()
    try:
        results = _response_data(
            await client.storage.from_(settings.bucket).create_signed_urls(paths, 3600)
        )
    except Exception:
        logger.exception("Could not create signed URLs")
        return {}

    urls: dict[str, str] = {}
    for entry in results:
        signed = entry.get("signedURL") or entry.get("signedUrl")
        if entry.get("error") or not signed:
            continue
        if signed.startswith("/"):  # some client versions return a relative path
            signed = f"{settings.url}/storage/v1{signed}"
        urls[entry["path"]] = signed
    return urls


# --------------------------------------------------------------------------- items


async def create_item_upload(item: ItemUploadRequest) -> ItemUploadResponse:
    extension = _IMAGE_EXTENSIONS.get(item.content_type)
    if extension is None:
        raise ValueError(f"Unsupported content type: {item.content_type}")

    settings = get_settings()
    client = await get_client()
    image_ref = f"{uuid4()}.{extension}"
    response = await client.storage.from_(settings.bucket).create_signed_upload_url(image_ref)
    data = _response_data(response)
    token = data.get("token") if isinstance(data, dict) else getattr(data, "token", None)
    if not token:
        raise RuntimeError("Supabase did not return a signed upload token.")
    return ItemUploadResponse(image_ref=image_ref, token=token)


async def get_items() -> list[ItemRecord]:
    client = await get_client()
    response = await client.table(ITEMS).select("*").order("created_at", desc=True).execute()
    records = response.data or []
    urls = await _signed_urls([record["image_ref"] for record in records])
    return [_to_item(record, urls) for record in records]


async def add_item(item: ItemCreate) -> ItemRecord:
    """Cut out and label the uploaded photo, store the record, and return it."""
    extension = item.image_ref.rsplit(".", 1)[-1].lower() if "." in item.image_ref else ""
    if extension not in _ALLOWED_EXTENSIONS:
        raise ValueError("The uploaded image has an unsupported file type.")

    record = await extract_outfit_as_stickers(item)
    category = getattr(item, "category", None)
    if category is not None:  # an explicit category from the user beats the model's guess
        record = record.model_copy(update={"category": category})

    client = await get_client()
    payload = record.model_dump(mode="json", exclude={"image_url"})
    response = await client.table(ITEMS).insert(payload).execute()
    saved = (response.data or [payload])[0]
    urls = await _signed_urls([saved["image_ref"]])
    return _to_item(saved, urls)


async def delete_item(item_id: UUID) -> None:
    client = await get_client()
    settings = get_settings()
    found = await client.table(ITEMS).select("image_ref").eq("item_id", str(item_id)).execute()
    if not found.data:
        return

    image_ref = found.data[0]["image_ref"]
    links = await client.table(OUTFIT_ITEMS).select("outfit_id").eq("item_id", str(item_id)).execute()
    affected_outfits = {row["outfit_id"] for row in links.data or []}
    await client.table(ITEMS).delete().eq("item_id", str(item_id)).execute()

    # An OutfitRecord needs at least one item, so remove outfits that are now empty.
    for outfit_id in affected_outfits:
        remaining = await client.table(OUTFIT_ITEMS).select("item_id").eq("outfit_id", outfit_id).limit(1).execute()
        if not remaining.data:
            await client.table(OUTFITS).delete().eq("outfit_id", outfit_id).execute()

    try:
        await client.storage.from_(settings.bucket).remove([image_ref])
    except Exception:
        logger.exception("Could not remove storage object %s", image_ref)


# --------------------------------------------------------------------------- outfits


async def get_outfits() -> list[OutfitRecord]:
    client = await get_client()
    response = await (
        client.table(OUTFITS)
        .select("*, outfit_items(position, items(*))")
        .order("created_at", desc=True)
        .execute()
    )
    outfits = response.data or []
    item_records = [
        link["items"]
        for outfit in outfits
        for link in outfit.get("outfit_items", [])
        if link.get("items")
    ]
    urls = await _signed_urls([record["image_ref"] for record in item_records])

    records: list[OutfitRecord] = []
    for outfit in outfits:
        links = sorted(outfit.get("outfit_items", []), key=lambda link: link.get("position", 0))
        items = [_to_item(link["items"], urls) for link in links if link.get("items")]
        if items:
            records.append(
                OutfitRecord.model_validate(
                    {
                        "outfit_id": outfit["outfit_id"],
                        "name": outfit.get("name"),
                        "items": items,
                        "overall_rating": outfit.get("overall_rating"),
                        "is_favorite": outfit.get("is_favorite", False),
                        "created_at": outfit["created_at"],
                    }
                )
            )
    return records


async def _persist_outfit(outfit: OutfitCreate) -> UUID:
    item_ids = list(dict.fromkeys(outfit.item_ids))
    if not item_ids:
        raise ValueError("An outfit needs at least one item.")

    client = await get_client()
    found = await client.table(ITEMS).select("item_id").in_("item_id", [str(item_id) for item_id in item_ids]).execute()
    found_ids = {row["item_id"] for row in found.data or []}
    missing = set(map(str, item_ids)) - found_ids
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
        items = await get_items()
        if not items:
            raise ValueError("Add items to the closet before generating an outfit.")
        draft = await outfit_algo(items)
        outfit = OutfitCreate(name=outfit.name or draft.name, item_ids=draft.item_ids)
    return await _persist_outfit(outfit)


async def generate_outfit(dress_code: str | None = None, season: str | None = None) -> UUID:
    """Generate a new combination from the closet via outfit_algo and persist it.

    Both criteria are optional. dress_code: casual, smart casual, business, formal, athletic
    (aliases like "work" or "gym" work too). season: spring, summer, fall/autumn, winter.
    """
    items = await get_items()
    if not items:
        raise ValueError("Add items to the closet before generating an outfit.")
    draft = await outfit_algo(items, dress_code=dress_code, season=season)
    return await _persist_outfit(draft)


async def delete_outfit(outfit_id: UUID) -> None:
    client = await get_client()
    await client.table(OUTFITS).delete().eq("outfit_id", str(outfit_id)).execute()