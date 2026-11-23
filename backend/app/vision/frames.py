"""Safe decoding of untrusted JPEG frames: header limits are checked before any pixel decode."""

from typing import Literal

import cv2
import numpy as np

FrameErrorCode = Literal["FRAME_TOO_LARGE", "INVALID_FRAME"]

_SOF = {0xC0, 0xC1, 0xC2}
_NO_LENGTH = {0x01, 0xD8, 0xD9, *range(0xD0, 0xD8)}
_SQUARE_TOLERANCE = 0.02


class FrameError(Exception):
    def __init__(self, code: FrameErrorCode, message: str) -> None:
        super().__init__(message)
        self.code: FrameErrorCode = code
        self.message = message


def _invalid(message: str) -> FrameError:
    return FrameError("INVALID_FRAME", message)


def _read_sof(data: bytes) -> tuple[int, int, int]:
    """Return (height, width, components) from the first SOF0/1/2 segment without decoding pixels."""
    n = len(data)
    i = 2  # after SOI
    while True:
        if i >= n or data[i] != 0xFF:
            raise _invalid("Malformed JPEG header.")
        while i < n and data[i] == 0xFF:  # fill bytes
            i += 1
        if i >= n:
            raise _invalid("Truncated JPEG header.")
        marker = data[i]
        i += 1
        if marker == 0x00:
            raise _invalid("Malformed JPEG header.")
        if marker in _NO_LENGTH:
            continue
        if marker == 0xDA:
            raise _invalid("JPEG has no supported frame header.")
        if i + 2 > n:
            raise _invalid("Truncated JPEG header.")
        length = int.from_bytes(data[i : i + 2], "big")
        if length < 2 or i + length > n:
            raise _invalid("Truncated JPEG header.")
        if marker in _SOF:
            if length < 8:
                raise _invalid("Malformed JPEG frame header.")
            height = int.from_bytes(data[i + 3 : i + 5], "big")
            width = int.from_bytes(data[i + 5 : i + 7], "big")
            return height, width, data[i + 7]
        if 0xC3 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            raise _invalid("Unsupported JPEG encoding.")
        i += length


def decode_frame(data: bytes, max_bytes: int, max_edge: int) -> np.ndarray:
    if len(data) > max_bytes:
        raise FrameError("FRAME_TOO_LARGE", "Frame exceeds the size limit.")
    if not data.startswith(b"\xff\xd8\xff"):
        raise _invalid("Frame is not a JPEG image.")
    height, width, components = _read_sof(data)
    if components != 3:
        raise _invalid("Frame must be a three-channel colour JPEG.")
    if width == 0 or height == 0:
        raise _invalid("Frame has an empty dimension.")
    if width > max_edge or height > max_edge:
        raise FrameError("FRAME_TOO_LARGE", "Frame dimensions exceed the limit.")
    if abs(width - height) > _SQUARE_TOLERANCE * max(width, height):
        raise _invalid("Frame must be square.")
    try:
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    except Exception:  # noqa: BLE001 - untrusted input: no decoder error may escape
        raise _invalid("Frame could not be decoded.") from None
    if image is None or image.shape != (height, width, 3):
        raise _invalid("Frame could not be decoded.")
    return image
