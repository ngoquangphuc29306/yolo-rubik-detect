from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.solve import router as solve_router
from app.config import Settings, load_settings
from app.errors import install_error_handlers
from app.solver.base import Solver
from app.solver.cube_solver_adapter import CubeSolverAdapter
from app.solver.service import SolveService


def create_app(settings: Settings | None = None, solver: Solver | None = None) -> FastAPI:
    cfg = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if solver is None:
            adapter = CubeSolverAdapter(cfg.solver_cache_dir)
            adapter.load()  # missing tables must fail startup
            app.state.solve_service = SolveService(adapter, cfg.solver_timeout_s)
        yield

    app = FastAPI(lifespan=lifespan)
    if solver is not None:
        app.state.solve_service = SolveService(solver, cfg.solver_timeout_s)
    install_error_handlers(app)
    app.include_router(solve_router)
    return app
