from fastapi import APIRouter, Request

from app.config import Settings
from app.schemas import HealthResponse
from app.vision.state import VisionState

router = APIRouter()


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    vision: VisionState = request.app.state.vision
    det = vision.detector
    if det is not None:
        return HealthResponse(
            status="ok",
            detectorMode=settings.detector_mode,
            visionReady=True,
            solverReady=True,
            modelVersion=getattr(det, "model_version", None),
            device=getattr(det, "device", None),
        )
    return HealthResponse(
        status="degraded",
        detectorMode=settings.detector_mode,
        visionReady=False,
        solverReady=True,
        error=vision.error or "Vision model is not loaded.",
    )
