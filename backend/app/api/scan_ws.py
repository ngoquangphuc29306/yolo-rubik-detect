"""`/ws/scan`: one square JPEG in, one per-cell detection result out, sequentially per connection."""

import asyncio
import json
import logging
import time

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.schemas import (
    ScanError,
    ScanFrameResult,
    ScanHello,
    ScanReady,
    WireCell,
    WireDetection,
    WireQuality,
)
from app.vision.detector import Detection, Detector
from app.vision.frames import FrameError, decode_frame
from app.vision.grid import analyze
from app.vision.state import VisionState

logger = logging.getLogger(__name__)
router = APIRouter()

HELLO_TIMEOUT_S = 5.0


async def _send(ws: WebSocket, msg: BaseModel) -> bool:
    """Send a message; a vanished client is not an error (the result is dropped)."""
    try:
        body = msg.model_dump(mode="json")
        quality = body.get("quality")
        if quality is not None and quality["reason"] is None:
            del quality["reason"]  # contract: `reason` is omitted when valid
        await ws.send_text(json.dumps(body))
    except (WebSocketDisconnect, RuntimeError):
        return False
    return True


async def _close(ws: WebSocket, code: int, reason: str = "") -> None:
    try:
        await ws.close(code=code, reason=reason)
    except (WebSocketDisconnect, RuntimeError):
        pass


async def _hello(ws: WebSocket, timeout: float) -> ScanHello | None:
    try:
        msg = await asyncio.wait_for(ws.receive(), timeout)
    except TimeoutError:
        return None
    text = msg.get("text")
    if msg.get("type") != "websocket.receive" or text is None:
        return None
    try:
        return ScanHello.model_validate_json(text)
    except ValidationError:
        return None


@router.websocket("/ws/scan")
async def scan(ws: WebSocket) -> None:
    app = ws.app
    settings: Settings = app.state.settings
    if ws.headers.get("origin") not in settings.allowed_origins:
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        hello = await _hello(ws, app.state.hello_timeout_s)
        if hello is None:
            await _close(ws, 1008, "Expected a valid hello message.")
            return
        vision: VisionState = app.state.vision
        detector: Detector | None = vision.detector
        if detector is None:
            await _send(
                ws,
                ScanError(
                    code="MODEL_UNAVAILABLE",
                    message="Vision model is not available.",
                    retryable=False,
                ),
            )
            await _close(ws, 1011)
            return
        ready = ScanReady(
            scanId=hello.scanId,
            modelVersion=str(getattr(detector, "model_version", "")),
            imgsz=settings.imgsz,
            maxFrameBytes=settings.max_frame_bytes,
            maxFrameEdge=settings.max_frame_edge,
        )
        if not await _send(ws, ready):
            return
        await _frames(ws, hello.scanId, detector, settings)
    except WebSocketDisconnect:
        return


async def locked_detect(
    lock: asyncio.Lock, detector: Detector, image: np.ndarray
) -> tuple[list[Detection], float]:
    """Run one inference under the global lock; returns (detections, inference ms).

    The lock is held until the worker thread has returned, even if this task is cancelled.
    """
    async with lock:
        start = time.perf_counter()
        task = asyncio.ensure_future(asyncio.to_thread(detector.detect, image))
        try:
            detections = await asyncio.shield(task)
        except asyncio.CancelledError:
            await asyncio.wait({task})
            if not task.cancelled():
                task.exception()  # mark retrieved; the result is discarded
            raise
        return detections, (time.perf_counter() - start) * 1000


async def _frames(
    ws: WebSocket, scan_id: str, detector: Detector, settings: Settings
) -> None:
    lock: asyncio.Lock = ws.app.state.inference_lock
    seq = 0
    while True:
        msg = await ws.receive()
        if msg["type"] == "websocket.disconnect":
            return
        data = msg.get("bytes")
        if data is None:
            await _close(ws, 1008, "Only binary frames are accepted after hello.")
            return
        seq += 1
        try:
            image = await asyncio.to_thread(
                decode_frame, data, settings.max_frame_bytes, settings.max_frame_edge
            )
        except FrameError as exc:
            logger.info("scan %s frame %d rejected: %s", scan_id[:8], seq, exc.code)
            if not await _send(
                ws, ScanError(code=exc.code, message=exc.message, retryable=True)
            ):
                return
            continue
        try:
            detections, ms = await locked_detect(lock, detector, image)
        except Exception as exc:  # noqa: BLE001 - never leak detector internals to the client
            logger.error("scan %s detector failed: %s", scan_id[:8], type(exc).__name__)
            await _send(
                ws,
                ScanError(
                    code="MODEL_UNAVAILABLE",
                    message="Vision model failed.",
                    retryable=False,
                ),
            )
            await _close(ws, 1011)
            return
        height, width = image.shape[:2]
        analysis = analyze(detections, width)
        result = ScanFrameResult(
            scanId=scan_id,
            frameSeq=seq,
            width=width,
            height=height,
            detections=[
                WireDetection(
                    classId=d.class_id,
                    color=d.color,
                    confidence=d.confidence,
                    xyxy=list(d.xyxy),
                )
                for d in detections
            ],
            cells=[
                WireCell(color=c.color, confidence=c.confidence, status=c.status)
                for c in analysis.cells
            ],
            grid=list(analysis.grid) if analysis.grid is not None else None,
            quality=WireQuality(valid=analysis.valid, reason=analysis.reason),
            inferenceMs=ms,
        )
        logger.info(
            "scan %s frame %d valid=%s reason=%s %.0fms",
            scan_id[:8],
            seq,
            analysis.valid,
            analysis.reason,
            ms,
        )
        if not await _send(ws, result):
            return
