"""Record real backend /api/solve responses. Run from backend/: uv run python -m tests.crosscheck.record_backend_solutions"""

import json
from typing import Any

from fastapi.testclient import TestClient

from app.cube.constants import ColorName, FaceId
from app.cube.facelets import faces_from_state
from app.main import create_app
from tests.conftest import REPO_ROOT, load_fixture

OUT = REPO_ROOT / "fixtures" / "solve" / "backend-solutions.json"
CENTERS: dict[FaceId, ColorName] = {
    "U": "white",
    "R": "red",
    "F": "green",
    "D": "yellow",
    "L": "orange",
    "B": "blue",
}


def build_requests() -> list[tuple[str, dict[str, Any]]]:
    cases: list[tuple[str, dict[str, Any]]] = []
    seqs = load_fixture("fixtures/engine/move-sequences.json")["sequences"]
    for i, seq in enumerate(seqs):
        faces = faces_from_state(seq["states"][-1], CENTERS)
        cases.append((f"engine-seq-{i:02d}", {"schemaVersion": 1, "faces": faces}))
    for name in ("solved", "scramble-a"):
        cases.append((name, load_fixture(f"fixtures/solve/{name}.request.json")))
    return cases


def main() -> None:
    cases: list[dict[str, Any]] = []
    with TestClient(create_app()) as client:
        for case_id, request in build_requests():
            r = client.post("/api/solve", json=request)
            assert r.status_code == 200, (case_id, r.text)
            cases.append({"id": case_id, "request": request, "response": r.json()})
    doc = {
        "schema": "backend-solutions/1",
        "generatedBy": "backend/tests/crosscheck/record_backend_solutions.py",
        "solver": "cube-solver 1.1.4",
        "cases": cases,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(cases)} cases to {OUT}")


if __name__ == "__main__":
    main()
