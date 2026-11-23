from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol, get_args

import numpy as np

from app.cube.constants import COLOR_NAMES, ColorName


class ModelUnavailable(Exception):
    """The detection model cannot be used; the message is the reason."""


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
            f"Model class names must be exactly {sorted(COLOR_NAMES)}, got {sorted(names.values())}"
        )
    valid = set(get_args(ColorName))
    return {int(i): n for i, n in names.items() if n in valid}  # type: ignore[misc]
