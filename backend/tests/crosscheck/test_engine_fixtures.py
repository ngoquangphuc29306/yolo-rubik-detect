import pytest

from app.cube.moves import MOVE_TOKENS, apply_move
from tests.conftest import load_fixture

FIXTURE = load_fixture("fixtures/engine/move-sequences.json")


def test_schema() -> None:
    assert FIXTURE["schema"] == "engine-move-sequences/1"
    assert len(FIXTURE["sequences"]) == 40


@pytest.mark.parametrize("index", range(40))
def test_sequence_matches_typescript(index: int) -> None:
    seq = FIXTURE["sequences"][index]
    moves, states = seq["moves"], seq["states"]
    assert len(states) == len(moves) + 1
    for i, token in enumerate(moves):
        got = apply_move(states[i], token)
        assert got == states[i + 1], f"sequence {index} step {i} ({token}): {got} != {states[i + 1]}"


def test_single_moves_match_typescript() -> None:
    single = FIXTURE["singleMoves"]
    assert set(single) == set(MOVE_TOKENS)
    scramble = load_fixture("fixtures/solve/scramble-a.response.json")["initialState"]
    for token, expected in single.items():
        assert apply_move(scramble, token) == expected, token
