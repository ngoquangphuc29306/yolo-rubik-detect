import copy
import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.cube.moves import MOVE_TOKENS, verify_solution
from app.main import create_app
from app.solver.base import Solver, SolverTablesMissing, SolverTimeout
from tests.conftest import load_fixture

ENVELOPE_KEYS = {"code", "message", "retryable"}
JSON_HEADERS = {"content-type": "application/json"}


class Double:
    def __init__(self, result: list[str] | Exception) -> None:
        self.result = result

    def solve(self, state: str, timeout_s: int) -> list[str]:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
def client(real_solver: Solver) -> TestClient:
    return TestClient(create_app(solver=real_solver))


def _req(name: str) -> Any:
    return copy.deepcopy(load_fixture(f"fixtures/solve/{name}.request.json"))


def test_solved_matches_fixture(client: TestClient) -> None:
    r = client.post("/api/solve", json=_req("solved"))
    assert r.status_code == 200
    assert r.json() == load_fixture("fixtures/solve/solved.response.json")


def test_scramble_a(client: TestClient) -> None:
    r = client.post("/api/solve", json=_req("scramble-a"))
    assert r.status_code == 200
    body = r.json()
    exp = load_fixture("fixtures/solve/scramble-a.response.json")
    assert body["schemaVersion"] == 1
    assert body["initialState"] == exp["initialState"]
    assert body["centerColors"] == exp["centerColors"]
    assert body["moveCount"] == len(body["moves"]) > 0
    assert all(m in MOVE_TOKENS for m in body["moves"])
    assert verify_solution(body["initialState"], body["moves"])
    assert set(body) == {"schemaVersion", "centerColors", "initialState", "moves", "moveCount"}


def test_duplicate_center(client: TestClient) -> None:
    req = _req("solved")
    req["faces"]["R"][4] = "white"
    r = client.post("/api/solve", json=req)
    assert r.status_code == 422
    assert r.json() == load_fixture("fixtures/solve/duplicate-center.error.json")


def test_twisted_corner(client: TestClient) -> None:
    req = _req("solved")
    f = req["faces"]
    f["U"][8], f["R"][0], f["F"][2] = "red", "green", "white"
    r = client.post("/api/solve", json=req)
    assert r.status_code == 422
    assert r.json() == load_fixture("fixtures/solve/invalid-cube-state.error.json")


def test_count_mismatch(client: TestClient) -> None:
    req = _req("solved")
    req["faces"]["U"][0] = "red"
    r = client.post("/api/solve", json=req)
    assert r.status_code == 422
    assert r.json()["error"] == {
        "code": "COLOR_COUNT_MISMATCH",
        "message": "Each color must appear exactly nine times. Check the scan or scan again.",
        "retryable": True,
    }


def test_rotated_face_is_illegal(client: TestClient) -> None:
    req = _req("scramble-a")
    u = req["faces"]["U"]
    req["faces"]["U"] = [u[6], u[3], u[0], u[7], u[4], u[1], u[8], u[5], u[2]]
    r = client.post("/api/solve", json=req)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_CUBE_STATE"


def _mut(fn: Any) -> Any:
    req = _req("solved")
    fn(req)
    return req


MALFORMED: list[Any] = [
    [],
    _mut(lambda r: r.pop("faces")),
    _mut(lambda r: r.update(extra=1)),
    _mut(lambda r: r.update(schemaVersion=2)),
    _mut(lambda r: r.update(schemaVersion=True)),
    _mut(lambda r: r.update(schemaVersion=False)),
    _mut(lambda r: r.update(schemaVersion="1")),
    _mut(lambda r: r.update(schemaVersion=1.0)),
    _mut(lambda r: r.pop("schemaVersion")),
    _mut(lambda r: r["faces"]["U"].pop()),
    _mut(lambda r: r["faces"]["U"].append("white")),
    _mut(lambda r: r["faces"]["U"].__setitem__(0, "White")),
    _mut(lambda r: r["faces"]["U"].__setitem__(0, " white")),
    _mut(lambda r: r["faces"].update(X=["white"] * 9)),
    _mut(lambda r: r["faces"].pop("B")),
]


def _assert_shape_error(r: Any) -> None:
    assert r.status_code == 422
    assert set(r.json()) == {"error"}
    err = r.json()["error"]
    assert set(err) == ENVELOPE_KEYS
    assert err["code"] == "INVALID_FACE_SHAPE"
    assert err["retryable"] is False
    assert err["message"] == "The solve request is not a valid schema version 1 cube."


@pytest.mark.parametrize("body", MALFORMED)
def test_malformed_bodies(client: TestClient, body: Any) -> None:
    _assert_shape_error(client.post("/api/solve", json=body))


def test_not_json(client: TestClient) -> None:
    _assert_shape_error(client.post("/api/solve", content="not json", headers=JSON_HEADERS))


def test_schema_version_rejects_bool_and_string(client: TestClient) -> None:
    faces = json.dumps(_req("solved")["faces"])
    for raw in ("true", "false", '"1"', "1.0", "2"):
        body = f'{{"schemaVersion": {raw}, "faces": {faces}}}'
        _assert_shape_error(client.post("/api/solve", content=body, headers=JSON_HEADERS))


def test_solver_timeout_503() -> None:
    c = TestClient(create_app(solver=Double(SolverTimeout("slow"))))
    r = c.post("/api/solve", json=_req("scramble-a"))
    assert r.status_code == 503
    assert r.json() == {
        "error": {
            "code": "SOLVER_TIMEOUT",
            "message": "The solver took too long. Please try again.",
            "retryable": True,
        }
    }


def test_solver_fault_500() -> None:
    c = TestClient(create_app(solver=Double(["R"])))
    r = c.post("/api/solve", json=_req("scramble-a"))
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal solver error"}


def test_unexpected_exception_returns_500() -> None:
    c = TestClient(create_app(solver=Double(RuntimeError("boom"))), raise_server_exceptions=False)
    r = c.post("/api/solve", json=_req("scramble-a"))
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal solver error"}


def test_solve_relabelled_scheme(client: TestClient) -> None:
    perm = {
        "white": "red",
        "red": "blue",
        "blue": "yellow",
        "yellow": "orange",
        "orange": "green",
        "green": "white",
    }
    req = _req("scramble-a")
    req["faces"] = {f: [perm[c] for c in g] for f, g in req["faces"].items()}
    base = load_fixture("fixtures/solve/scramble-a.response.json")
    r = client.post("/api/solve", json=req)
    assert r.status_code == 200
    body = r.json()
    assert body["centerColors"] == {f: perm[c] for f, c in base["centerColors"].items()}
    assert body["initialState"] == base["initialState"]
    assert verify_solution(body["initialState"], body["moves"])


def test_missing_tables_fail_startup(tmp_path: Path) -> None:
    app = create_app(Settings("yolo", tmp_path, 10))
    with pytest.raises(SolverTablesMissing), TestClient(app):
        pass
