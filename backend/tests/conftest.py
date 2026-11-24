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


@pytest.fixture(autouse=True)
def _no_real_model(
    request: pytest.FixtureRequest, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ordinary tests never load the real checkpoint; only `model`-marked ones may."""
    if request.node.get_closest_marker("model") is None:
        monkeypatch.setenv("RUBIK_MODEL_PATH", str(tmp_path / "absent" / "best.pt"))
