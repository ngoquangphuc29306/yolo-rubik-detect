from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

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


class HealthResponse(BaseModel):
    model_config = _STRICT

    schemaVersion: Literal[1] = 1
    status: Literal["ok", "degraded"]
    detectorMode: Literal["yolo"]
    visionReady: bool
    solverReady: bool
    modelVersion: str | None = None
    device: str | None = None
    error: str | None = None


class ScanHello(BaseModel):
    model_config = _STRICT

    type: Literal["hello"]
    schemaVersion: Literal[1]
    scanId: Annotated[str, Field(min_length=1, max_length=64)]


class ScanReady(BaseModel):
    model_config = _STRICT

    type: Literal["ready"] = "ready"
    schemaVersion: Literal[1] = 1
    scanId: str
    modelVersion: str
    imgsz: int
    maxFrameBytes: int
    maxFrameEdge: int


class WireDetection(BaseModel):
    model_config = _STRICT

    classId: int
    color: ColorName
    confidence: float
    xyxy: Annotated[list[float], Field(min_length=4, max_length=4)]


class WireCell(BaseModel):
    model_config = _STRICT

    color: ColorName | None
    confidence: float | None
    status: Literal["ok", "missing", "ambiguous", "misaligned"]


class WireQuality(BaseModel):
    model_config = _STRICT

    valid: bool
    reason: str | None = None

    @model_validator(mode="after")
    def _reason_iff_invalid(self) -> "WireQuality":
        if self.valid != (self.reason is None):
            raise ValueError("reason must be present exactly when valid is false")
        return self


class WireFace(BaseModel):
    model_config = _STRICT

    x0: float
    y0: float
    x1: float
    y1: float


class ScanFrameResult(BaseModel):
    model_config = _STRICT

    type: Literal["frame_result"] = "frame_result"
    schemaVersion: Literal[1] = 1
    scanId: str
    frameSeq: int
    width: int
    height: int
    detections: list[WireDetection]
    cells: Annotated[list[WireCell], Field(min_length=9, max_length=9)]
    grid: Grid | None
    quality: WireQuality
    face: WireFace | None
    inferenceMs: float


class ScanError(BaseModel):
    model_config = _STRICT

    type: Literal["error"] = "error"
    schemaVersion: Literal[1] = 1
    code: Literal["FRAME_TOO_LARGE", "INVALID_FRAME", "MODEL_UNAVAILABLE"]
    message: str
    retryable: bool
