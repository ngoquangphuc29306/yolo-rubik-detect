import hashlib
import os
import re
from pathlib import Path
from typing import Any

# numpy is not a direct dependency: it arrives transitively via ultralytics.
import numpy as np

from app.config import BACKEND_DIR
from app.cube.constants import ColorName
from app.vision.detector import Detection, ModelUnavailable, class_map


class YoloDetector:
    """YOLO26 checkpoint loaded once; never downloads or substitutes a model."""

    def __init__(
        self, model_path: Path, imgsz: int, confidence: float, device: str
    ) -> None:
        self._path = model_path
        self._imgsz = imgsz
        self._conf = confidence
        self.device = device
        self.sha256 = ""
        self.model_version = ""
        self._model: Any = None
        self._names: dict[int, ColorName] = {}

    def load(self) -> None:
        path = self._path
        if not path.is_file():
            raise ModelUnavailable(
                "Detection weights not found.", f"Detection weights not found at {path}"
            )
        try:
            digest = hashlib.sha256()
            with path.open("rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    digest.update(chunk)
        except OSError as exc:
            raise ModelUnavailable(
                "Detection weights could not be read.",
                f"Cannot read detection weights: {exc!r}",
            ) from exc
        self._check_device()

        os.environ.setdefault("YOLO_OFFLINE", "1")
        config_dir = BACKEND_DIR / ".ultralytics"
        config_dir.mkdir(exist_ok=True)
        os.environ.setdefault("YOLO_CONFIG_DIR", str(config_dir))
        try:
            import ultralytics

            model = ultralytics.YOLO(str(path))  # type: ignore[attr-defined]
        except Exception as exc:
            raise ModelUnavailable(
                "Detection weights could not be loaded.",
                f"Cannot load detection weights: {exc!r}",
            ) from exc
        if getattr(model, "task", None) != "detect":
            raise ModelUnavailable(
                "The model is not a detection model.",
                f"Model task must be 'detect', got {model.task!r}",
            )
        names = class_map(model.names)
        ckpt: dict[str, Any] = getattr(model, "ckpt", None) or {}
        train_args: dict[str, Any] = ckpt.get("train_args") or {}
        label = train_args.get("name") or path.stem
        self._model = model
        self._names = names
        self.sha256 = digest.hexdigest()
        self.model_version = f"{label}@{self.sha256[:12]}"
        try:
            self.detect(np.full((640, 640, 3), 114, dtype=np.uint8))  # warm-up
        except Exception as exc:
            raise ModelUnavailable(
                "Detection weights could not be loaded.",
                f"Warm-up inference failed: {exc!r}",
            ) from exc

    def _check_device(self) -> None:
        if self.device == "cpu":
            return
        reason = "The requested inference device is not available."
        m = re.fullmatch(r"cuda:([0-9]+)", self.device)
        if m is None:
            raise ModelUnavailable(reason, f"Malformed device {self.device!r}")
        try:
            import torch

            available = torch.cuda.is_available()
            count = torch.cuda.device_count() if available else 0
        except Exception as exc:
            raise ModelUnavailable(reason, f"Cannot query cuda: {exc!r}") from exc
        if int(m.group(1)) >= count:
            raise ModelUnavailable(
                reason,
                f"Device {self.device} requested but cuda reports {count} device(s)",
            )

    def detect(self, image: np.ndarray) -> list[Detection]:
        results = self._model.predict(
            image,
            imgsz=self._imgsz,
            conf=self._conf,
            device=self.device,
            verbose=False,
            agnostic_nms=False,
        )
        out: list[Detection] = []
        boxes = results[0].boxes
        for xyxy, conf, cls in zip(
            boxes.xyxy.tolist(), boxes.conf.tolist(), boxes.cls.tolist(), strict=True
        ):
            cid = int(cls)
            x1, y1, x2, y2 = (float(v) for v in xyxy)
            out.append(Detection(self._names[cid], float(conf), (x1, y1, x2, y2), cid))
        return out
