import pytest

from app.cube.constants import SOLVED
from app.cube.legality import (
    _CORNER_FACELETS,
    _EDGE_FACELETS,
    IllegalCubeError,
    check_legal,
    to_cubies,
)
from tests.conftest import load_fixture


def swapped(state: str, pairs: list[tuple[int, int]]) -> str:
    chars = list(state)
    for a, b in pairs:
        chars[a], chars[b] = chars[b], chars[a]
    return "".join(chars)


def set_chars(state: str, updates: dict[int, str]) -> str:
    chars = list(state)
    for i, c in updates.items():
        chars[i] = c
    return "".join(chars)


def reason_of(state: str) -> str:
    with pytest.raises(IllegalCubeError) as info:
        check_legal(state)
    return info.value.reason


def test_slot_pins() -> None:
    assert _CORNER_FACELETS[0] == (8, 9, 20)
    assert _EDGE_FACELETS[0] == (5, 10)
    assert _EDGE_FACELETS[8] == (23, 12)


def test_solved_is_identity_cubies() -> None:
    c = to_cubies(SOLVED)
    assert c.cp == tuple(range(8)) and c.ep == tuple(range(12))
    assert c.co == (0,) * 8 and c.eo == (0,) * 12


def test_solved_and_fixture_states_accepted() -> None:
    check_legal(SOLVED)
    for seq in load_fixture("fixtures/engine/move-sequences.json")["sequences"]:
        for s in seq["states"]:
            check_legal(s)


def test_corner_twist() -> None:
    # rotate URF facelets: U9->R1 slot etc.
    chars = list(SOLVED)
    chars[8], chars[9], chars[20] = SOLVED[20], SOLVED[8], SOLVED[9]
    assert reason_of("".join(chars)) == "CORNER_TWIST"


def test_edge_flip() -> None:
    assert reason_of(swapped(SOLVED, [(5, 10)])) == "EDGE_FLIP"


def test_two_edges_swapped_is_parity() -> None:
    assert reason_of(swapped(SOLVED, [(5, 7), (10, 19)])) == "PARITY"


def test_two_corners_swapped_is_parity() -> None:
    # swap URF and UFL whole cubies: (8,9,20) <-> (6,18,38)
    s = swapped(SOLVED, [(8, 6), (9, 18), (20, 38)])
    assert reason_of(s) == "PARITY"


def test_corner_identity() -> None:
    s = set_chars(SOLVED, {9: "D", 27: "R"})
    assert reason_of(s) == "CORNER_IDENTITY"


def test_edge_identity() -> None:
    s = set_chars(SOLVED, {10: "D", 28: "R"})
    assert reason_of(s) == "EDGE_IDENTITY"


def test_rotated_face_is_illegal() -> None:
    s = load_fixture("fixtures/solve/scramble-a.response.json")["initialState"]
    check_legal(s)
    ring = [18, 19, 20, 23, 26, 25, 24, 21]
    chars = list(s)
    for k, i in enumerate(ring):
        chars[ring[(k + 2) % 8]] = s[i]
    with pytest.raises(IllegalCubeError):
        check_legal("".join(chars))
