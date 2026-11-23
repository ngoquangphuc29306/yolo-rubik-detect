from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol, get_args

import numpy as np

from app.cube.constants import COLOR_NAMES, ColorName


class ModelUnavailable(Exception):
    """The detection model cannot be used.

    `reason` is a short public string (safe for /health); `detail` is for the server log only.
    """

    def __init__(self, reason: str, detail: str | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or reason


@dataclass(frozen=True)
class Detection:
    color: ColorName
    confidence: float
    xyxy: tuple[float, float, float, float]
    class_id: int


class Detector(Protocol):
    def detect(self, image: np.ndarray) -> list[Detection]: ...


def class_map(names: Mapping[int, str]) -> dict[int, ColorName]:
    """Map model class ids to colours by NAME; the names must be exactly the six colours."""
    if sorted(names.values()) != sorted(COLOR_NAMES):
        raise ModelUnavailable(
            "The model's class names are not the six cube colours.",
            f"Model class names must be exactly {sorted(COLOR_NAMES)}, got {sorted(names.values())}",
        )
    valid = set(get_args(ColorName))
    return {int(i): n for i, n in names.items() if n in valid}  # type: ignore[misc]
