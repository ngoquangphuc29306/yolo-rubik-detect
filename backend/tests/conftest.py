import json
from pathlib import Path
from typing import Any

import pytest

from app.solver.base import SolverTablesMissing
from app.solver.cube_solver_adapter import CubeSolverAdapter, default_cache_dir

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_fixture(rel_path: str) -> Any:
    return json.loads((REPO_ROOT / rel_path).read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def real_solver() -> CubeSolverAdapter:
    adapter = CubeSolverAdapter(default_cache_dir())
    try:
        adapter.load()
    except SolverTablesMissing as exc:
        pytest.fail(str(exc), pytrace=False)
    return adapter
