import pytest

from app.cube.constants import ColorName
from app.vision.detector import Detection
from app.vision.grid import GridRules, analyze

SIZE = 640
C = SIZE / 3
COLORS: list[ColorName] = ["white", "yellow", "red", "orange", "blue", "green", "white", "red", "blue"]


def box(
    index: int,
    color: ColorName,
    conf: float = 0.9,
    w: float = 0.8,
    h: float = 0.8,
    dx: float = 0.0,
    dy: float = 0.0,
) -> Detection:
    r, col = divmod(index, 3)
    cx, cy = (col + 0.5) * C + dx * C, (r + 0.5) * C + dy * C
    return Detection(color, conf, (cx - w * C / 2, cy - h * C / 2, cx + w * C / 2, cy + h * C / 2), 0)


def nine(colors: list[ColorName] = COLORS, **kw: float) -> list[Detection]:
    return [box(i, c, **kw) for i, c in enumerate(colors)]


def replace(dets: list[Detection], i: int, new: Detection | None) -> list[Detection]:
    out = list(dets)
    if new is None:
        del out[i]
    else:
        out[i] = new
    return out


def test_complete_grid_row_major() -> None:
    a = analyze(nine(), SIZE)
    assert a.valid and a.reason is None
    assert a.grid == tuple(COLORS)
    assert all(c.status == "ok" for c in a.cells)
    assert a.cells[4].color == "blue" and a.cells[4].confidence == 0.9
    assert isinstance(a.cells, tuple)


def test_asymmetric_layout_not_rotated_or_mirrored() -> None:
    layout: list[ColorName] = ["white", "white", "red", "orange", "blue", "green", "yellow", "red", "green"]
    a = analyze(list(reversed(nine(layout))), SIZE)
    assert a.grid == tuple(layout)


def test_one_missing_is_incomplete() -> None:
    a = analyze(replace(nine(), 5, None), SIZE)
    assert not a.valid and a.grid is None and a.reason == "INCOMPLETE"
    assert a.cells[5].status == "missing"
    assert a.cells[5].color is None and a.cells[5].confidence is None


def test_duplicate_same_colour_keeps_best() -> None:
    dets = nine() + [box(2, COLORS[2], conf=0.95), box(2, COLORS[2], conf=0.6)]
    a = analyze(dets, SIZE)
    assert a.valid and a.cells[2].confidence == 0.95


def test_two_colours_ambiguous() -> None:
    a = analyze(nine() + [box(0, "green", conf=0.6 * 0.9 + 0.01)], SIZE)
    assert a.reason == "AMBIGUOUS" and a.grid is None
    assert a.cells[0].status == "ambiguous"
    assert a.cells[0].color is None and a.cells[0].confidence is None


def test_ambiguity_ratio_inclusive() -> None:
    rules = GridRules(ambiguity_ratio=0.5)
    base = replace(nine(), 0, box(0, "white", conf=1.0))
    a = analyze(base + [box(0, "green", conf=0.5)], SIZE, rules)
    assert a.cells[0].status == "ambiguous"


def test_runner_below_ratio_keeps_best() -> None:
    a = analyze(nine() + [box(0, "green", conf=0.5)], SIZE)
    assert a.valid and a.cells[0].color == "white"


def test_low_confidence_ignored_and_threshold_inclusive() -> None:
    a = analyze(replace(nine(), 3, box(3, "orange", conf=0.39)), SIZE)
    assert a.cells[3].status == "missing"
    b = analyze(replace(nine(), 3, box(3, "orange", conf=0.4)), SIZE)
    assert b.valid


def test_low_confidence_runner_does_not_make_ambiguous() -> None:
    a = analyze(nine() + [box(0, "green", conf=0.3)], SIZE)
    assert a.valid


def test_centre_outside_crop_ignored() -> None:
    outside = Detection("red", 0.9, (SIZE + 10, 10, SIZE + 100, 100), 0)
    a = analyze(nine() + [outside], SIZE)
    assert a.valid
    edge = Detection("red", 0.9, (SIZE - 10, 100, SIZE + 10, 120), 0)  # centre x == SIZE
    assert analyze(nine() + [edge], SIZE).valid


def test_off_centre_misaligned() -> None:
    a = analyze(replace(nine(), 4, box(4, "blue", dx=0.35)), SIZE)
    assert a.reason == "MISALIGNED" and a.grid is None
    assert a.cells[4].status == "misaligned"
    assert a.cells[4].color == "blue" and a.cells[4].confidence == 0.9


def test_oversized_misaligned() -> None:
    a = analyze(replace(nine(), 1, box(1, "yellow", w=1.2, h=1.2)), SIZE)
    assert a.cells[1].status == "misaligned" and a.reason == "MISALIGNED"


def test_thin_misaligned() -> None:
    a = analyze(replace(nine(), 1, box(1, "yellow", w=0.4, h=0.8)), SIZE)
    assert a.cells[1].status == "misaligned" and a.reason == "MISALIGNED"


def test_area_ratio_tilted() -> None:
    dets = nine(w=0.5, h=0.5)
    dets[0] = box(0, COLORS[0], w=0.5 * 3**0.5, h=0.5 * 3**0.5)
    a = analyze(dets, SIZE)
    assert a.reason == "TILTED" and a.grid is None
    assert all(c.status == "misaligned" for c in a.cells)


def test_tilted_beats_incomplete() -> None:
    dets = nine(w=0.5, h=0.5)
    dets[0] = box(0, COLORS[0], w=0.5 * 3**0.5, h=0.5 * 3**0.5)
    a = analyze(dets[:-1], SIZE)
    assert a.reason == "TILTED"


def test_ambiguous_beats_missing() -> None:
    dets = replace(nine(), 8, None) + [box(0, "green", conf=0.85)]
    assert analyze(dets, SIZE).reason == "AMBIGUOUS"


def test_ambiguous_beats_misaligned() -> None:
    dets = replace(nine(), 8, box(8, "blue", dx=0.4)) + [box(0, "green", conf=0.85)]
    assert analyze(dets, SIZE).reason == "AMBIGUOUS"


def test_misaligned_beats_missing() -> None:
    dets = replace(nine(), 8, None)
    dets[0] = box(0, COLORS[0], dx=0.4)
    assert analyze(dets, SIZE).reason == "MISALIGNED"


def test_no_face() -> None:
    a = analyze([], SIZE)
    assert a.reason == "NO_FACE" and not a.valid and a.grid is None
    assert all(c.status == "missing" for c in a.cells)
    assert analyze([box(0, "red", conf=0.2)], SIZE).reason == "NO_FACE"


def test_invalid_size() -> None:
    with pytest.raises(ValueError):
        analyze([], 0)
