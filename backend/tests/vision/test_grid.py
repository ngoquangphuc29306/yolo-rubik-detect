import random

import pytest

from app.cube.constants import ColorName
from app.vision.detector import Detection
from app.vision.grid import GridAnalysis, GridRules, analyze

SIZE = 640
FACE = 0.75  # default face: 75 % of the crop side, centred
C = FACE * SIZE / 3  # lattice pitch of the default face
COLORS: list[ColorName] = ["white", "yellow", "red", "orange", "blue", "green", "white", "red", "blue"]


def box(
    index: int,
    color: ColorName,
    conf: float = 0.9,
    w: float = 0.8,
    h: float = 0.8,
    dx: float = 0.0,
    dy: float = 0.0,
    face: float = FACE,
    fx: float = 0.5,
    fy: float = 0.5,
) -> Detection:
    """Detection for lattice cell `index` of a face of `face` x crop side centred at (fx, fy) x crop."""
    c = face * SIZE / 3
    r, col = divmod(index, 3)
    cx = fx * SIZE + (col - 1) * c + dx * c
    cy = fy * SIZE + (r - 1) * c + dy * c
    return Detection(color, conf, (cx - w * c / 2, cy - h * c / 2, cx + w * c / 2, cy + h * c / 2), 0)


def nine(colors: list[ColorName] = COLORS, **kw: float) -> list[Detection]:
    return [box(i, c, **kw) for i, c in enumerate(colors)]


def xyxy(a: GridAnalysis) -> tuple[float, float, float, float]:
    assert a.face is not None
    return a.face


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
    edge = Detection("red", 0.9, (SIZE - 90, 100, SIZE + 90, 280), 0)  # centre x == SIZE
    assert analyze(nine() + [edge], SIZE).valid


def test_off_centre_misaligned() -> None:
    a = analyze(replace(nine(), 4, box(4, "blue", dx=0.35)), SIZE)
    assert a.reason == "MISALIGNED" and a.grid is None
    assert a.cells[4].status == "misaligned"
    assert a.cells[4].color == "blue" and a.cells[4].confidence == 0.9


def test_oversized_misaligned() -> None:
    a = analyze(nine(w=1.4, h=1.4), SIZE)
    assert a.reason == "MISALIGNED" and a.grid is None
    assert all(c.status == "misaligned" for c in a.cells)


def test_thin_misaligned() -> None:
    a = analyze(replace(nine(), 1, box(1, "yellow", w=0.45, h=0.6)), SIZE)
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


# ---- adaptive lattice ----


def test_valid_face_box_reported() -> None:
    a = analyze(nine(), SIZE)
    x0, y0, x1, y1 = xyxy(a)
    half = FACE * SIZE / 2
    assert (x0, y0, x1, y1) == pytest.approx((SIZE / 2 - half, SIZE / 2 - half, SIZE / 2 + half, SIZE / 2 + half), abs=3)


def test_small_face_centred() -> None:
    a = analyze(nine(face=0.35), SIZE)
    assert a.valid and a.grid == tuple(COLORS)
    x0, y0, x1, y1 = xyxy(a)
    assert x1 - x0 == pytest.approx(0.35 * SIZE, rel=0.05)
    assert (x0 + x1) / 2 == pytest.approx(SIZE / 2, abs=3) and (y0 + y1) / 2 == pytest.approx(SIZE / 2, abs=3)


def test_large_face() -> None:
    a = analyze(nine(face=0.9), SIZE)
    assert a.valid and a.grid == tuple(COLORS)
    x0, _, x1, _ = xyxy(a)
    assert x1 - x0 == pytest.approx(0.9 * SIZE, rel=0.05)


def test_off_centre_face() -> None:
    a = analyze(nine(face=0.5, fx=0.3, fy=0.68), SIZE)
    assert a.valid and a.grid == tuple(COLORS)
    x0, y0, x1, y1 = xyxy(a)
    assert (x0 + x1) / 2 == pytest.approx(0.3 * SIZE, abs=4) and (y0 + y1) / 2 == pytest.approx(0.68 * SIZE, abs=4)


def test_background_boxes_outside_lattice_ignored() -> None:
    c = 0.5 * SIZE / 3
    dets = nine(face=0.5)
    # one pitch beyond the right column / below the bottom row, plus a far corner box
    dets.append(Detection("blue", 0.95, (SIZE / 2 + 2 * c - 0.4 * c, SIZE / 2 - 0.4 * c, SIZE / 2 + 2 * c + 0.4 * c, SIZE / 2 + 0.4 * c), 0))
    dets.append(Detection("blue", 0.95, (SIZE / 2 - 0.4 * c, SIZE / 2 + 2 * c - 0.4 * c, SIZE / 2 + 0.4 * c, SIZE / 2 + 2 * c + 0.4 * c), 0))
    dets.append(Detection("blue", 0.95, (10, 10, 10 + 0.8 * c, 10 + 0.8 * c), 0))
    a = analyze(dets, SIZE)
    assert a.valid and a.grid == tuple(COLORS)
    x0, _, x1, _ = xyxy(a)
    assert x1 - x0 == pytest.approx(0.5 * SIZE, rel=0.05)


def test_background_box_with_wrong_size_ignored() -> None:
    dets = nine(face=0.5) + [Detection("blue", 0.99, (20, 20, 220, 220), 0)]
    assert analyze(dets, SIZE).valid


def test_shuffled_input_is_row_major() -> None:
    dets = nine(face=0.5, fx=0.4, fy=0.55)
    random.Random(7).shuffle(dets)
    a = analyze(dets, SIZE)
    assert a.valid and a.grid == tuple(COLORS)
    assert [c.color for c in a.cells] == COLORS


def test_missing_cell_on_small_face_is_incomplete() -> None:
    a = analyze(replace(nine(face=0.4), 8, None), SIZE)
    assert a.reason == "INCOMPLETE" and a.cells[8].status == "missing"
    assert a.face is not None
    x0, _, x1, _ = xyxy(a)
    assert x1 - x0 == pytest.approx(0.4 * SIZE, rel=0.06)  # lattice extrapolated over the gap


def test_ambiguous_cell_on_small_face() -> None:
    a = analyze(nine(face=0.4) + [box(4, "red", conf=0.85, face=0.4)], SIZE)
    assert a.reason == "AMBIGUOUS" and a.cells[4].status == "ambiguous"


def test_two_detections_competing_in_one_cell_keep_best() -> None:
    dets = nine(face=0.5) + [box(4, "red", conf=0.5, face=0.5, dx=0.1, dy=-0.1, w=0.7, h=0.7)]
    a = analyze(dets, SIZE)
    assert a.valid and a.cells[4].color == COLORS[4] and a.cells[4].confidence == 0.9


def test_tilted_lattice_on_small_face() -> None:
    dets = nine(face=0.5, w=0.5, h=0.5)
    dets[0] = box(0, COLORS[0], face=0.5, w=0.5 * 3**0.5, h=0.5 * 3**0.5)
    assert analyze(dets, SIZE).reason == "TILTED"


def test_irregular_pitch_is_not_valid() -> None:
    dets = nine(face=0.6)
    for i in (0, 3, 6):  # column 0 pushed right and column 1 left: pitches 0.4 and 1.3 of the nominal
        dets[i] = box(i, COLORS[i], face=0.6, dx=0.29)
    for i in (1, 4, 7):
        dets[i] = box(i, COLORS[i], face=0.6, dx=-0.29)
    a = analyze(dets, SIZE)
    assert not a.valid and a.grid is None  # no regular lattice: any rejection reason


def test_face_too_small_is_not_valid() -> None:
    a = analyze(nine(face=0.25), SIZE)
    assert not a.valid and a.grid is None and a.reason == "NO_FACE"
    assert a.face is not None


def test_face_too_large_is_not_valid() -> None:
    a = analyze(nine(face=0.97), SIZE)
    assert not a.valid and a.grid is None and a.reason == "INCOMPLETE"


def test_face_boundaries_accepted() -> None:
    assert analyze(nine(face=0.32), SIZE).valid
    assert analyze(nine(face=0.94), SIZE).valid


def test_no_lattice_has_no_face() -> None:
    assert analyze([], SIZE).face is None
    a = analyze([box(4, "red")], SIZE)
    assert a.face is None and a.reason == "NO_FACE" and all(c.status == "missing" for c in a.cells)
