from collections import Counter

from app.cube.constants import CENTER_INDEX, FACE_ORDER
from app.cube.geometry import facelet_frame, index_of


def test_round_trip_all_indices() -> None:
    for i in range(54):
        position, normal = facelet_frame(i)
        assert index_of(position, normal) == i


def test_centres_map_to_normal() -> None:
    for face in FACE_ORDER:
        position, normal = facelet_frame(CENTER_INDEX[face])
        assert position == normal


def test_position_multiplicities() -> None:
    counts = Counter(facelet_frame(i)[0] for i in range(54))
    assert len(counts) == 26
    by_size = Counter(counts.values())
    assert by_size == {3: 8, 2: 12, 1: 6}


def test_table_samples() -> None:
    # U row 0 col 0: n=+Y, a=+X, b=+Z -> (-1, 1, -1)
    assert facelet_frame(0) == ((-1, 1, -1), (0, 1, 0))
    # F row 0 col 2: n=+Z, a=+X, b=-Y -> (1, 1, 1)
    assert facelet_frame(20) == ((1, 1, 1), (0, 0, 1))
