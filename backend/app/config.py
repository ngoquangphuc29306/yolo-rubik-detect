import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.solver.cube_solver_adapter import CACHE_ENV, default_cache_dir

DEFAULT_TIMEOUT_S = 10


class ConfigError(Exception):
    """Invalid runtime configuration."""


@dataclass(frozen=True)
class Settings:
    detector_mode: Literal["yolo"]
    solver_cache_dir: Path
    solver_timeout_s: int


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

    return Settings("yolo", cache_dir, timeout)
