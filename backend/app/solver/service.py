import asyncio
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.cube.constants import SOLVED, ColorName, FaceId
from app.cube.facelets import build_facelet_state
from app.cube.legality import check_legal
from app.cube.moves import verify_solution
from app.solver.base import Solver, SolverFault

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class SolveResult:
    center_colors: dict[FaceId, ColorName]
    initial_state: str
    moves: list[str]


class SolveService:
    def __init__(self, solver: Solver, timeout_s: int) -> None:
        self._solver = solver
        self._timeout_s = timeout_s
        self._lock = asyncio.Lock()

    async def solve(self, faces: Mapping[str, Sequence[str]]) -> SolveResult:
        state, centers = build_facelet_state(faces)
        check_legal(state)
        if state == SOLVED:
            return SolveResult(centers, state, [])
        async with self._lock:
            moves = await asyncio.to_thread(self._solver.solve, state, self._timeout_s)
        if not verify_solution(state, moves):
            log.error("solver returned a solution that does not replay to solved")
            raise SolverFault("solution failed replay verification")
        return SolveResult(centers, state, moves)
