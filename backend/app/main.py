from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.solve import router as solve_router
from app.config import Settings, load_settings
from app.errors import install_error_handlers
from app.solver.base import Solver
from app.solver.cube_solver_adapter import CubeSolverAdapter
from app.solver.service import SolveService
from app.vision.detector import Detector, ModelUnavailable
from app.vision.state import VisionState
from app.vision.yolo_detector import YoloDetector


def create_app(
    settings: Settings | None = None,
    solver: Solver | None = None,
    detector: Detector | None = None,
) -> FastAPI:
    cfg = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if solver is None:
            adapter = CubeSolverAdapter(cfg.solver_cache_dir)
            adapter.load()  # missing tables must fail startup
            app.state.solve_service = SolveService(adapter, cfg.solver_timeout_s)
        if detector is None:
            yolo = YoloDetector(cfg.model_path, cfg.imgsz, cfg.confidence, cfg.device)
            try:
                yolo.load()
                app.state.vision = VisionState(yolo, None)
            except ModelUnavailable as exc:
                app.state.vision = VisionState(None, str(exc))
        yield

    app = FastAPI(lifespan=lifespan)
    if solver is not None:
        app.state.solve_service = SolveService(solver, cfg.solver_timeout_s)
    app.state.settings = cfg
    app.state.vision = VisionState(
        detector, None if detector else "Vision model has not been loaded."
    )
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(solve_router)
    return app
