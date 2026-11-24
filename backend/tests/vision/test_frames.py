import cv2
import numpy as np
import pytest

from app.vision.frames import FrameError, decode_frame

MAX_BYTES = 1_000_000
MAX_EDGE = 1280


def jpeg(w: int, h: int, bgr: tuple[int, int, int] = (0, 0, 255), progressive: bool = False) -> bytes:
    img = np.full((h, w, 3), bgr, np.uint8)
    params = [cv2.IMWRITE_JPEG_PROGRESSIVE, 1] if progressive else []
    ok, buf = cv2.imencode(".jpg", img, params)
    assert ok
    return bytes(buf)


def code_of(data: bytes, max_bytes: int = MAX_BYTES) -> str:
    with pytest.raises(FrameError) as info:
        decode_frame(data, max_bytes, MAX_EDGE)
    return info.value.code


def patch_sof(data: bytes, w: int, h: int) -> bytes:
    i = data.index(b"\xff\xc0")
    return data[: i + 5] + h.to_bytes(2, "big") + w.to_bytes(2, "big") + data[i + 9 :]


def no_decode(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_: object, **__: object) -> None:
        raise AssertionError("imdecode must not be called")

    monkeypatch.setattr(cv2, "imdecode", boom)


def test_valid_decodes_with_colors() -> None:
    out = decode_frame(jpeg(640, 640), MAX_BYTES, MAX_EDGE)
    assert out.shape == (640, 640, 3) and out.dtype == np.uint8
    b, g, r = (int(v) for v in out.reshape(-1, 3).mean(axis=0))
    assert r > 200 and b < 60 and g < 60


def test_square_tolerance() -> None:
    assert decode_frame(jpeg(600, 610), MAX_BYTES, MAX_EDGE).shape == (610, 600, 3)
    assert code_of(jpeg(640, 480)) == "INVALID_FRAME"


def test_oversize_bytes_before_decode(monkeypatch: pytest.MonkeyPatch) -> None:
    no_decode(monkeypatch)
    assert code_of(jpeg(640, 640), max_bytes=100) == "FRAME_TOO_LARGE"


@pytest.mark.parametrize("data", [b"", b"hello world", bytes(range(256)) * 4])
def test_garbage_invalid(data: bytes) -> None:
    assert code_of(data) == "INVALID_FRAME"


def test_png_invalid() -> None:
    ok, rgb = cv2.imencode(".png", np.zeros((64, 64, 3), np.uint8))
    ok2, rgba = cv2.imencode(".png", np.zeros((64, 64, 4), np.uint8))
    assert ok and ok2
    assert code_of(bytes(rgb)) == "INVALID_FRAME"
    assert code_of(bytes(rgba)) == "INVALID_FRAME"


def test_grayscale_invalid() -> None:
    ok, buf = cv2.imencode(".jpg", np.zeros((64, 64), np.uint8))
    assert ok
    assert code_of(bytes(buf)) == "INVALID_FRAME"


def test_edge_too_large() -> None:
    assert code_of(jpeg(1300, 1300)) == "FRAME_TOO_LARGE"


def test_bomb_header_rejected_without_decode(monkeypatch: pytest.MonkeyPatch) -> None:
    data = patch_sof(jpeg(64, 64), 60000, 60000)
    no_decode(monkeypatch)
    assert code_of(data) == "FRAME_TOO_LARGE"


def test_zero_dimension_invalid() -> None:
    assert code_of(patch_sof(jpeg(64, 64), 0, 64)) == "INVALID_FRAME"


def test_truncated_invalid() -> None:
    data = jpeg(64, 64)
    assert code_of(data[:2]) == "INVALID_FRAME"
    assert code_of(data[:3]) == "INVALID_FRAME"
    assert code_of(data[: data.index(b"\xff\xc0") + 6]) == "INVALID_FRAME"


def test_progressive_accepted() -> None:
    data = jpeg(320, 320, progressive=True)
    assert b"\xff\xc2" in data
    assert decode_frame(data, MAX_BYTES, MAX_EDGE).shape == (320, 320, 3)
