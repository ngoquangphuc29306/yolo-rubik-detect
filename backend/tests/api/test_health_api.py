from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.solver.base import Solver
from tests.conftest import load_fixture

ALLOWED = {
    "schemaVersion", "status", "detectorMode", "visionReady", "solverReady",
    "modelVersion", "device", "error",
}  # fmt: skip


def test_health_body(real_solver: Solver, tmp_path: Path) -> None:
    absent = tmp_path / "absent" / "best.pt"
    with TestClient(create_app(solver=real_solver)) as c:
        r = c.get("/health")
    assert r.status_code == 200
    assert r.json() == {
        "schemaVersion": 1,
        "status": "degraded",
        "detectorMode": "yolo",
        "visionReady": False,
        "solverReady": True,
        "error": f"Detection weights not found at {absent}",
    }


def test_health_keys_match_frontend_fixture(real_solver: Solver) -> None:
    with TestClient(create_app(solver=real_solver)) as c:
        body = c.get("/health").json()
    assert set(body) <= ALLOWED
    assert set(body) == set(load_fixture("fixtures/health/model-unavailable.json"))
