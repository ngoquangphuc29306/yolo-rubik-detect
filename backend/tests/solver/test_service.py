import asyncio
from typing import Any

import pytest

from app.cube.facelets import CubeInputError
from app.cube.legality import IllegalCubeError
from app.cube.moves import verify_solution
from app.solver.base import Solver, SolverFault, SolverTimeout
from app.solver.service import SolveService
from tests.conftest import load_fixture


class Recorder:
    def __init__(self, result: list[str] | Exception) -> None:
        self.result = result
        self.calls = 0

    def solve(self, state: str, timeout_s: int) -> list[str]:
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _faces(name: str) -> Any:
    return load_fixture(f"fixtures/solve/{name}.request.json")["faces"]


def _run(service: SolveService, faces: Any) -> Any:
    return asyncio.run(service.solve(faces))


def test_solved_short_circuits_without_calling_solver() -> None:
    rec = Recorder(["R"])
    result = _run(SolveService(rec, 5), _faces("solved"))
    assert result.moves == []
    assert rec.calls == 0


def test_illegal_cube_raises() -> None:
    faces = _faces("solved")
    # Twist the URF corner: U8, R0, F2 become red, green, white.
    faces["U"][8], faces["R"][0], faces["F"][2] = "red", "green", "white"
    rec = Recorder(["R"])
    with pytest.raises(IllegalCubeError):
        _run(SolveService(rec, 5), faces)
    assert rec.calls == 0


def test_duplicate_center_raises_input_error() -> None:
    faces = _faces("solved")
    faces["R"][4] = "white"
    with pytest.raises(CubeInputError) as exc:
        _run(SolveService(Recorder([]), 5), faces)
    assert exc.value.code == "DUPLICATE_CENTER"


def test_unverified_solution_is_a_fault() -> None:
    with pytest.raises(SolverFault):
        _run(SolveService(Recorder(["R"]), 5), _faces("scramble-a"))


def test_timeout_propagates() -> None:
    with pytest.raises(SolverTimeout):
        _run(SolveService(Recorder(SolverTimeout("slow")), 5), _faces("scramble-a"))


def test_real_solver_scramble_verifies(real_solver: Solver) -> None:
    result = _run(SolveService(real_solver, 10), _faces("scramble-a"))
    assert result.moves
    assert verify_solution(result.initial_state, result.moves)
