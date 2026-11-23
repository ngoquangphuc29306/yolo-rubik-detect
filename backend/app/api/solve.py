from fastapi import APIRouter, Request

from app.schemas import SolveRequest, SolveResponse
from app.solver.service import SolveService

router = APIRouter()


@router.post("/api/solve", response_model=SolveResponse)
async def solve(body: SolveRequest, request: Request) -> SolveResponse:
    service: SolveService = request.app.state.solve_service
    result = await service.solve(body.faces.model_dump())
    return SolveResponse(
        centerColors=result.center_colors,
        initialState=result.initial_state,
        moves=result.moves,
        moveCount=len(result.moves),
    )
