import json
from dataclasses import replace
from pathlib import Path

from app.api.scan_ws import DEBUG_EVERY, _debug_dump
from app.config import Settings
from app.vision.detector import Detection
from app.vision.grid import analyze


def _settings(tmp: Path | None) -> Settings:
    return replace(Settings("yolo", Path("."), 10), debug_dir=tmp)


def test_off_by_default(tmp_path: Path) -> None:
    _debug_dump(_settings(None), "abcdefgh1234", DEBUG_EVERY, b"x", [], analyze([], 100))
    assert list(tmp_path.iterdir()) == []


def test_writes_every_third_frame_with_detections(tmp_path: Path) -> None:
    det = [Detection("red", 0.9, (1.0, 2.0, 3.0, 4.0), 3)]
    s = _settings(tmp_path)
    _debug_dump(s, "abcdefgh1234", 1, b"skip", det, analyze(det, 100))
    _debug_dump(s, "abcdefgh1234", DEBUG_EVERY, b"jpegbytes", det, analyze(det, 100))
    assert sorted(p.name for p in tmp_path.iterdir()) == ["abcdefgh_00003.jpg", "abcdefgh_00003.json"]
    data = json.loads((tmp_path / "abcdefgh_00003.json").read_text(encoding="utf-8"))
    assert data["detections"][0]["color"] == "red" and len(data["cells"]) == 9
