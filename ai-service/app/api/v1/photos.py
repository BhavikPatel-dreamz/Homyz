from fastapi import APIRouter, Depends, status
from core.security import verify_api_key
from models.photos import PhotoAnalysisRequest, PhotoAnalysisResponse
from services.photo_service import PhotoService, get_photo_service

router = APIRouter(tags=["Photo Categorization & Quality"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/analyze",
    response_model=PhotoAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze listing photos for room types, quality scoring, defects, and cover nomination",
)
async def analyze_photos(
    payload: PhotoAnalysisRequest,
    photo_service: PhotoService = Depends(get_photo_service),
) -> PhotoAnalysisResponse:
    """Evaluates image array for room categories, lighting/composition scores, blur/duplicates, and selects smart cover."""
    return await photo_service.analyze_photos(payload)
