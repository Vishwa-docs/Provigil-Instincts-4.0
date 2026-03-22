"""Router for VLM-based visual inspection analysis endpoints."""

from fastapi import APIRouter, UploadFile, File

from app.services.vlm_service import analyze_image

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/analyze")
async def analyze_meter_image(file: UploadFile = File(...)):
    """Upload an image/video of a meter installation for AI analysis.

    Returns analysis of connection quality, loose terminals, corrosion, etc.
    Powered by VLM inference for visual defect detection.
    """
    contents = await file.read()
    result = await analyze_image(contents, file.filename or "upload")
    return result
