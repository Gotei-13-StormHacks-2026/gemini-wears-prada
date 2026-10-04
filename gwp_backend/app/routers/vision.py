import logging

from fastapi import APIRouter, HTTPException
from app.data.models import RoastImageRequest
from app.services.agent_service import generate_roast_for_image

logger = logging.getLogger(__name__)

# Create a dedicated router for everything relating to vision processing
router = APIRouter(
    prefix="/api/vision",
    tags=["vision"]
)

@router.post("/roast-image")
async def analyze_uploaded_image(request: RoastImageRequest):
    try:        
        ai_response = await generate_roast_for_image(image_ref=request.image_ref)
        
        return {
            "status": "success",
            "roast_text": ai_response
        }
        
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Fit Check roast generation failed")
        raise HTTPException(status_code=502, detail="Fit Check analysis failed.") from error
