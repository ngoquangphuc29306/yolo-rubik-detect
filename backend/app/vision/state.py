from dataclasses import dataclass

from app.vision.detector import Detector


@dataclass(frozen=True)
class VisionState:
    detector: Detector | None
    error: str | None
