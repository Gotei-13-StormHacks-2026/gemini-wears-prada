from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.data.models import ItemCreate, ItemRecord, ItemUploadRequest, ItemUploadResponse, OutfitCreate
from app.services import closet_service

router = APIRouter(
    prefix="/api/closet",
    tags=["closet-management"]
)

# --- ITEM ENDPOINTS ---

@router.post("/items/upload-url", response_model=ItemUploadResponse)
async def create_item_upload_url(upload: ItemUploadRequest):
    try:
        return await closet_service.create_item_upload(upload)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

# 1. GET ALL ITEMS
@router.get("/items")
async def get_items():
    """
    Skeleton endpoint to fetch all items stored in the closet.
    """
    items = await closet_service.get_items()
    return {
        "status": "success",
        "message": "Skeleton endpoint: Retrieved all closet items.",
        "data": items
    }

# 2. ADD ITEM TO CLOSET
@router.post("/items", response_model=ItemRecord)
async def add_item(item: ItemCreate):
    try:
        return await closet_service.add_item(item)
    except ServerError as error:
        raise HTTPException(status_code=502, detail="The AI labeling service is temporarily unavailable.") from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="The AI labeling service is temporarily unavailable.") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

# 3. DELETE ITEM FROM CLOSET
@router.delete("/items/{item_id}")
async def delete_item(item_id: UUID):
    """
    Skeleton endpoint for deleting a closet item.
    """
    await closet_service.delete_item(item_id)
    return {
        "status": "success",
        "message": f"Skeleton endpoint: Item {item_id} deleted successfully.",
        "item_id": str(item_id)
    }


# --- OUTFIT ENDPOINTS ---

# 4. GET ALL OUTFITS
@router.get("/outfits")
async def get_outfits():
    """
    Skeleton endpoint to fetch all saved outfits.
    """
    outfits = await closet_service.get_outfits()
    return {
        "status": "success",
        "message": "Skeleton endpoint: Retrieved all outfits.",
        "data": outfits
    }

# 5. CREATE OUTFIT COMBINATION (Manual Save)
@router.post("/outfits")
async def create_outfit(outfit: OutfitCreate | None = None):
    """
    Skeleton endpoint for pairing items into an outfit.
    """
    outfit_id = await closet_service.create_outfit(outfit or OutfitCreate())
    return {
        "status": "success",
        "message": f"Skeleton endpoint: Outfit {outfit_id} created successfully.",
        "outfit_id": str(outfit_id)
    }

# 6. BUILD OUTFIT (AI / Automation Engine)
@router.post("/outfits/build")
async def build_outfit():
    """
    Skeleton endpoint for automatically generating/building an outfit combination.
    """
    outfit_id = await closet_service.create_outfit(OutfitCreate())
    return {
        "status": "success",
        "message": f"Skeleton endpoint: Outfit {outfit_id} built successfully.",
        "outfit_id": str(outfit_id)
    }

# 7. DELETE OUTFIT 
@router.delete("/outfits/{outfit_id}")
async def delete_outfit(outfit_id: UUID):
    """
    Skeleton endpoint for removing a generated outfit combination.
    """
    await closet_service.delete_outfit(outfit_id)
    return {
        "status": "success",
        "message": f"Skeleton endpoint: Outfit {outfit_id} deleted successfully.",
        "outfit_id": str(outfit_id)
    }
