from pathlib import Path

import pytest

from app.config import ConfigError, load_settings
from app.solver.cube_solver_adapter import default_cache_dir


def test_defaults() -> None:
    s = load_settings({})
    assert s.detector_mode == "yolo"
    assert s.solver_cache_dir == default_cache_dir()
    assert s.solver_timeout_s == 10


def test_overrides() -> None:
    s = load_settings(
        {
            "RUBIK_DETECTOR_MODE": "yolo",
            "RUBIK_SOLVER_CACHE_DIR": "x",
            "RUBIK_SOLVER_TIMEOUT_S": "3",
        }
    )
    assert s.solver_cache_dir == Path("x")
    assert s.solver_timeout_s == 3


@pytest.mark.parametrize("mode", ["fixture", "", "YOLO", "other"])
def test_bad_mode(mode: str) -> None:
    with pytest.raises(ConfigError):
        load_settings({"RUBIK_DETECTOR_MODE": mode})


@pytest.mark.parametrize("t", ["0", "-1", "1.5", "abc", ""])
def test_bad_timeout(t: str) -> None:
    with pytest.raises(ConfigError):
        load_settings({"RUBIK_SOLVER_TIMEOUT_S": t})
