"""The 18 face-turn moves as facelet permutations, derived from geometry.

Convention: ``new[i] = old[perm[i]]``. Clockwise means viewed from outside the
face, i.e. -90 degrees about the outward normal (right-hand rule).
"""

from collections.abc import Mapping, Sequence

from app.cube.constants import FACE_ORDER, SOLVED, FaceId
from app.cube.geometry import FACE_AXES, Vec, facelet_frame, index_of

MOVE_TOKENS: tuple[str, ...] = tuple(
    f"{face}{suffix}" for face in ("U", "R", "F", "D", "L", "B") for suffix in ("", "'", "2")
)


def _rotate_cw(u: Vec, v: Vec) -> Vec:
    """Rotate v by -90 degrees about unit axis u: R v = u(u.v) - (u x v)."""
    dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
    cross = (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )
    return (
        u[0] * dot - cross[0],
        u[1] * dot - cross[1],
        u[2] * dot - cross[2],
    )


def _base_permutation(face: FaceId) -> tuple[int, ...]:
    axis = FACE_AXES[face][0]
    perm = list(range(54))
    for i in range(54):
        position, normal = facelet_frame(i)
        if sum(p * a for p, a in zip(position, axis, strict=True)) != 1:
            continue
        j = index_of(_rotate_cw(axis, position), _rotate_cw(axis, normal))
        perm[j] = i  # sticker at i moves to j
    return tuple(perm)


def _compose(first: tuple[int, ...], second: tuple[int, ...]) -> tuple[int, ...]:
    """Permutation equal to applying ``first`` then ``second``."""
    return tuple(first[second[i]] for i in range(54))


def _build() -> dict[str, tuple[int, ...]]:
    table: dict[str, tuple[int, ...]] = {}
    for face in FACE_ORDER:
        cw = _base_permutation(face)
        double = _compose(cw, cw)
        table[face] = cw
        table[face + "2"] = double
        table[face + "'"] = _compose(double, cw)
    return table


PERMUTATIONS: Mapping[str, tuple[int, ...]] = _build()


def parse_move(token: str) -> str:
    if token not in PERMUTATIONS:
        raise ValueError(f"invalid move token: {token!r}")
    return token


def apply_move(state: str, token: str) -> str:
    perm = PERMUTATIONS[parse_move(token)]
    return "".join(state[perm[i]] for i in range(54))


def apply_moves(state: str, tokens: Sequence[str]) -> str:
    for token in tokens:
        state = apply_move(state, token)
    return state


def is_solved(state: str) -> bool:
    return state == SOLVED


def verify_solution(state: str, tokens: Sequence[str]) -> bool:
    return is_solved(apply_moves(state, tokens))
