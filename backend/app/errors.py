import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.cube.facelets import CubeInputError, CubeInputErrorCode
from app.cube.legality import IllegalCubeError
from app.schemas import ErrorBody, ErrorEnvelope, WireCode
from app.solver.base import SolverFault, SolverTimeout

log = logging.getLogger(__name__)

SHAPE_MESSAGE = "The solve request is not a valid schema version 1 cube."
INPUT_MESSAGES: dict[CubeInputErrorCode, tuple[str, bool]] = {
    "INVALID_FACE_SHAPE": (SHAPE_MESSAGE, False),
    "DUPLICATE_CENTER": (
        "Two faces have the same center color. Check that each face was scanned once.",
        True,
    ),
    "COLOR_COUNT_MISMATCH": (
        "Each color must appear exactly nine times. Check the scan or scan again.",
        True,
    ),
}
INVALID_STATE_MESSAGE = (
    "The captured cube could not be validated. Check face orientation or scan again."
)
TIMEOUT_MESSAGE = "The solver took too long. Please try again."


class ApiError(Exception):
    def __init__(self, status: int, code: WireCode, message: str, retryable: bool) -> None:
        super().__init__(code)
        self.status = status
        self.code: WireCode = code
        self.message = message
        self.retryable = retryable


def _envelope(status: int, code: WireCode, message: str, retryable: bool) -> JSONResponse:
    body = ErrorEnvelope(error=ErrorBody(code=code, message=message, retryable=retryable))
    return JSONResponse(status_code=status, content=body.model_dump())


def _internal() -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "Internal solver error"})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, exc: ApiError) -> JSONResponse:
        return _envelope(exc.status, exc.code, exc.message, exc.retryable)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Log only error types and locations, never the offending input.
        log.info("rejected request: %s", [(e["type"], e["loc"]) for e in exc.errors()])
        return _envelope(422, "INVALID_FACE_SHAPE", SHAPE_MESSAGE, False)

    @app.exception_handler(CubeInputError)
    async def _input(_: Request, exc: CubeInputError) -> JSONResponse:
        message, retryable = INPUT_MESSAGES[exc.code]
        log.info("rejected cube: %s", exc.code)
        return _envelope(422, exc.code, message, retryable)

    @app.exception_handler(IllegalCubeError)
    async def _illegal(_: Request, exc: IllegalCubeError) -> JSONResponse:
        log.info("illegal cube: %s", exc.reason)
        return _envelope(422, "INVALID_CUBE_STATE", INVALID_STATE_MESSAGE, True)

    @app.exception_handler(SolverTimeout)
    async def _timeout(_: Request, __: SolverTimeout) -> JSONResponse:
        log.warning("solver timed out")
        return _envelope(503, "SOLVER_TIMEOUT", TIMEOUT_MESSAGE, True)

    @app.exception_handler(SolverFault)
    async def _fault(_: Request, exc: SolverFault) -> JSONResponse:
        log.error("solver fault: %s", exc)
        return _internal()

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.error("unexpected error: %s", type(exc).__name__)
        return _internal()
