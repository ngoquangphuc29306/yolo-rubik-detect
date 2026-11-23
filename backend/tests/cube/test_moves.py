import random
from collections import Counter

import pytest

from app.cube.constants import CENTER_INDEX, SOLVED
from app.cube.moves import (
    MOVE_TOKENS,
    PERMUTATIONS,
    apply_move,
    apply_moves,
    is_solved,
    parse_move,
    verify_solution,
)

SUPERFLIP_ALG = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"
SUPERFLIP_MOVES = SUPERFLIP_ALG.split(" ")
SUPERFLIP = "UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB"


def scramble() -> str:
    rng = random.Random(1234)
    return apply_moves(SOLVED, [rng.choice(MOVE_TOKENS) for _ in range(25)])


def test_eighteen_tokens() -> None:
    assert len(MOVE_TOKENS) == 18
    assert set(PERMUTATIONS) == set(MOVE_TOKENS)


@pytest.mark.parametrize("token", MOVE_TOKENS)
def test_move_algebra(token: str) -> None:
    s = scramble()
    base = token[0]
    if token.endswith("2"):
        assert apply_moves(s, [token, token]) == s
    else:
        assert apply_moves(s, [base] * 4) == s
        assert apply_moves(s, [base, base + "'"]) == s
        assert apply_moves(s, [base + "'", base]) == s
    out = apply_move(s, token)
    for idx in CENTER_INDEX.values():
        assert out[idx] == s[idx]
    assert Counter(out) == Counter(s)


@pytest.mark.parametrize("bad", ["u", "R3", "x", "M", "", "R'2"])
def test_parse_rejects(bad: str) -> None:
    with pytest.raises(ValueError):
        parse_move(bad)


def test_parse_accepts_all() -> None:
    assert [parse_move(t) for t in MOVE_TOKENS] == list(MOVE_TOKENS)


def test_superflip() -> None:
    assert apply_moves(SOLVED, SUPERFLIP_MOVES) == SUPERFLIP


def test_hand_goldens() -> None:
    assert apply_move(SOLVED, "U")[18:21] == "RRR"
    s = apply_move(SOLVED, "R")
    assert s[2] + s[5] + s[8] == "FFF"
    assert apply_move(SOLVED, "D")[24:27] == "LLL"
    s = apply_move(SOLVED, "F")
    assert s[9] + s[12] + s[15] == "UUU"


def test_solved_and_verify() -> None:
    assert is_solved(SOLVED)
    assert not is_solved(apply_move(SOLVED, "R"))
    s = apply_moves(SOLVED, ["R", "U"])
    assert verify_solution(s, ["U'", "R'"])
    assert not verify_solution(s, ["R'", "U'"])
    assert verify_solution(SOLVED, [])
