import random
import statistics
import time

import pytest
from fastapi.testclient import TestClient

from app.cube.constants import SOLVED, ColorName, FaceId
from app.cube.facelets import build_facelet_state, faces_from_state
from app.cube.moves import MOVE_TOKENS, apply_moves, verify_solution
from app.main import create_app
from tests.conftest import load_fixture

CENTERS: dict[FaceId, ColorName] = {
    "U": "white",
    "R": "red",
    "F": "green",
    "D": "yellow",
    "L": "orange",
    "B": "blue",
}


def test_recorded_solutions_replay() -> None:
    doc = load_fixture("fixtures/solve/backend-solutions.json")
    assert doc["schema"] == "backend-solutions/1"
    assert len(doc["cases"]) == 42
    for case in doc["cases"]:
        response = case["response"]
        state, centers = build_facelet_state(case["request"]["faces"])
        assert state == response["initialState"], case["id"]
        assert centers == response["centerColors"], case["id"]
        assert response["moveCount"] == len(response["moves"]), case["id"]
        assert verify_solution(state, response["moves"]), case["id"]


@pytest.mark.slow
def test_300_seeded_states() -> None:
    rng = random.Random(20261123)
    times: list[float] = []
    with TestClient(create_app()) as client:
        for n in range(300):
            state = apply_moves(SOLVED, [rng.choice(MOVE_TOKENS) for _ in range(rng.randint(20, 30))])
            request = {"schemaVersion": 1, "faces": faces_from_state(state, CENTERS)}
            t0 = time.perf_counter()
            r = client.post("/api/solve", json=request)
            times.append(time.perf_counter() - t0)
            assert r.status_code == 200, (n, r.text)
            body = r.json()
            assert body["initialState"] == state
            assert verify_solution(state, body["moves"]), n
    q = statistics.quantiles(times, n=100)
    print(f"solve time s: p50={q[49]:.3f} p95={q[94]:.3f} max={max(times):.3f}")
