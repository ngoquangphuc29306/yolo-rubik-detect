"""Record real /ws/scan server messages. Run from backend/: uv run python -m tests.crosscheck.record_ws_messages

A scripted detector double drives the real app. `inferenceMs` is a measured wall time, so the recorder
normalises it to 0 to keep the fixture deterministic; nothing else is altered.
"""

import json
from typing import Any

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import create_app
from app.vision.detector import Detection
from tests.conftest import REPO_ROOT

OUT = REPO_ROOT / "fixtures" / "vision" / "ws-messages.json"
ORIGIN = {"Origin": "http://127.0.0.1:5173"}
SCAN_ID = "fixture-scan"
SIZE = 192
COLORS = ["white", "yellow", "red", "orange", "blue", "green", "white", "red", "blue"]


class _Solver:
    def solve(self, *a: Any, **k: Any) -> Any:
        raise NotImplementedError


class ScriptedDetector:
    model_version = "fixture-double@0"

    def __init__(self) -> None:
        self.dets: list[Detection] = []

    def detect(self, image: np.ndarray) -> list[Detection]:
        return self.dets


def boxes(skip: int | None = None) -> list[Detection]:
    c = SIZE / 3
    out: list[Detection] = []
    for i in range(9):
        if i == skip:
            continue
        r, col = divmod(i, 3)
        cx, cy = (col + 0.5) * c, (r + 0.5) * c
        out.append(
            Detection(COLORS[i], 0.9, (cx - 20, cy - 20, cx + 20, cy + 20), i % 6)  # type: ignore[arg-type]
        )
    return out


def jpeg() -> bytes:
    ok, buf = cv2.imencode(".jpg", np.full((SIZE, SIZE, 3), 127, np.uint8))
    assert ok
    return buf.tobytes()


def _norm(msg: dict[str, Any]) -> dict[str, Any]:
    if "inferenceMs" in msg:
        msg["inferenceMs"] = 0
    return msg


def record() -> list[dict[str, Any]]:
    det = ScriptedDetector()
    app = create_app(solver=_Solver(), detector=det)  # type: ignore[arg-type]
    out: list[dict[str, Any]] = []

    def add(case_id: str, raw: str) -> None:
        out.append({"id": case_id, "message": _norm(json.loads(raw))})

    with TestClient(app) as client, client.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        ws.send_text(json.dumps({"type": "hello", "schemaVersion": 1, "scanId": SCAN_ID}))
        add("ready", ws.receive_text())

        det.dets = boxes()
        ws.send_bytes(jpeg())
        add("frame_result_valid", ws.receive_text())

        det.dets = boxes(skip=4)
        ws.send_bytes(jpeg())
        add("frame_result_missing_cell", ws.receive_text())

        amb = boxes()
        c4 = amb[4]
        amb.append(Detection("red", 0.85, c4.xyxy, 2))
        det.dets = amb
        ws.send_bytes(jpeg())
        add("frame_result_ambiguous_cell", ws.receive_text())

        ws.send_bytes(b"not a jpeg")
        add("error_invalid_frame", ws.receive_text())

        ws.send_bytes(b"\xff\xd8\xff" + b"0" * 1048577)
        add("error_frame_too_large", ws.receive_text())
    return out


def main() -> None:
    doc = {
        "schema": "ws-messages/1",
        "generatedBy": "backend/tests/crosscheck/record_ws_messages.py",
        "messages": record(),
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
