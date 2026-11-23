"""Pure 3x3 cell analysis of YOLO detections on the square guide crop (never rotates or mirrors)."""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from app.cube.constants import ColorName
from app.vision.detector import Detection

CellStatus = Literal["ok", "missing", "ambiguous", "misaligned"]


@dataclass(frozen=True)
class GridRules:
    min_confidence: float = 0.5
    ambiguity_ratio: float = 0.6
    max_center_offset: float = 0.30
    min_box: float = 0.35
    max_box: float = 1.10
    min_aspect: float = 0.6
    max_aspect: float = 1.67
    max_area_ratio: float = 2.5


@dataclass(frozen=True)
class Cell:
    color: ColorName | None
    confidence: float | None
    status: CellStatus


@dataclass(frozen=True)
class GridAnalysis:
    cells: tuple[Cell, ...]
    grid: tuple[ColorName, ...] | None
    valid: bool
    reason: str | None


_MISSING = Cell(None, None, "missing")
_AMBIGUOUS = Cell(None, None, "ambiguous")


def _aligned(d: Detection, r: int, col: int, c: float, rules: GridRules) -> bool:
    x0, y0, x1, y1 = d.xyxy
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return False
    dist = math.hypot((x0 + x1) / 2 - (col + 0.5) * c, (y0 + y1) / 2 - (r + 0.5) * c)
    return (
        dist <= rules.max_center_offset * c
        and rules.min_box * c <= w <= rules.max_box * c
        and rules.min_box * c <= h <= rules.max_box * c
        and rules.min_aspect <= w / h <= rules.max_aspect
    )


def analyze(detections: Sequence[Detection], size: int, rules: GridRules = GridRules()) -> GridAnalysis:
    if size <= 0:
        raise ValueError("size must be positive")
    c = size / 3
    buckets: list[list[Detection]] = [[] for _ in range(9)]
    for d in detections:
        if d.confidence < rules.min_confidence:
            continue
        cx, cy = (d.xyxy[0] + d.xyxy[2]) / 2, (d.xyxy[1] + d.xyxy[3]) / 2
        if 0 <= cx < size and 0 <= cy < size:
            buckets[3 * int(cy // c) + int(cx // c)].append(d)

    cells: list[Cell] = []
    kept: dict[int, Detection] = {}
    for i, group in enumerate(buckets):
        if not group:
            cells.append(_MISSING)
            continue
        best = max(group, key=lambda d: d.confidence)
        others = [d for d in group if d.color != best.color]
        if others and max(d.confidence for d in others) >= rules.ambiguity_ratio * best.confidence:
            cells.append(_AMBIGUOUS)
            continue
        r, col = divmod(i, 3)
        kept[i] = best
        status: CellStatus = "ok" if _aligned(best, r, col, c, rules) else "misaligned"
        cells.append(Cell(best.color, best.confidence, status))

    tilted = False
    if len(kept) >= 2:
        areas = [(d.xyxy[2] - d.xyxy[0]) * (d.xyxy[3] - d.xyxy[1]) for d in kept.values()]
        if min(areas) <= 0 or max(areas) / min(areas) > rules.max_area_ratio:
            tilted = True
            for i, d in kept.items():
                cells[i] = Cell(d.color, d.confidence, "misaligned")

    statuses = {cell.status for cell in cells}
    if statuses == {"ok"}:
        grid = tuple(cell.color for cell in cells if cell.color is not None)
        return GridAnalysis(tuple(cells), grid, True, None)
    if statuses == {"missing"}:
        reason = "NO_FACE"
    elif tilted:
        reason = "TILTED"
    elif "ambiguous" in statuses:
        reason = "AMBIGUOUS"
    elif "misaligned" in statuses:
        reason = "MISALIGNED"
    else:
        reason = "INCOMPLETE"
    return GridAnalysis(tuple(cells), None, False, reason)
