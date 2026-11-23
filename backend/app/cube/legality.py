"""Cubie-level legality of a facelet state, independent of the solver library."""

from dataclasses import dataclass
from typing import Literal

from app.cube.constants import FACE_ORDER
from app.cube.geometry import FACE_AXES, Vec, index_of

IllegalReason = Literal["CORNER_IDENTITY", "EDGE_IDENTITY", "CORNER_TWIST", "EDGE_FLIP", "PARITY"]

_NORMAL: dict[str, Vec] = {face: axes[0] for face, axes in FACE_AXES.items()}

# Kociemba slot order; the letters name the faces meeting at the slot.
CORNER_SLOTS = ("URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB")
EDGE_SLOTS = ("UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR")


class IllegalCubeError(Exception):
    def __init__(self, reason: IllegalReason) -> None:
        super().__init__(reason)
        self.reason: IllegalReason = reason


@dataclass(frozen=True)
class CubieState:
    cp: tuple[int, ...]
    co: tuple[int, ...]
    ep: tuple[int, ...]
    eo: tuple[int, ...]


def _cross(a: Vec, b: Vec) -> Vec:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _dot(a: Vec, b: Vec) -> int:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _corner_facelets(slot: str) -> tuple[int, ...]:
    n1, n2, n3 = (_NORMAL[f] for f in slot)  # slot name starts with its U/D face
    if _dot(_cross(n1, n2), n3) != -1:
        n2, n3 = n3, n2
    position = (n1[0] + n2[0] + n3[0], n1[1] + n2[1] + n3[1], n1[2] + n2[2] + n3[2])
    return tuple(index_of(position, n) for n in (n1, n2, n3))


def _edge_facelets(slot: str) -> tuple[int, ...]:
    n1, n2 = (_NORMAL[f] for f in slot)  # slot name starts with its primary face
    position = (n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2])
    return tuple(index_of(position, n) for n in (n1, n2))


_CORNER_FACELETS = tuple(_corner_facelets(s) for s in CORNER_SLOTS)
_EDGE_FACELETS = tuple(_edge_facelets(s) for s in EDGE_SLOTS)
_CORNER_ID = {frozenset(s): i for i, s in enumerate(CORNER_SLOTS)}
_EDGE_ID = {frozenset(s): i for i, s in enumerate(EDGE_SLOTS)}


def _primary(slot: str) -> str:
    return slot[0]


def _identify(
    state: str,
    facelets: tuple[tuple[int, ...], ...],
    ids: dict[frozenset[str], int],
    reason: Literal["CORNER_IDENTITY", "EDGE_IDENTITY"],
) -> list[int]:
    found = []
    for slot in facelets:
        cubie = ids.get(frozenset(state[i] for i in slot))
        if cubie is None:
            raise IllegalCubeError(reason)
        found.append(cubie)
    if len(set(found)) != len(ids):
        raise IllegalCubeError(reason)
    return found


def to_cubies(state: str) -> CubieState:
    if len(state) != 54 or any(c not in FACE_ORDER for c in state):
        raise ValueError("state must be 54 characters from URFDLB")
    cp = _identify(state, _CORNER_FACELETS, _CORNER_ID, "CORNER_IDENTITY")
    ep = _identify(state, _EDGE_FACELETS, _EDGE_ID, "EDGE_IDENTITY")
    co = tuple(
        tuple(state[i] for i in _CORNER_FACELETS[slot]).index(_primary(CORNER_SLOTS[cubie]))
        for slot, cubie in enumerate(cp)
    )
    eo = tuple(
        0 if state[_EDGE_FACELETS[slot][0]] == _primary(EDGE_SLOTS[cubie]) else 1
        for slot, cubie in enumerate(ep)
    )
    return CubieState(tuple(cp), co, tuple(ep), eo)


def _parity(perm: tuple[int, ...]) -> int:
    seen = [False] * len(perm)
    cycles = 0
    for start in range(len(perm)):
        if not seen[start]:
            cycles += 1
            j = start
            while not seen[j]:
                seen[j] = True
                j = perm[j]
    return (len(perm) - cycles) % 2


def check_legal(state: str) -> None:
    cubies = to_cubies(state)
    if sum(cubies.co) % 3:
        raise IllegalCubeError("CORNER_TWIST")
    if sum(cubies.eo) % 2:
        raise IllegalCubeError("EDGE_FLIP")
    if _parity(cubies.cp) != _parity(cubies.ep):
        raise IllegalCubeError("PARITY")


__all__ = ["CubieState", "IllegalCubeError", "IllegalReason", "check_legal", "to_cubies"]
