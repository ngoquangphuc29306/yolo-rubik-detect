from pathlib import Path

import cv2
import pytest

from app.config import DEFAULT_MODEL_PATH, load_settings
from app.main import create_app
from app.vision.detector import Detection, ModelUnavailable, class_map
from app.vision.yolo_detector import YoloDetector
from tests.conftest import REPO_ROOT

REAL = {0: "blue", 1: "green", 2: "orange", 3: "red", 4: "white", 5: "yellow"}
PINNED_SHA = "93b727eca123fb40e1140f0a34cf50cc90cb50fec7eca7dacfb775e61a1a17e0"
COLORS = {"white", "yellow", "red", "orange", "blue", "green"}


def test_class_map_real_names() -> None:
    assert class_map(REAL) == REAL


def test_class_map_permuted_names_map_by_name() -> None:
    permuted = {0: "red", 1: "blue", 2: "yellow", 3: "green", 4: "orange", 5: "white"}
    assert class_map(permuted) == permuted


def test_class_map_accepts_capitalised_names() -> None:
    caps = {0: "Blue", 1: "Green", 2: "Orange", 3: "Red", 4: "White", 5: "Yellow"}
    assert class_map(caps) == REAL


def test_class_map_accepts_single_letter_names() -> None:
    letters = {0: "b", 1: "g", 2: "o", 3: "r", 4: "w", 5: "y"}
    assert class_map(letters) == REAL


def test_class_map_rejects_duplicates_after_normalising() -> None:
    with pytest.raises(ModelUnavailable):
        class_map({0: "blue", 1: "B", 2: "orange", 3: "red", 4: "white", 5: "yellow"})


def test_class_map_rejects_five_names() -> None:
    with pytest.raises(ModelUnavailable):
        class_map({k: v for k, v in REAL.items() if k != 5})


def test_class_map_rejects_extra_and_wrong_names() -> None:
    with pytest.raises(ModelUnavailable):
        class_map({**REAL, 6: "purple"})
    with pytest.raises(ModelUnavailable):
        class_map({**REAL, 5: "purple"})


def test_default_suite_does_not_need_weights() -> None:
    assert load_settings().model_path != DEFAULT_MODEL_PATH
    app = create_app(solver=_NullSolver())
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        body = client.get("/health").json()
    assert body["visionReady"] is False
    assert body["status"] == "degraded"


class _NullSolver:
    def solve(self, state: str, timeout_s: int) -> list[str]:
        return []


def test_missing_file_is_unavailable(tmp_path: Path) -> None:
    det = YoloDetector(tmp_path / "nope.pt", 640, 0.5, "cpu")
    with pytest.raises(ModelUnavailable, match="not found"):
        det.load()


@pytest.mark.parametrize("device", ["cuda:x", "cuda", "gpu", "cuda:-1"])
def test_malformed_device_is_unavailable(tmp_path: Path, device: str) -> None:
    f = tmp_path / "m.pt"
    f.write_bytes(b"x")
    with pytest.raises(ModelUnavailable) as ei:
        YoloDetector(f, 640, 0.5, device).load()
    assert ei.value.reason == "The requested inference device is not available."


def test_reason_has_no_path(tmp_path: Path) -> None:
    with pytest.raises(ModelUnavailable) as ei:
        YoloDetector(tmp_path / "nope.pt", 640, 0.5, "cpu").load()
    assert str(tmp_path) not in ei.value.reason
    assert str(tmp_path) in ei.value.detail


def test_directory_is_unavailable(tmp_path: Path) -> None:
    with pytest.raises(ModelUnavailable):
        YoloDetector(tmp_path, 640, 0.5, "cpu").load()


def test_garbage_file_is_unavailable(tmp_path: Path) -> None:
    bad = tmp_path / "bad.pt"
    bad.write_bytes(b"not a model")
    with pytest.raises(ModelUnavailable):
        YoloDetector(bad, 640, 0.5, "cpu").load()


@pytest.mark.model
def test_real_model_loads_and_detects() -> None:
    if not DEFAULT_MODEL_PATH.is_file():
        pytest.fail(
            "place the trained checkpoint at backend/weights/best.pt", pytrace=False
        )
    det = YoloDetector(DEFAULT_MODEL_PATH, 640, 0.5, "cpu")
    det.load()
    assert det.sha256 == PINNED_SHA
    assert det.model_version.endswith("@93b727eca123")
    assert det.device == "cpu"
    images = sorted((REPO_ROOT / "fixtures" / "vision").glob("*.jpg"))
    assert len(images) >= 3
    total = 0
    for path in images:
        img = cv2.imread(str(path))
        assert img is not None
        h, w = img.shape[:2]
        for d in det.detect(img):
            assert isinstance(d, Detection)
            assert d.color in COLORS
            assert 0 < d.confidence <= 1
            x1, y1, x2, y2 = d.xyxy
            assert 0 <= x1 < x2 <= w and 0 <= y1 < y2 <= h
            assert all(type(v) is float for v in d.xyxy)
            total += 1
    assert total >= 9


@pytest.mark.model
def test_real_model_unreachable_cuda_is_unavailable() -> None:
    if not DEFAULT_MODEL_PATH.is_file():
        pytest.fail(
            "place the trained checkpoint at backend/weights/best.pt", pytrace=False
        )
    import torch

    if torch.cuda.is_available():
        pytest.skip("cuda present")
    with pytest.raises(ModelUnavailable, match="device is not available"):
        YoloDetector(DEFAULT_MODEL_PATH, 640, 0.5, "cuda:0").load()
