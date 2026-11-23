"""Pure adaptive 3x3 analysis of YOLO detections on the square crop (never rotates or mirrors).

Lattice fitting: keep confident, roughly square candidates of similar size; estimate the pitch as the median
nearest-neighbour centre distance; try every candidate as each of the nine lattice positions and keep the
hypothesis matching most lattice points (ties: smallest residual); refine pitch and origin with medians of the
matched centres (robust to one stray box). Candidates outside the fitted lattice are ignored; the face box is the
fitted 3x3 extent, which also covers cells that were not detected.
"""

import itertools
import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from app.cube.constants import ColorName
from app.vision.detector import Detection

CellStatus = Literal["ok", "missing", "ambiguous", "misaligned"]
Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class GridRules:
    min_confidence: float = 0.4
    ambiguity_ratio: float = 0.6
    max_center_offset: float = 0.30  # of the pitch
    min_box: float = 0.5  # box side / pitch
    max_box: float = 1.3
    min_aspect: float = 0.6
    max_aspect: float = 1.67
    max_area_ratio: float = 2.5
    min_side_ratio: float = 0.5  # candidate side / median candidate side
    max_side_ratio: float = 2.0
    pitch_tolerance: float = 0.30  # neighbouring pitch vs median pitch
    min_face: float = 0.30  # face extent / crop side
    max_face: float = 0.95


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
    face: Box | None = None


@dataclass(frozen=True)
class _Lattice:
    ox: float  # centre of cell (0, 0)
    oy: float
    px: float
    py: float

    def point(self, r: int, c: int) -> tuple[float, float]:
        return self.ox + c * self.px, self.oy + r * self.py


_MISSING = Cell(None, None, "missing")
_AMBIGUOUS = Cell(None, None, "ambiguous")
_MATCH = 0.35  # of the pitch: lattice-point match radius while hypothesising


def _centre(d: Detection) -> tuple[float, float]:
    return (d.xyxy[0] + d.xyxy[2]) / 2, (d.xyxy[1] + d.xyxy[3]) / 2


def _wh(d: Detection) -> tuple[float, float]:
    return d.xyxy[2] - d.xyxy[0], d.xyxy[3] - d.xyxy[1]


def _candidates(detections: Sequence[Detection], size: int, rules: GridRules) -> list[Detection]:
    pool: list[Detection] = []
    for d in detections:
        w, h = _wh(d)
        cx, cy = _centre(d)
        if (
            d.confidence >= rules.min_confidence
            and w > 0
            and h > 0
            and rules.min_aspect <= w / h <= rules.max_aspect
            and 0 <= cx < size
            and 0 <= cy < size
        ):
            pool.append(d)
    if not pool:
        return []
    median_side = statistics.median(math.sqrt(_wh(d)[0] * _wh(d)[1]) for d in pool)
    return [
        d
        for d in pool
        if rules.min_side_ratio * median_side <= math.sqrt(_wh(d)[0] * _wh(d)[1]) <= rules.max_side_ratio * median_side
    ]


def _fit(cands: list[Detection]) -> _Lattice | None:
    if len(cands) < 4:
        return None
    pts = [_centre(d) for d in cands]
    nearest = [
        min(math.hypot(x - u, y - v) for j, (u, v) in enumerate(pts) if j != i) for i, (x, y) in enumerate(pts)
    ]
    pitch = statistics.median(nearest)
    if pitch <= 0:
        return None

    best: tuple[int, float, _Lattice] | None = None
    for ax, ay in pts:
        for r in range(3):
            for c in range(3):
                lat = _Lattice(ax - c * pitch, ay - r * pitch, pitch, pitch)
                matched, resid = _match(lat, pts, _MATCH * pitch)
                score = len(matched)
                if best is None or (score, -resid) > (best[0], -best[1]):
                    best = (score, resid, lat)
    assert best is not None
    matched, _ = _match(best[2], pts, _MATCH * pitch)
    if len(matched) < 4 or len({r for r, _, _ in matched}) < 2 or len({c for _, c, _ in matched}) < 2:
        return None

    cell = {(r, c): p for r, c, p in matched}
    dxs = [cell[r, c + 1][0] - cell[r, c][0] for (r, c) in cell if (r, c + 1) in cell]
    dys = [cell[r + 1, c][1] - cell[r, c][1] for (r, c) in cell if (r + 1, c) in cell]
    px = statistics.median(dxs) if dxs else pitch
    py = statistics.median(dys) if dys else pitch
    if not 0.5 * pitch <= px <= 2 * pitch:  # the axes may differ (stretched crop); keep it sane
        px = pitch
    if not 0.5 * pitch <= py <= 2 * pitch:
        py = pitch
    ox = statistics.median(p[0] - c * px for (r, c), p in cell.items())
    oy = statistics.median(p[1] - r * py for (r, c), p in cell.items())
    return _Lattice(ox, oy, px, py)


def _match(
    lat: _Lattice, pts: list[tuple[float, float]], radius: float
) -> tuple[list[tuple[int, int, tuple[float, float]]], float]:
    """One nearest point per lattice position within `radius`; also the summed residual."""
    out: list[tuple[int, int, tuple[float, float]]] = []
    resid = 0.0
    for r in range(3):
        for c in range(3):
            lx, ly = lat.point(r, c)
            dist, p = min((math.hypot(x - lx, y - ly), (x, y)) for x, y in pts)
            if dist <= radius:
                out.append((r, c, p))
                resid += dist
    return out, resid


def _cell_index(lat: _Lattice, d: Detection) -> int | None:
    x, y = _centre(d)
    c = round((x - lat.ox) / lat.px)
    r = round((y - lat.oy) / lat.py)
    if not (0 <= r < 3 and 0 <= c < 3):
        return None
    return 3 * r + c


def _regular(kept: dict[int, Detection], rules: GridRules) -> bool:
    """Per axis, neighbouring column/row pitches (from per-column/row mean centres) stay near their median."""
    cols: dict[int, list[float]] = {}
    rows: dict[int, list[float]] = {}
    for i, d in kept.items():
        x, y = _centre(d)
        cols.setdefault(i % 3, []).append(x)
        rows.setdefault(i // 3, []).append(y)
    for axis in (cols, rows):
        means = {k: sum(v) / len(v) for k, v in axis.items()}
        keys = sorted(means)
        pitches = [(means[b] - means[a]) / (b - a) for a, b in itertools.pairwise(keys)]
        if len(pitches) < 2:
            continue
        median = statistics.median(pitches)
        if median <= 0 or any(abs(p - median) > rules.pitch_tolerance * median for p in pitches):
            return False
    return True


def analyze(detections: Sequence[Detection], size: int, rules: GridRules = GridRules()) -> GridAnalysis:
    if size <= 0:
        raise ValueError("size must be positive")
    lat = _fit(_candidates(detections, size, rules))
    if lat is None:
        return GridAnalysis((_MISSING,) * 9, None, False, "NO_FACE", None)

    pitch = (lat.px + lat.py) / 2
    face: Box = (
        lat.ox - lat.px / 2,
        lat.oy - lat.py / 2,
        lat.ox + 2.5 * lat.px,
        lat.oy + 2.5 * lat.py,
    )

    buckets: list[list[Detection]] = [[] for _ in range(9)]
    for d in _candidates(detections, size, rules):
        i = _cell_index(lat, d)
        if i is not None:
            buckets[i].append(d)

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
        kept[i] = best
        x, y = _centre(best)
        lx, ly = lat.point(*divmod(i, 3))
        w, h = _wh(best)
        aligned = (
            math.hypot((x - lx) / lat.px, (y - ly) / lat.py) <= rules.max_center_offset
            and rules.min_box * lat.px <= w <= rules.max_box * lat.px
            and rules.min_box * lat.py <= h <= rules.max_box * lat.py
        )
        cells.append(Cell(best.color, best.confidence, "ok" if aligned else "misaligned"))

    tilted = False
    if len(kept) >= 2:
        areas = [_wh(d)[0] * _wh(d)[1] for d in kept.values()]
        if max(areas) / min(areas) > rules.max_area_ratio or not _regular(kept, rules):
            tilted = True
            for i, d in kept.items():
                cells[i] = Cell(d.color, d.confidence, "misaligned")

    extent = (3 * pitch) / size
    statuses = {cell.status for cell in cells}
    if statuses == {"ok"} and rules.min_face <= extent <= rules.max_face:
        grid = tuple(cell.color for cell in cells if cell.color is not None)
        return GridAnalysis(tuple(cells), grid, True, None, face)
    if extent < rules.min_face:
        reason = "NO_FACE"  # too small: move the cube closer
    elif extent > rules.max_face:
        reason = "INCOMPLETE"  # too large: move the cube farther
    elif tilted:
        reason = "TILTED"
    elif "ambiguous" in statuses:
        reason = "AMBIGUOUS"
    elif "misaligned" in statuses:
        reason = "MISALIGNED"
    else:
        reason = "INCOMPLETE"
    return GridAnalysis(tuple(cells), None, False, reason, face)
