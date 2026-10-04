import logging
import random
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
from app.services.roast_service import analyze_item_image

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


def _response_data(response):
    return getattr(response, "data", response)


def _signed_url_from_response(response) -> str | None:
    data = _response_data(response)
    if isinstance(data, dict):
        return data.get("signedURL") or data.get("signedUrl")
    return getattr(data, "signed_url", None) or getattr(data, "signedURL", None)


def _to_item(record: dict, signed_urls: dict[str, str]) -> ItemRecord:
    return ItemRecord.model_validate(
        {**record, "image_url": signed_urls.get(record["image_ref"])}
    )


async def _signed_urls(image_refs: list[str]) -> dict[str, str]:
    settings = get_settings()
    client = await get_client()
    storage = client.storage.from_(settings.bucket)
    signed_urls: dict[str, str] = {}
    for image_ref in dict.fromkeys(image_refs):
        url = _signed_url_from_response(await storage.create_signed_url(image_ref, 3600))
        if url:
            signed_urls[image_ref] = url
    return signed_urls


async def create_item_upload(item: ItemUploadRequest) -> ItemUploadResponse:
    settings = get_settings()
    client = await get_client()
    image_ref = f"{uuid4()}.{_IMAGE_EXTENSIONS[item.content_type]}"
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
    client = await get_client()
    settings = get_settings()
    mime_type = next(
        (mime for mime, extension in _IMAGE_EXTENSIONS.items()
         if item.image_ref.lower().endswith(f".{extension}")),
        None,
    )
    if mime_type is None:
        raise ValueError("The uploaded image has an unsupported file type.")

    image_data = await client.storage.from_(settings.bucket).download(item.image_ref)
    metadata = await analyze_item_image(image_data, mime_type)
    if item.category is not None:
        metadata = metadata.model_copy(update={"category": item.category})

    record = ItemRecord(
        item_id=uuid4(),
        image_ref=item.image_ref,
        name=item.name,
        notes=item.notes,
        **metadata.model_dump(),
    )
    payload = record.model_dump(mode="json", exclude={"image_url"})
    response = await client.table(ITEMS).insert(payload).execute()
    saved = (response.data or [payload])[0]
    urls = await _signed_urls([item.image_ref])
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

    for outfit_id in affected_outfits:
        remaining = await client.table(OUTFIT_ITEMS).select("item_id").eq("outfit_id", outfit_id).limit(1).execute()
        if not remaining.data:
            await client.table(OUTFITS).delete().eq("outfit_id", outfit_id).execute()

    try:
        await client.storage.from_(settings.bucket).remove([image_ref])
    except Exception:
        logger.exception("Could not remove storage object %s", image_ref)


async def get_outfits() -> list[OutfitRecord]:
    client = await get_client()
    response = await (
        client.table(OUTFITS)
        .select("*, outfit_items(items(*))")
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
        items = [
            _to_item(link["items"], urls)
            for link in outfit.get("outfit_items", [])
            if link.get("items")
        ]
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
                {"outfit_id": outfit_id, "item_id": str(item_id)}
                for item_id in item_ids
            ]
        ).execute()
    except Exception:
        await client.table(OUTFITS).delete().eq("outfit_id", outfit_id).execute()
        raise
    return UUID(outfit_id)


async def create_outfit(outfit: OutfitCreate) -> UUID:
    if not outfit.item_ids:
        items = await get_items()
        if not items:
            raise ValueError("Add items to the closet before generating an outfit.")
        category_order = ("top", "bottom", "shoes", "outerwear", "accessory")
        selected = []
        for category in category_order:
            pool = [item for item in items if item.category == category]
            if pool:
                selected.append(random.choice(pool).item_id)
        outfit = OutfitCreate(name=outfit.name, item_ids=selected)
    return await _persist_outfit(outfit)


async def delete_outfit(outfit_id: UUID) -> None:
    client = await get_client()
    await client.table(OUTFITS).delete().eq("outfit_id", str(outfit_id)).execute()
