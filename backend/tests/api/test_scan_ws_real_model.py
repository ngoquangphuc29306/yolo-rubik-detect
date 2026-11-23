"""Real-checkpoint protocol check for /ws/scan (run explicitly: `uv run pytest -m model`).

Validates that the real model, through the real app and WebSocket, yields well-formed `frame_result`s for the
shared vision fixtures. Grid validity is NOT asserted: these are not guide-aligned crops.
"""

import json
from typing import Any

import cv2
import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_MODEL_PATH
from app.main import create_app
from app.schemas import ScanFrameResult, ScanReady
from tests.conftest import REPO_ROOT

ORIGIN = {"Origin": "http://127.0.0.1:5173"}
COLORS = {"white", "yellow", "red", "orange", "blue", "green"}
SIZE = 640


class _NullSolver:
    def solve(self, state: str, timeout_s: int) -> list[str]:
        raise NotImplementedError


def _square_jpeg(path: Any) -> bytes:
    img = cv2.imread(str(path))
    assert img is not None, path
    h, w = img.shape[:2]
    side = min(h, w)
    y0, x0 = (h - side) // 2, (w - side) // 2
    crop = img[y0 : y0 + side, x0 : x0 + side]
    ok, buf = cv2.imencode(".jpg", cv2.resize(crop, (SIZE, SIZE)))
    assert ok
    return buf.tobytes()


@pytest.mark.model
def test_real_model_frame_results_over_websocket() -> None:
    if not DEFAULT_MODEL_PATH.is_file():
        pytest.fail(
            "place the trained checkpoint at backend/weights/best.pt", pytrace=False
        )
    images = sorted((REPO_ROOT / "fixtures" / "vision").glob("*.jpg"))
    assert len(images) >= 3
    with TestClient(create_app(solver=_NullSolver())) as client, client.websocket_connect(
        "/ws/scan", headers=ORIGIN
    ) as ws:
        ws.send_text(
            json.dumps({"type": "hello", "schemaVersion": 1, "scanId": "real-model-1"})
        )
        ready = json.loads(ws.receive_text())
        ScanReady.model_validate(ready)
        assert ready["modelVersion"].endswith("@93b727eca123")
        for seq, path in enumerate(images, start=1):
            ws.send_bytes(_square_jpeg(path))
            raw = json.loads(ws.receive_text())
            msg = ScanFrameResult.model_validate(raw)  # strict: all keys, nine cells
            assert set(raw) == {
                "type", "schemaVersion", "scanId", "frameSeq", "width", "height",
                "detections", "cells", "grid", "quality", "inferenceMs",
            }, path.name
            assert msg.frameSeq == seq
            assert (msg.width, msg.height) == (SIZE, SIZE)
            assert len(msg.cells) == 9
            assert msg.quality.valid == (msg.grid is not None), path.name
            assert msg.inferenceMs > 0
            for d in msg.detections:
                assert d.color in COLORS
                x1, y1, x2, y2 = d.xyxy
                assert 0 <= x1 < x2 <= SIZE and 0 <= y1 < y2 <= SIZE, path.name
