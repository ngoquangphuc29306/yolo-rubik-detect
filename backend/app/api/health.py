from fastapi import APIRouter, Request

from app.config import Settings
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    # The process only serves once the solver is loaded; Phase 2 has no vision.
    return HealthResponse(
        status="degraded",
        detectorMode=settings.detector_mode,
        visionReady=False,
        solverReady=True,
        error="Vision is not available in this build.",
    )
