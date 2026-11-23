import asyncio
import json
import logging
import threading
import time
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

from app.api.scan_ws import locked_detect
from app.main import create_app
from app.schemas import ScanError, ScanFrameResult, ScanReady, WireQuality
from app.vision.detector import Detection

ORIGIN = {"Origin": "http://127.0.0.1:5173"}
SIZE = 192
COLORS = ["white", "yellow", "red", "orange", "blue", "green", "white", "red", "blue"]


class _Solver:
    def solve(self, *a: Any, **k: Any) -> Any:
        raise NotImplementedError


def nine_boxes(skip: int | None = None) -> list[Detection]:
    c = SIZE / 3
    out = []
    for i in range(9):
        if i == skip:
            continue
        r, col = divmod(i, 3)
        cx, cy = (col + 0.5) * c, (r + 0.5) * c
        out.append(
            Detection(COLORS[i], 0.9, (cx - 20, cy - 20, cx + 20, cy + 20), i % 6)
        )  # type: ignore[arg-type]
    return out


class Double:
    model_version = "double@abc"

    def __init__(self, dets: list[Detection] | None = None, delay: float = 0.0) -> None:
        self.dets = nine_boxes() if dets is None else dets
        self.delay = delay
        self.calls = 0
        self.active = 0
        self.overlap = False
        self.started = threading.Event()

    def detect(self, image: np.ndarray) -> list[Detection]:
        self.calls += 1
        self.started.set()
        self.active += 1
        if self.active > 1:
            self.overlap = True
        time.sleep(self.delay)
        self.active -= 1
        return self.dets


class Boom(Double):
    def detect(self, image: np.ndarray) -> list[Detection]:
        raise RuntimeError("secret-internal-path C:/x")


def jpeg(size: int = SIZE) -> bytes:
    img = np.full((size, size, 3), 127, np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def hello(ws: WebSocketTestSession, scan_id: str = "scan-123456") -> dict[str, Any]:
    ws.send_text(json.dumps({"type": "hello", "schemaVersion": 1, "scanId": scan_id}))
    return json.loads(ws.receive_text())  # type: ignore[no-any-return]


def client(det: Double | None) -> TestClient:
    return TestClient(create_app(solver=_Solver(), detector=det))  # type: ignore[arg-type]


def expect_close(ws: WebSocketTestSession, code: int) -> None:
    with pytest.raises(WebSocketDisconnect) as e:
        ws.receive_text()
    assert e.value.code == code


def test_hello_ready() -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        ready = hello(ws)
    assert ready == {
        "type": "ready",
        "schemaVersion": 1,
        "scanId": "scan-123456",
        "modelVersion": "double@abc",
        "imgsz": 640,
        "maxFrameBytes": 1048576,
        "maxFrameEdge": 1280,
    }
    ScanReady.model_validate(ready)


def test_frames_results_and_sequence() -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        for n in (1, 2, 3):
            ws.send_bytes(jpeg())
            r = json.loads(ws.receive_text())
            m = ScanFrameResult.model_validate(r)
            assert m.frameSeq == n and (m.width, m.height) == (SIZE, SIZE)
            assert len(r["cells"]) == 9 and r["grid"] == COLORS
            assert r["quality"] == {"valid": True}
            assert len(r["detections"]) == 9 and r["detections"][1]["classId"] == 1
            assert r["inferenceMs"] >= 0


def test_missing_cell_is_incomplete() -> None:
    d = Double(nine_boxes(skip=4))
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        ws.send_bytes(jpeg())
        r = json.loads(ws.receive_text())
    assert r["grid"] is None
    assert r["quality"] == {"valid": False, "reason": "INCOMPLETE"}
    assert r["cells"][4] == {"color": None, "confidence": None, "status": "missing"}


@pytest.mark.parametrize(
    "first",
    [
        json.dumps({"type": "frame"}),
        json.dumps({"type": "hello", "schemaVersion": 2, "scanId": "a"}),
        json.dumps({"type": "hello", "schemaVersion": 1, "scanId": ""}),
        json.dumps({"type": "hello", "schemaVersion": 1, "scanId": "x" * 65}),
        "not json",
    ],
)
def test_bad_first_message_closes_1008(first: str) -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        ws.send_text(first)
        expect_close(ws, 1008)
    assert d.calls == 0


def test_binary_first_message_closes_1008() -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        ws.send_bytes(jpeg())
        expect_close(ws, 1008)
    assert d.calls == 0


def test_text_after_hello_closes_1008() -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        ws.send_text("hi")
        expect_close(ws, 1008)
    assert d.calls == 0


def test_hello_timeout_closes_1008() -> None:
    d = Double()
    app = create_app(solver=_Solver(), detector=d)  # type: ignore[arg-type]
    app.state.hello_timeout_s = 0.1
    with TestClient(app) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        expect_close(ws, 1008)
    assert d.calls == 0


@pytest.mark.parametrize("headers", [{}, {"Origin": "http://evil.example"}])
def test_origin_rejected(headers: dict[str, str]) -> None:
    d = Double()
    with (
        client(d) as c,
        pytest.raises(WebSocketDisconnect) as e,
        c.websocket_connect("/ws/scan", headers=headers),
    ):
        pass
    assert e.value.code == 1008
    assert d.calls == 0


def test_oversize_and_invalid_frames_keep_socket_open() -> None:
    d = Double()
    with client(d) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        ws.send_bytes(b"\xff\xd8\xff" + b"0" * 1048577)
        e1 = json.loads(ws.receive_text())
        ws.send_bytes(b"not a jpeg")
        e2 = json.loads(ws.receive_text())
        ws.send_bytes(jpeg())
        ok = json.loads(ws.receive_text())
    assert e1["code"] == "FRAME_TOO_LARGE" and e1["retryable"] is True
    assert e2["code"] == "INVALID_FRAME" and e2["retryable"] is True
    for e in (e1, e2):
        ScanError.model_validate(e)
        assert "frameSeq" not in e
    assert ok["type"] == "frame_result" and ok["frameSeq"] == 3
    assert d.calls == 1


def test_detector_none_is_model_unavailable() -> None:
    with client(None) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        ws.send_text(json.dumps({"type": "hello", "schemaVersion": 1, "scanId": "s"}))
        err = json.loads(ws.receive_text())
        assert err["code"] == "MODEL_UNAVAILABLE" and err["retryable"] is False
        ScanError.model_validate(err)
        expect_close(ws, 1011)


def test_detector_exception_is_model_unavailable(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    with client(Boom()) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        ws.send_bytes(jpeg())
        raw = ws.receive_text()
        expect_close(ws, 1011)
    assert json.loads(raw)["code"] == "MODEL_UNAVAILABLE"
    assert "secret-internal" not in raw
    assert "secret-internal" not in caplog.text and "RuntimeError" in caplog.text


def test_connections_never_overlap_inference() -> None:
    d = Double(delay=0.2)
    results: list[dict[str, Any]] = []

    barrier = threading.Barrier(2, timeout=10)

    def run(c: TestClient) -> None:
        with c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
            hello(ws)
            barrier.wait()
            ws.send_bytes(jpeg())
            results.append(json.loads(ws.receive_text()))

    with client(d) as c:
        ts = [threading.Thread(target=run, args=(c,)) for _ in range(2)]
        for t in ts:
            t.start()
        for t in ts:
            t.join(10)
    assert not any(t.is_alive() for t in ts)
    assert len(results) == 2 and d.calls == 2
    assert d.overlap is False


def test_disconnect_during_processing_is_quiet(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    d = Double(delay=0.3)
    with client(d) as c:
        with c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
            hello(ws)
            ws.send_bytes(jpeg())
            assert d.started.wait(5)  # disconnect while detect is running
        time.sleep(0.6)
        with c.websocket_connect("/ws/scan", headers=ORIGIN) as ws2:
            hello(ws2)
            assert d.calls == 1  # the dropped client's frame ran exactly once
            ws2.send_bytes(jpeg())
            assert json.loads(ws2.receive_text())["type"] == "frame_result"
    assert d.calls == 2
    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]


def test_frame_bytes_never_logged(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    frame = jpeg()
    with client(Double()) as c, c.websocket_connect("/ws/scan", headers=ORIGIN) as ws:
        hello(ws)
        ws.send_bytes(frame)
        ws.receive_text()
    assert repr(frame[:16]) not in caplog.text
    assert "\\xff\\xd8" not in caplog.text


def test_cancel_mid_detect_keeps_lock_until_worker_returns() -> None:
    started, release = threading.Event(), threading.Event()

    class Gated:
        def detect(self, image: np.ndarray) -> list[Detection]:
            started.set()
            release.wait(10)
            return []

    async def scenario() -> tuple[bool, bool]:
        lock = asyncio.Lock()
        task = asyncio.create_task(
            locked_detect(lock, Gated(), np.zeros((3, 3, 3), np.uint8))
        )  # type: ignore[arg-type]
        while not started.is_set():
            await asyncio.sleep(0.01)
        task.cancel()
        await asyncio.sleep(0.1)
        held_while_running = lock.locked()
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await task
        return held_while_running, lock.locked()

    held, after = asyncio.run(scenario())
    assert held is True and after is False


def test_quality_reason_iff_invalid() -> None:
    WireQuality(valid=True)
    WireQuality(valid=False, reason="INCOMPLETE")
    with pytest.raises(ValueError):
        WireQuality(valid=False)
    with pytest.raises(ValueError):
        WireQuality(valid=True, reason="INCOMPLETE")
