"""Facelet geometry from ARCHITECTURE.md section 6.4 (X right, Y up, Z front)."""

from app.cube.constants import FACE_ORDER, FaceId

Vec = tuple[int, int, int]

# face -> (outward normal n, image-right a, image-down b)
FACE_AXES: dict[FaceId, tuple[Vec, Vec, Vec]] = {
    "U": ((0, 1, 0), (1, 0, 0), (0, 0, 1)),
    "R": ((1, 0, 0), (0, 0, -1), (0, -1, 0)),
    "F": ((0, 0, 1), (1, 0, 0), (0, -1, 0)),
    "D": ((0, -1, 0), (1, 0, 0), (0, 0, -1)),
    "L": ((-1, 0, 0), (0, 0, 1), (0, -1, 0)),
    "B": ((0, 0, -1), (-1, 0, 0), (0, -1, 0)),
}


def _frame(face: FaceId, row: int, col: int) -> tuple[Vec, Vec]:
    n, a, b = FACE_AXES[face]
    position = (
        n[0] + (col - 1) * a[0] + (row - 1) * b[0],
        n[1] + (col - 1) * a[1] + (row - 1) * b[1],
        n[2] + (col - 1) * a[2] + (row - 1) * b[2],
    )
    return position, n


_FRAMES: tuple[tuple[Vec, Vec], ...] = tuple(
    _frame(face, k // 3, k % 3) for face in FACE_ORDER for k in range(9)
)
_INDEX: dict[tuple[Vec, Vec], int] = {frame: i for i, frame in enumerate(_FRAMES)}


def facelet_frame(index: int) -> tuple[Vec, Vec]:
    """Return (cubie position, outward sticker normal) for a facelet index."""
    if not 0 <= index < 54:
        raise ValueError(f"facelet index out of range: {index}")
    return _FRAMES[index]


def index_of(position: Vec, normal: Vec) -> int:
    try:
        return _INDEX[(position, normal)]
    except KeyError:
        raise ValueError(f"no facelet at {position} facing {normal}") from None


__all__ = ["FACE_AXES", "Vec", "facelet_frame", "index_of"]
