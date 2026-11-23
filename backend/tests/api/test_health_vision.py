from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import load_settings
from app.main import create_app
from app.solver.base import Solver
from app.vision.detector import Detection
from tests.conftest import load_fixture


class Double:
    model_version = "yolo26s_rubik_v1@93b727eca123"
    device = "cpu"

    def detect(self, image: np.ndarray) -> list[Detection]:
        return []


def test_health_ok_with_injected_detector(real_solver: Solver) -> None:
    with TestClient(create_app(solver=real_solver, detector=Double())) as c:
        r = c.get("/health")
    assert r.status_code == 200
    assert r.json() == {
        "schemaVersion": 1,
        "status": "ok",
        "detectorMode": "yolo",
        "visionReady": True,
        "solverReady": True,
        "modelVersion": "yolo26s_rubik_v1@93b727eca123",
        "device": "cpu",
    }


def test_missing_weights_degrade_health_but_solve_works(
    real_solver: Solver, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    settings = load_settings({"RUBIK_MODEL_PATH": str(tmp_path / "missing.pt")})
    with TestClient(create_app(settings, solver=real_solver)) as c:
        body = c.get("/health").json()
        assert body["status"] == "degraded"
        assert body["visionReady"] is False
        assert body["solverReady"] is True
        assert body["error"] == "Detection weights not found."
        assert str(tmp_path) not in body["error"]
        assert (
            "\\" not in body["error"]
            and "/" not in body["error"]
            and ":" not in body["error"]
        )
        assert str(tmp_path) in caplog.text
        assert set(body) == {
            "schemaVersion", "status", "detectorMode", "visionReady", "solverReady", "error",
        }  # fmt: skip
        r = c.post(
            "/api/solve", json=load_fixture("fixtures/solve/solved.request.json")
        )
        assert r.status_code == 200
