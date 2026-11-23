import math
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.solver.cube_solver_adapter import CACHE_ENV, default_cache_dir

DEFAULT_TIMEOUT_S = 10
BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = BACKEND_DIR / "weights" / "best.pt"
DEFAULT_ORIGINS: tuple[str, ...] = ("http://127.0.0.1:5173", "http://localhost:5173")


class ConfigError(Exception):
    """Invalid runtime configuration."""


@dataclass(frozen=True)
class Settings:
    detector_mode: Literal["yolo"]
    solver_cache_dir: Path
    solver_timeout_s: int
    model_path: Path = DEFAULT_MODEL_PATH
    confidence: float = 0.4
    imgsz: int = 640
    device: str = "cpu"
    max_frame_bytes: int = 1048576
    max_frame_edge: int = 1280
    allowed_origins: tuple[str, ...] = DEFAULT_ORIGINS


def _positive_int(env: Mapping[str, str], name: str, default: int) -> int:
    raw = env.get(name)
    if raw is None:
        return default
    if raw.isascii() and raw.isdigit() and int(raw) > 0:
        return int(raw)
    raise ConfigError(f"{name} must be a positive integer")


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    mode = env.get("RUBIK_DETECTOR_MODE", "yolo")
    if mode != "yolo":
        raise ConfigError("RUBIK_DETECTOR_MODE must be 'yolo'")

    cache = env.get(CACHE_ENV)
    cache_dir = Path(cache) if cache else default_cache_dir()

    raw = env.get("RUBIK_SOLVER_TIMEOUT_S")
    if raw is None:
        timeout = DEFAULT_TIMEOUT_S
    elif raw.isascii() and raw.isdigit() and int(raw) > 0:
        timeout = int(raw)
    else:
        raise ConfigError("RUBIK_SOLVER_TIMEOUT_S must be a positive integer")

    model = env.get("RUBIK_MODEL_PATH")
    if model is None:
        model_path = DEFAULT_MODEL_PATH
    else:
        if not model.strip():
            raise ConfigError("RUBIK_MODEL_PATH must not be empty")
        model_path = BACKEND_DIR / Path(model)
        if not model_path.is_absolute():
            raise ConfigError("RUBIK_MODEL_PATH must be a plain relative or absolute path")

    raw_conf = env.get("RUBIK_CONFIDENCE")
    confidence = 0.4
    if raw_conf is not None:
        try:
            confidence = float(raw_conf)
        except ValueError:
            raise ConfigError("RUBIK_CONFIDENCE must be a number in (0, 1)") from None
        if not math.isfinite(confidence) or not 0 < confidence < 1:
            raise ConfigError("RUBIK_CONFIDENCE must be a number in (0, 1)")

    imgsz = _positive_int(env, "RUBIK_IMGSZ", 640)
    if imgsz % 32:
        raise ConfigError("RUBIK_IMGSZ must be a positive multiple of 32")

    device = env.get("RUBIK_DEVICE", "cpu")
    if not re.fullmatch(r"cpu|cuda:[0-9]+", device):
        raise ConfigError("RUBIK_DEVICE must be 'cpu' or 'cuda:N'")

    max_bytes = _positive_int(env, "RUBIK_MAX_FRAME_BYTES", 1048576)
    max_edge = _positive_int(env, "RUBIK_MAX_FRAME_EDGE", 1280)

    raw_origins = env.get("RUBIK_ALLOWED_ORIGINS")
    origins = DEFAULT_ORIGINS
    if raw_origins is not None:
        origins = tuple(o.strip() for o in raw_origins.split(",") if o.strip())
        if not origins:
            raise ConfigError("RUBIK_ALLOWED_ORIGINS must not be empty")

    return Settings(
        "yolo",
        cache_dir,
        timeout,
        model_path,
        confidence,
        imgsz,
        device,
        max_bytes,
        max_edge,
        origins,
    )
