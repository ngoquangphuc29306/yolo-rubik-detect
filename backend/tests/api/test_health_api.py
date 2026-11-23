from fastapi.testclient import TestClient

from app.main import create_app
from app.solver.base import Solver
from tests.conftest import load_fixture

ALLOWED = {
    "schemaVersion", "status", "detectorMode", "visionReady", "solverReady",
    "modelVersion", "device", "error",
}  # fmt: skip


def test_health_body(real_solver: Solver) -> None:
    r = TestClient(create_app(solver=real_solver)).get("/health")
    assert r.status_code == 200
    assert r.json() == {
        "schemaVersion": 1,
        "status": "degraded",
        "detectorMode": "yolo",
        "visionReady": False,
        "solverReady": True,
        "error": "Vision is not available in this build.",
    }


def test_health_keys_match_frontend_fixture(real_solver: Solver) -> None:
    body = TestClient(create_app(solver=real_solver)).get("/health").json()
    assert set(body) <= ALLOWED
    assert set(body) == set(load_fixture("fixtures/health/model-unavailable.json"))
