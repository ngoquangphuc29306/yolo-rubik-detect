from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.cube.constants import ColorName, FaceId

WireCode = Literal[
    "INVALID_FACE_SHAPE",
    "DUPLICATE_CENTER",
    "COLOR_COUNT_MISMATCH",
    "INVALID_CUBE_STATE",
    "SOLVER_TIMEOUT",
    "MODEL_UNAVAILABLE",
    "FRAME_TOO_LARGE",
    "INVALID_FRAME",
]

_STRICT = ConfigDict(extra="forbid", strict=True)
Grid = Annotated[list[ColorName], Field(min_length=9, max_length=9)]


class Faces(BaseModel):
    model_config = _STRICT

    U: Grid
    R: Grid
    F: Grid
    D: Grid
    L: Grid
    B: Grid


class SolveRequest(BaseModel):
    model_config = _STRICT

    schemaVersion: StrictInt
    faces: Faces

    @field_validator("schemaVersion")
    @classmethod
    def _version_is_one(cls, v: int) -> int:
        if v != 1:
            raise ValueError("schemaVersion must be 1")
        return v


class SolveResponse(BaseModel):
    model_config = _STRICT

    schemaVersion: Literal[1] = 1
    centerColors: dict[FaceId, ColorName]
    initialState: str
    moves: list[str]
    moveCount: int


class ErrorBody(BaseModel):
    model_config = _STRICT

    code: WireCode
    message: str
    retryable: bool


class ErrorEnvelope(BaseModel):
    model_config = _STRICT

    error: ErrorBody
