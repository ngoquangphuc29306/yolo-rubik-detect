import os
import threading
import warnings
from pathlib import Path
from types import ModuleType
from typing import Any

from app.cube.constants import FACE_OFFSET, FaceId
from app.cube.moves import parse_move
from app.solver.base import SolverFault, SolverTablesMissing, SolverTimeout

CACHE_ENV = "RUBIK_SOLVER_CACHE_DIR"
TABLE_FILES = ("transition.npz", "pruning_kociemba.npz")

# Library face order (U L F R B D) and the colour letter the library uses per home face.
LIBRARY_FACES: tuple[FaceId, ...] = ("U", "L", "F", "R", "B", "D")
FACE_TO_LETTER: dict[str, str] = {"U": "W", "F": "G", "R": "R", "D": "Y", "B": "B", "L": "O"}
LETTER_TO_FACE: dict[str, str] = {v: k for k, v in FACE_TO_LETTER.items()}


def default_cache_dir() -> Path:
    override = os.environ.get(CACHE_ENV)
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / ".solver-cache"


def to_library_repr(state: str) -> str:
    return "".join(
        FACE_TO_LETTER[c]
        for face in LIBRARY_FACES
        for c in state[FACE_OFFSET[face] : FACE_OFFSET[face] + 9]
    )


def from_library_repr(repr_: str) -> str:
    by_face = {face: repr_[i * 9 : i * 9 + 9] for i, face in enumerate(LIBRARY_FACES)}
    out = "".join(by_face[face] for face in FACE_OFFSET)
    return "".join(LETTER_TO_FACE[c] for c in out)


def _import_library() -> ModuleType:
    # cube_solver calls warnings.simplefilter("always") at import; contain that side effect.
    with warnings.catch_warnings():
        import cube_solver

        module: ModuleType = cube_solver
        return module


class CubeSolverAdapter:
    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._solver: Any = None
        self._lock = threading.Lock()

    def load(self) -> None:
        missing = [
            f for f in TABLE_FILES if not (self._cache_dir / "tables" / f).is_file()
        ]
        if missing:
            raise SolverTablesMissing(
                f"solver tables missing in {self._cache_dir / 'tables'} ({', '.join(missing)}); "
                "run: python -m app.solver.prepare"
            )
        cs = _import_library()
        previous = Path.cwd()
        os.chdir(self._cache_dir)
        try:
            with warnings.catch_warnings():
                self._solver = cs.Kociemba()
        finally:
            os.chdir(previous)

    def solve(self, state: str, timeout_s: int) -> list[str]:
        if self._solver is None:
            raise SolverFault("solver not loaded")
        cs = _import_library()
        with self._lock:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    result = self._solver.solve(
                        cs.Cube(repr=to_library_repr(state)), timeout=timeout_s
                    )
            except ValueError as exc:
                raise SolverFault(f"solver rejected state: {exc}") from exc
            terminated = bool(self._solver.terminated)
        if result is None:
            if terminated:
                raise SolverTimeout(f"no solution within {timeout_s}s")
            raise SolverFault("solver returned no solution without timing out")
        tokens = str(result).split()
        try:
            return [parse_move(t) for t in tokens]
        except ValueError as exc:
            raise SolverFault(str(exc)) from exc
