import os
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


def test_create_app_fails_startup_when_tables_missing(tmp_path: Path) -> None:
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app
    from app.solver.base import SolverTablesMissing

    app = create_app(Settings("yolo", tmp_path, 10))
    with (
        pytest.raises(SolverTablesMissing, match=r"python -m app\.solver\.prepare"),
        TestClient(app),
    ):
        pass


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_vision_defaults() -> None:
    s = load_settings({})
    assert s.confidence == 0.4
    assert s.imgsz == 640
    assert s.device == "cpu"
    assert s.max_frame_bytes == 1048576
    assert s.max_frame_edge == 1280
    assert s.allowed_origins == ("http://127.0.0.1:5173", "http://localhost:5173")


def test_model_path_default_is_absolute_and_cwd_independent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = load_settings({}).model_path
    monkeypatch.chdir(tmp_path)
    after = load_settings({}).model_path
    assert before == after
    assert after.is_absolute()
    assert after == BACKEND_DIR / "weights" / "best.pt"
    assert after.parts[-3:] == ("backend", "weights", "best.pt")


def test_relative_model_path_resolves_against_backend(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    s = load_settings({"RUBIK_MODEL_PATH": "weights/other.pt"})
    assert s.model_path == BACKEND_DIR / "weights" / "other.pt"


def test_absolute_model_path_kept(tmp_path: Path) -> None:
    p = tmp_path / "m.pt"
    assert load_settings({"RUBIK_MODEL_PATH": str(p)}).model_path == p


def test_vision_overrides() -> None:
    s = load_settings(
        {
            "RUBIK_CONFIDENCE": "0.25",
            "RUBIK_IMGSZ": "320",
            "RUBIK_DEVICE": "cuda:1",
            "RUBIK_MAX_FRAME_BYTES": "2048",
            "RUBIK_MAX_FRAME_EDGE": "640",
            "RUBIK_ALLOWED_ORIGINS": " http://a:1 , http://b:2 ,",
        }
    )
    assert s.confidence == 0.25
    assert s.imgsz == 320
    assert s.device == "cuda:1"
    assert s.max_frame_bytes == 2048
    assert s.max_frame_edge == 640
    assert s.allowed_origins == ("http://a:1", "http://b:2")


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("RUBIK_CONFIDENCE", "0"),
        ("RUBIK_CONFIDENCE", "1"),
        ("RUBIK_CONFIDENCE", "1.5"),
        ("RUBIK_CONFIDENCE", "-0.1"),
        ("RUBIK_CONFIDENCE", "abc"),
        ("RUBIK_CONFIDENCE", "nan"),
        ("RUBIK_IMGSZ", "0"),
        ("RUBIK_IMGSZ", "-32"),
        ("RUBIK_IMGSZ", "100"),
        ("RUBIK_IMGSZ", "abc"),
        ("RUBIK_DEVICE", "gpu"),
        ("RUBIK_DEVICE", "cuda"),
        ("RUBIK_DEVICE", "cuda:"),
        ("RUBIK_DEVICE", "cuda:x"),
        ("RUBIK_DEVICE", ""),
        ("RUBIK_MAX_FRAME_BYTES", "0"),
        ("RUBIK_MAX_FRAME_BYTES", "-1"),
        ("RUBIK_MAX_FRAME_BYTES", "x"),
        ("RUBIK_MAX_FRAME_EDGE", "0"),
        ("RUBIK_MAX_FRAME_EDGE", "1.5"),
        ("RUBIK_ALLOWED_ORIGINS", ""),
        ("RUBIK_ALLOWED_ORIGINS", " , "),
    ],
)
def test_invalid_vision_values(name: str, value: str) -> None:
    with pytest.raises(ConfigError):
        load_settings({name: value})


@pytest.mark.parametrize("value", ["", "   "])
def test_empty_model_path_rejected(value: str) -> None:
    with pytest.raises(ConfigError):
        load_settings({"RUBIK_MODEL_PATH": value})


@pytest.mark.skipif(os.name != "nt", reason="drive-relative paths are Windows-only")
def test_drive_relative_model_path_rejected() -> None:
    with pytest.raises(ConfigError):
        load_settings({"RUBIK_MODEL_PATH": "C:foo"})
