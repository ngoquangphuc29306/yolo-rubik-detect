from collections.abc import Mapping
from typing import Literal

FaceId = Literal["U", "R", "F", "D", "L", "B"]
ColorName = Literal["white", "yellow", "red", "orange", "blue", "green"]

# Solver serialization order (URFDLB).
FACE_ORDER: tuple[FaceId, ...] = ("U", "R", "F", "D", "L", "B")
FACE_OFFSET: Mapping[FaceId, int] = {"U": 0, "R": 9, "F": 18, "D": 27, "L": 36, "B": 45}
CENTER_INDEX: Mapping[FaceId, int] = {"U": 4, "R": 13, "F": 22, "D": 31, "L": 40, "B": 49}
COLOR_NAMES: tuple[ColorName, ...] = ("white", "yellow", "red", "orange", "blue", "green")

SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
