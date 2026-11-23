"""Drive /ws/scan through a REAL uvicorn server and a real WebSocket client.

TestClient bypasses uvicorn, so it cannot notice a missing WebSocket library.
"""

import json
import threading
from collections.abc import Iterator
from typing import Any

import pytest
import uvicorn
from websockets.exceptions import InvalidStatus
from websockets.sync.client import ClientConnection, connect
from websockets.typing import Origin

from app.config import load_settings
from app.main import create_app
from tests.api.test_scan_ws import Double, _Solver, jpeg

ORIGIN = "http://127.0.0.1:5173"


def _factory() -> Any:
    return create_app(load_settings(), solver=_Solver(), detector=Double())


@pytest.fixture(scope="module")
def port() -> Iterator[int]:
    config = uvicorn.Config(
        _factory,
        factory=True,
        host="127.0.0.1",
        port=0,
        log_level="warning",
        lifespan="on",
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        thread.join(0)
        for _ in range(500):
            if server.started or not thread.is_alive():
                break
            thread.join(0.01)
        assert server.started, "uvicorn did not start"
        yield int(server.servers[0].sockets[0].getsockname()[1])
    finally:
        server.should_exit = True
        thread.join(10)


def _open(port: int, origin: str | None = ORIGIN) -> ClientConnection:
    return connect(f"ws://127.0.0.1:{port}/ws/scan", origin=Origin(origin) if origin else None, open_timeout=5)


def _hello(ws: ClientConnection) -> dict[str, Any]:
    ws.send(json.dumps({"type": "hello", "schemaVersion": 1, "scanId": "scan-123456"}))
    return json.loads(ws.recv(timeout=5))  # type: ignore[no-any-return]


def test_uvicorn_has_a_websocket_implementation() -> None:
    config = uvicorn.Config(_factory, factory=True, port=0)
    config.load()
    assert config.ws_protocol_class is not None


def test_hello_ready(port: int) -> None:
    with _open(port) as ws:
        assert _hello(ws) == {
            "type": "ready",
            "schemaVersion": 1,
            "scanId": "scan-123456",
            "modelVersion": "double@abc",
            "imgsz": 640,
            "maxFrameBytes": 1048576,
            "maxFrameEdge": 1280,
        }


def test_frame_result(port: int) -> None:
    with _open(port) as ws:
        _hello(ws)
        ws.send(jpeg())
        r = json.loads(ws.recv(timeout=5))
    assert r["type"] == "frame_result" and r["frameSeq"] == 1
    assert len(r["cells"]) == 9 and r["grid"] is not None
    assert r["quality"] == {"valid": True}


@pytest.mark.parametrize("origin", [None, "http://evil.example"])
def test_bad_origin_rejected_with_403(port: int, origin: str | None) -> None:
    with pytest.raises(InvalidStatus) as e:
        _open(port, origin)
    assert e.value.response.status_code == 403


def test_non_jpeg_frame_is_an_error_and_socket_stays_usable(port: int) -> None:
    with _open(port) as ws:
        _hello(ws)
        ws.send(b"not a jpeg")
        err = json.loads(ws.recv(timeout=5))
        assert err["code"] == "INVALID_FRAME"
        ws.send(jpeg())
        assert json.loads(ws.recv(timeout=5))["type"] == "frame_result"
