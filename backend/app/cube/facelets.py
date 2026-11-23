from collections.abc import Mapping, Sequence
from typing import Literal

from app.cube.constants import COLOR_NAMES, FACE_ORDER, ColorName, FaceId

CubeInputErrorCode = Literal["INVALID_FACE_SHAPE", "DUPLICATE_CENTER", "COLOR_COUNT_MISMATCH"]


class CubeInputError(Exception):
    def __init__(self, code: CubeInputErrorCode, message: str) -> None:
        super().__init__(message)
        self.code: CubeInputErrorCode = code


def build_facelet_state(
    faces: Mapping[str, Sequence[str]],
) -> tuple[str, dict[FaceId, ColorName]]:
    """Port of the frontend buildFaceletState: shape/colour, duplicate centre, counts."""
    extra = set(faces) - set(FACE_ORDER)
    if extra:
        raise CubeInputError("INVALID_FACE_SHAPE", f"Unexpected face keys: {sorted(extra)}")

    grids: dict[FaceId, Sequence[ColorName]] = {}
    for f in FACE_ORDER:
        g = faces.get(f)
        if g is None:
            raise CubeInputError("INVALID_FACE_SHAPE", f"Face {f} is missing")
        if isinstance(g, str) or len(g) != 9:
            raise CubeInputError("INVALID_FACE_SHAPE", f"Face {f} must have exactly 9 entries")
        for c in g:
            if c not in COLOR_NAMES:
                raise CubeInputError("INVALID_FACE_SHAPE", f"Unknown colour on face {f}")
        grids[f] = g  # type: ignore[assignment]

    centers: dict[FaceId, ColorName] = {}
    home_of: dict[ColorName, FaceId] = {}
    for f in FACE_ORDER:
        c = grids[f][4]
        if c in home_of:
            raise CubeInputError("DUPLICATE_CENTER", f"Centre colour {c} used twice")
        home_of[c] = f
        centers[f] = c

    for color in COLOR_NAMES:
        n = sum(g.count(color) for g in grids.values())
        if n != 9:
            raise CubeInputError("COLOR_COUNT_MISMATCH", f"Expected 9 of {color}, got {n}")

    state = "".join(home_of[c] for f in FACE_ORDER for c in grids[f])
    return state, centers
