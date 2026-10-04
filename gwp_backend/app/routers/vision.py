from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from app.services.roast_service import generate_roast_for_image

# Create a dedicated router for everything relating to vision processing
router = APIRouter(
    prefix="/api/vision",
    tags=["vision"]
)

@router.post("/roast-image")
async def analyze_uploaded_image(image_path: str):

    try:        
        # Dispatch the payload with image_url directly to your service layer
        ai_response = await generate_roast_for_image(image_path=image_path)
        
        return {
            "status": "success",
            "roast_text": ai_response
        }
        
    except Exception as e:
        # Prevent completely crashing the server thread on upstream SDK failures
        raise HTTPException(status_code=500, detail=f"Gemini processing error: {str(e)}")
