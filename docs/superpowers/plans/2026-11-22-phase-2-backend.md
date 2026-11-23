# RubikVision Phase 2 — Backend Validation & Solving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved by the user 2026-11-23 (Q1–Q5; `cube-solver==1.1.4`), with the review corrections of design §13 applied below. Execute on `feat/phase-2-backend`; stop at the Task 11 gate.

**Goal:** A local FastAPI backend that serves `GET /health` and `POST /api/solve` exactly as the Phase 1 frontend expects, with independent physical-legality validation, a real two-phase solver and server-side replay of every solution.

**Architecture:** A pure `app/cube/` core (facelet construction, geometry, 18-move engine, cubie legality) that knows nothing about HTTP or the solver library; an `app/solver/` adapter around `cube-solver` behind a `Solver` protocol plus a service that runs validate → solve → replay; thin FastAPI routes with strict Pydantic models and one error envelope. Correctness is pinned by shared fixtures generated from the TypeScript engine and by backend-recorded responses checked with the frontend's own parser and binder.

**Tech Stack:** Python 3.12, uv (`pyproject.toml` + `uv.lock`), FastAPI, Pydantic v2, Uvicorn, `cube-solver` 1.1.4 (MIT), pytest + httpx (`TestClient`), ruff, mypy `--strict`; Vitest for the two test-only frontend files.

**Spec:** `docs/superpowers/specs/2026-11-22-phase-2-backend-design.md`

## Global Constraints

- Branch `feat/phase-2-backend` created from `main` (`cae4df6`). No merge, push, remote, git-config change or destructive git command. Stage explicit paths; never `.claude/` or `skills-lock.json`.
- Python `>=3.12,<3.13` (`.python-version` = `3.12`); all Python commands run from `backend/` via `uv run`.
- Runtime dependencies exactly: `fastapi`, `pydantic`, `uvicorn`, `cube-solver==1.1.4` (approved). Dev: `pytest`, `httpx`, `ruff`, `mypy`. Versions are pinned by `uv.lock`; add nothing else without approval.
- No change to anything under `frontend/src/`, to `frontend/package.json`/lockfile, or to existing files in `fixtures/`. New fixtures are additive.
- Wire contract = `frontend/src/types/api.ts` schema v1. No new fields, codes or statuses (design Q2/Q3 defaults).
- Exact copy: `DUPLICATE_CENTER` message `Two faces have the same center color. Check that each face was scanned once.`; `INVALID_CUBE_STATE` message `The captured cube could not be validated. Check face orientation or scan again.`; health `error` `Vision is not available in this build.`
- Status map (design §5.3): shape → 422 `INVALID_FACE_SHAPE` retryable false; duplicate centre → 422 `DUPLICATE_CENTER` true; counts → 422 `COLOR_COUNT_MISMATCH` true; illegal → 422 `INVALID_CUBE_STATE` true; time limit (library returned `None` **and** set `terminated`) → 503 `SOLVER_TIMEOUT` true; internal fault (`None` without `terminated`, unknown token, replay mismatch, unexpected exception) → 500 `{"detail":"Internal solver error"}` without envelope.
- Start command (only form): `uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000` from `backend/`; no module-level `app`.
- The real `/api/solve` never returns a solution that has not been replayed to solved by `app/cube/moves.py`. Test doubles for `Solver` exist only under `backend/tests/`.
- Solver tables live in `RUBIK_SOLVER_CACHE_DIR` (default `backend/.solver-cache/`, git-ignored); never committed; never built implicitly at server start.
- Server binds `127.0.0.1:8000` only; no CORS middleware; no request body is persisted or logged.
- Every task ends with `uv run pytest`, `uv run ruff check .`, `uv run mypy app` green (plus the Vitest file it touches) and real output recorded in the task report.

## Review Focus

1. **`schemaVersion: true`, `"1"` or `1.0`** — Python treats `True == 1`; a lax model accepts it. Expect 422 `INVALID_FACE_SHAPE`. Pinned in Task 6 (`test_schema_version_rejects_bool_and_string`).
2. **Colour names with different case or whitespace (`"White"`, `" red"`)** — expect 422 `INVALID_FACE_SHAPE`, never normalization. Pinned in Task 1 and Task 6.
3. **A non-conventional colour scheme** (the six colours permuted across centres) — the backend must not assume white-opposite-yellow; a relabelled legal cube solves and `centerColors` reflects the request. Pinned in Task 6 (`test_solve_relabelled_scheme`).
4. **Two solve requests at the same time** — the solver object is not thread-safe; both must return correct, replay-verified results. Pinned in Task 5 (`test_concurrent_solves_are_serialized`).
5. **A whole face captured rotated by 90°/180° (orientation error, design R1)** — expect 422 `INVALID_CUBE_STATE` for the asymmetric fixture with one face rotated; the backend never rotates it back. Pinned in Task 4 (`test_rotated_face_is_illegal`) and Task 6.

---

## File map

| Path | Responsibility | Task |
| --- | --- | --- |
| `backend/pyproject.toml`, `uv.lock`, `.python-version` | project, pins, pytest/ruff/mypy config | 1 |
| `backend/app/__init__.py`, `app/cube/__init__.py` | packages | 1 |
| `backend/app/cube/constants.py` | `FaceId`, `ColorName`, `FACE_ORDER`, `FACE_OFFSET`, `CENTER_INDEX`, `COLOR_NAMES`, `SOLVED` | 1 |
| `backend/app/cube/facelets.py` | `build_facelet_state`, `CubeInputError` | 1 |
| `backend/app/cube/geometry.py` | facelet index ↔ (position, normal) from §6.4 table | 2 |
| `backend/app/cube/moves.py` | 18 permutations; apply/replay/verify | 2 |
| `frontend/tests/crosscheck/engine-fixtures.test.ts` | generate/guard `fixtures/engine/move-sequences.json` (test-only) | 3 |
| `fixtures/engine/move-sequences.json` | TS-engine states after every move | 3 |
| `backend/app/cube/legality.py` | cubie conversion and legality checks | 4 |
| `backend/app/solver/{__init__,base,cube_solver_adapter,prepare}.py` | solver protocol, adapter, explicit table build | 5 |
| `backend/app/solver/service.py` | solve pipeline | 6 |
| `backend/app/{config,errors,schemas,main}.py`, `app/api/{__init__,health,solve}.py` | settings, envelope/handlers, models, app factory, routes | 6, 7 |
| `fixtures/solve/backend-solutions.json` | real backend request/response pairs | 8 |
| `frontend/tests/crosscheck/backend-solutions.test.ts` | parse + bind the recorded responses (test-only) | 8 |
| `.gitignore` | backend caches, venv, tables | 1, 5 |
| `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/superpowers/reports/phase2-verification.md` | docs and evidence | 9, 10 |

Tests mirror the package: `backend/tests/cube/`, `tests/solver/`, `tests/api/`, `tests/crosscheck/`; `backend/tests/conftest.py` provides `REPO_ROOT`, `load_fixture(rel_path) -> Any`, and (Task 5) a session-scoped `real_solver`.

---

### Task 1: Backend scaffold and facelet construction

**Files:**
- Create: `backend/pyproject.toml`, `backend/.python-version`, `backend/app/__init__.py`, `backend/app/cube/__init__.py`, `backend/app/cube/constants.py`, `backend/app/cube/facelets.py`, `backend/tests/conftest.py`, `backend/tests/cube/test_facelets.py`; `backend/uv.lock` (generated)
- Modify: `.gitignore` (add `backend/.venv/`, `**/__pycache__/`, `backend/.pytest_cache/`, `backend/.mypy_cache/`, `backend/.ruff_cache/`)

**Interfaces:**
- Produces: `FaceId = Literal["U","R","F","D","L","B"]`; `ColorName = Literal["white","yellow","red","orange","blue","green"]`; `FACE_ORDER: tuple[FaceId, ...]`; `FACE_OFFSET: Mapping[FaceId, int]` (U0 R9 F18 D27 L36 B45); `CENTER_INDEX` (U4 R13 F22 D31 L40 B49); `COLOR_NAMES: tuple[ColorName, ...]`; `SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"`.
- Produces: `class CubeInputError(Exception)` with `code: Literal["INVALID_FACE_SHAPE","DUPLICATE_CENTER","COLOR_COUNT_MISMATCH"]`; `build_facelet_state(faces: Mapping[str, Sequence[str]]) -> tuple[str, dict[FaceId, ColorName]]` (state, centers). Check order equals `buildFaceletState`: shape/unknown colour → duplicate centre → counts.

- [ ] **Step 1: Scaffold.** `uv init --bare` in `backend/`, set `requires-python = ">=3.12,<3.13"`, `uv add fastapi pydantic uvicorn`, `uv add --dev pytest httpx ruff mypy`. Config: `[tool.pytest.ini_options] testpaths=["tests"], markers=["slow: hundreds of real solves"], addopts="-m 'not slow'"`; `[tool.mypy] strict=true`; ruff default rules + `I`. Run `uv run pytest` → "no tests ran" (exit 5) is the expected baseline.
- [ ] **Step 2: Write failing tests** in `tests/cube/test_facelets.py`:
  - `test_solved_request_builds_solved_state`: `build_facelet_state(load_fixture("fixtures/solve/solved.request.json")["faces"]) == (SOLVED, {"U":"white","R":"red","F":"green","D":"yellow","L":"orange","B":"blue"})`.
  - `test_scramble_a_matches_fixture_initial_state`: state equals `load_fixture("fixtures/solve/scramble-a.response.json")["initialState"]` (`DDFFUUULBLFDDRLLRBRUDRFLRBFBUUBDUBBLLRFRLDUDDRFFFBBULR`) and centers equal its `centerColors`.
  - `test_row_major_outside_view_indices`: on the solved request set `faces["F"][2]="red"` and `faces["R"][0]="green"` (swap the two stickers of one edge-adjacent pair keeps counts) → state index 20 is `"R"` and index 9 is `"F"`.
  - `test_errors` parametrized: missing face, extra face key `"X"`, 8 entries, unknown colour `"purple"`, `"White"` → `INVALID_FACE_SHAPE`; two `white` centres → `DUPLICATE_CENTER`; one sticker recoloured → `COLOR_COUNT_MISMATCH`.
- [ ] **Step 3: Run** `uv run pytest tests/cube/test_facelets.py -v` → FAIL (import error).
- [ ] **Step 4: Implement** `constants.py` and `build_facelet_state` (translate colours through the inverse centre map, concatenate in `FACE_ORDER`).
- [ ] **Step 5: Run** tests, `uv run ruff check .`, `uv run mypy app` → all pass.
- [ ] **Step 6: Commit** `feat(backend): scaffold uv project and canonical facelet construction` (explicit paths incl. `uv.lock`, `.gitignore`).

### Task 2: Geometry and the Python move engine

**Files:**
- Create: `backend/app/cube/geometry.py`, `backend/app/cube/moves.py`, `backend/tests/cube/test_geometry.py`, `backend/tests/cube/test_moves.py`

**Interfaces:**
- Consumes: Task 1 constants.
- Produces: `Vec = tuple[int, int, int]`; `facelet_frame(index: int) -> tuple[Vec, Vec]` (cubie position, outward normal) via `p = n + (c−1)a + (r−1)b` with the §6.4 table (U: n+Y a+X b+Z; R: +X −Z −Y; F: +Z +X −Y; D: −Y +X −Z; L: −X +Z −Y; B: −Z −X −Y); `index_of(position: Vec, normal: Vec) -> int`.
- Produces: `MOVE_TOKENS: tuple[str, ...]` (18, order `U U' U2 R R' R2 F F' F2 D D' D2 L L' L2 B B' B2`); `PERMUTATIONS: Mapping[str, tuple[int, ...]]` meaning `new[i] = old[perm[i]]`; `parse_move(token: str) -> str` (raises `ValueError` on anything outside the 18); `apply_move(state: str, token: str) -> str`; `apply_moves(state: str, tokens: Sequence[str]) -> str`; `is_solved(state: str) -> bool`; `verify_solution(state: str, tokens: Sequence[str]) -> bool`.

- [ ] **Step 1: Write failing tests.** `test_geometry.py`: every index 0–53 round-trips through `facelet_frame`/`index_of`; centres map to `(n, n)`; 8 positions carry 3 facelets, 12 carry 2, 6 carry 1. `test_moves.py`: for all 18 tokens on a seeded 25-move scramble: `m`×4 = id, `m2`×2 = id, `m` then `m'` = id, centres fixed, `Counter(state)` conserved; `parse_move` rejects `"u"`, `"R3"`, `"x"`, `"M"`, `""`, `"R'2"`; superflip `U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2` from `SOLVED` equals `UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB`; hand goldens on solved: after `U` the F face top row (indices 18–20) is `RRR`; after `R` the U face right column (2, 5, 8) is `FFF`; after `D` F bottom row (24–26) is `LLL`; after `F` the R left column (9, 12, 15) is `UUU`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Build each base clockwise permutation by rotating position and normal of every facelet in the layer (`x=+1` for R, etc.) with the integer matrix for −90° about the face's outward normal (§7.2), then `index_of`; derive `'` and `2` by composition.
- [ ] **Step 4: Run** tests/ruff/mypy → pass.
- [ ] **Step 5: Commit** `feat(backend): geometry table and 18-move engine`.

### Task 3: TypeScript-engine fixtures and Python equality (cross-check 1)

**Files:**
- Create: `frontend/tests/crosscheck/engine-fixtures.test.ts`, `fixtures/engine/move-sequences.json` (generated), `backend/tests/crosscheck/test_engine_fixtures.py`

**Interfaces:**
- Consumes: TS `applyMove`, `parseMoveToken` (`frontend/src/engine/move-engine.ts`), `SOLVED` (`cube-state.ts`); Python `apply_move`.
- Produces: `fixtures/engine/move-sequences.json` = `{"schema":"engine-move-sequences/1","generator":"frontend/tests/crosscheck/engine-fixtures.test.ts","seed":20261122,"sequences":[{"moves":[...25 tokens],"states":[S0..S25]}]}` with 40 sequences starting from `SOLVED`, plus `"singleMoves": {token: stateAfterTokenOnScrambleA}` for all 18 tokens applied to the `scramble-a` initial state.

- [ ] **Step 1: Write the Vitest file.** Seeded mulberry32 generator (no consecutive same face); when `process.env.UPDATE_ENGINE_FIXTURES === '1'` write the file (2-space JSON, trailing newline), otherwise `expect(readJson()).toEqual(generate())`; a second test asserts every one of the 18 tokens occurs in `sequences`.
- [ ] **Step 2: Run** `npx vitest run tests/crosscheck/engine-fixtures.test.ts` from `frontend/` → FAIL (file missing). Generate with `UPDATE_ENGINE_FIXTURES=1` (PowerShell: `$env:UPDATE_ENGINE_FIXTURES='1'`), unset, rerun → PASS.
- [ ] **Step 3: Write** `test_engine_fixtures.py`: for every sequence assert `apply_move(S[i], moves[i]) == S[i+1]` (report sequence/step on failure); `singleMoves` equality for all 18 tokens.
- [ ] **Step 4: Run** `uv run pytest tests/crosscheck -v` → RED first (fixture absent before Step 2 ran), then PASS. This task checks code that already exists, so there is no implementation step. Any mismatch is a blocker (spec §8): stop and report; do not edit either engine to make the fixtures agree.
- [ ] **Step 5: Run** full `npm run test` and `npm run lint` in `frontend/` (counts must be 761 + new tests, 0 failures) and the backend checks.
- [ ] **Step 6: Commit** `test(crosscheck): TypeScript-generated engine fixtures and Python equality`.

### Task 4: Cubie legality

**Files:**
- Create: `backend/app/cube/legality.py`, `backend/tests/cube/test_legality.py`

**Interfaces:**
- Consumes: `facelet_frame`, `index_of` (Task 2); `apply_moves` for test states; `fixtures/engine/move-sequences.json`.
- Produces: `IllegalReason = Literal["CORNER_IDENTITY","EDGE_IDENTITY","CORNER_TWIST","EDGE_FLIP","PARITY"]`; `class IllegalCubeError(Exception)` with `reason: IllegalReason`; `@dataclass(frozen=True) CubieState(cp: tuple[int,...], co: tuple[int,...], ep: tuple[int,...], eo: tuple[int,...])`; `to_cubies(state: str) -> CubieState` (raises identity reasons); `check_legal(state: str) -> None`.

- [ ] **Step 1: Write failing tests.** Accept: `SOLVED`, every `S[i]` in the engine fixture. Reject with exact reason: URF corner twisted once (rotate indices 8, 9, 20) → `CORNER_TWIST`; UR edge flipped (swap 5, 10) → `EDGE_FLIP`; UR and UF edges swapped as whole cubies on `SOLVED` (swap 5↔7 and 10↔19) → `PARITY`; two corners swapped → `PARITY`; a corner whose three stickers are `U,U,R`-impossible combination (e.g. indices 8, 9, 20 set to `U`,`D`,`F` with counts rebalanced elsewhere) → `CORNER_IDENTITY`; an edge pair `U/D` → `EDGE_IDENTITY`; `test_rotated_face_is_illegal`: rotate the 9 F-face stickers of the `scramble-a` state by 90° (non-centre ring shift) → raises `IllegalCubeError`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Derive corner/edge slots from geometry (positions with 3/2 facelets), listing each corner's facelets clockwise starting from its U/D facelet and each edge's facelets U/D-or-F/B first (Kociemba conventions, spec §6); identify cubies by their home-face letter sets; twist = position of the U/D letter; flip = 0 when the slot's primary facelet holds the cubie's primary letter; parity by cycle count.
- [ ] **Step 4: Run** tests/ruff/mypy → pass.
- [ ] **Step 5: Commit** `feat(backend): cubie legality validation`.

### Task 5: Solver adapter and explicit table preparation

**Files:**
- Create: `backend/app/solver/__init__.py`, `base.py`, `cube_solver_adapter.py`, `prepare.py`; `backend/tests/solver/test_adapter.py`
- Modify: `backend/pyproject.toml` (`uv add cube-solver==1.1.4`), `.gitignore` (`backend/.solver-cache/`), `backend/tests/conftest.py` (`real_solver` session fixture)

**Interfaces:**
- Produces (`base.py`): `class Solver(Protocol): def solve(self, state: str, timeout_s: int) -> list[str]: ...`; `class SolverTimeout(Exception)`; `class SolverFault(Exception)`; `class SolverTablesMissing(Exception)`.
- Produces (`cube_solver_adapter.py`): `class CubeSolverAdapter` with `__init__(self, cache_dir: Path)`, `load(self) -> None` (raises `SolverTablesMissing` naming `python -m app.solver.prepare` when `cache_dir/tables/transition.npz` or `cache_dir/tables/pruning_kociemba.npz` is absent; the library reads `tables/` relative to the working directory, so `load` changes directory to `cache_dir` only while constructing `Kociemba()` and restores it in `finally`; `test_load_restores_cwd` pins that), `solve(self, state: str, timeout_s: int) -> list[str]` (classifies a `None` result by the library's `terminated` attribute: `None` and `terminated` → `SolverTimeout`; `None` without `terminated` → `SolverFault`; an unknown library token → `SolverFault`; returns tokens normalized to the 18; holds an internal `threading.Lock`).
- Produces (`prepare.py`): `main(cache_dir: Path | None = None) -> int` and `python -m app.solver.prepare` (reads `RUBIK_SOLVER_CACHE_DIR`), printing elapsed time and sizes.
- Produces (`conftest.py`): session fixture `real_solver() -> CubeSolverAdapter` (fails, not skips, with the prepare instruction if tables are missing).

- [ ] **Step 1: Write failing tests:** `test_load_without_tables_raises` (empty tmp dir → `SolverTablesMissing` whose message contains `python -m app.solver.prepare`); `test_notation_conversion_roundtrip` (URFDLB → library colour representation → back for `SOLVED` and `scramble-a`); `test_solves_fixture_states` (for `scramble-a` and 10 engine-fixture final states: tokens ⊂ 18 and `verify_solution` true); `test_timeout_zero_on_superflip_raises_or_verifies` (with `timeout_s=0` either `SolverTimeout` or a verifying solution — never an unverified list); `test_concurrent_solves_are_serialized` (8 threads × different states, all verify); `test_none_with_termination_is_timeout` and `test_none_without_termination_is_fault` (replace the adapter's library object with a test-only stub whose `solve` returns `None` and whose `terminated` is `True`/`False`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Build tables once:** `uv run python -m app.solver.prepare` (expect ~6–7 min, ~1.6 GB in `backend/.solver-cache/`); record time and size.
- [ ] **Step 4: Implement** adapter and prepare (library colour letters `W G R Y B O`, face order `U L F R B D`, as measured in the design benchmark).
- [ ] **Step 5: Run** tests/ruff/mypy → pass; `git status` shows no table files.
- [ ] **Step 6: Commit** `feat(backend): cube-solver adapter and explicit table preparation`.

### Task 6: Solve service, schemas, errors and `POST /api/solve`

**Files:**
- Create: `backend/app/solver/service.py`, `backend/app/errors.py`, `backend/app/schemas.py`, `backend/app/config.py`, `backend/app/main.py`, `backend/app/api/__init__.py`, `backend/app/api/solve.py`; tests `backend/tests/solver/test_service.py`, `backend/tests/api/test_solve_api.py`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces: `SolveResult` dataclass `(center_colors: dict[FaceId, ColorName], initial_state: str, moves: list[str])`; `class SolveService` with `__init__(self, solver: Solver, timeout_s: int)` and `async def solve(self, faces: Mapping[str, Sequence[str]]) -> SolveResult` (raises `CubeInputError`, `IllegalCubeError`, `SolverTimeout`, `SolverFault`; solved short-circuit; `asyncio.Lock` + `asyncio.to_thread`; replay via `verify_solution`).
- Produces: Pydantic models (`ConfigDict(extra="forbid", strict=True)`) `SolveRequest{schemaVersion: StrictInt with a field validator requiring == 1 (not `Literal[1]`); faces: dict[FaceId, list[ColorName]]}` with exactly-9 constraint (`StrictStr`-based colour literal, no case folding), `SolveResponse`, `ErrorBody{code, message, retryable}`, `ErrorEnvelope{error}`; `WireCode` literal of the 8 frontend codes.
- Produces: `class ApiError(Exception)(status: int, code: WireCode, message: str, retryable: bool)`; `install_error_handlers(app: FastAPI) -> None` (maps `RequestValidationError`, JSON decode errors, domain errors per Global Constraints; `SolverFault` and a catch-all `Exception` handler → 500 with body `{"detail":"Internal solver error"}`, no `error` key, no traceback).
- Produces: `@dataclass(frozen=True) Settings(detector_mode: Literal["yolo"], solver_cache_dir: Path, solver_timeout_s: int)`; `load_settings(env: Mapping[str, str] = os.environ) -> Settings` (raises `ConfigError` for `fixture` or unknown modes); `create_app(settings: Settings | None = None, solver: Solver | None = None) -> FastAPI` (lifespan calls `load()` when no solver is injected). Run with `uvicorn --factory app.main:create_app`.

- [ ] **Step 1: Write failing service tests:** solved → `moves == []` and an injected recording double is not called; illegal → `IllegalCubeError`; double returning `["R"]` for a state that needs more → `SolverFault`; double raising `SolverTimeout` propagates; real solver on `scramble-a` verifies.
- [ ] **Step 2: Write failing API tests** (`TestClient(create_app(solver=real_solver))`): `solved.request.json` → 200 body `== solved.response.json`; `scramble-a.request.json` → 200, `initialState`/`centerColors` equal the fixture, `moveCount == len(moves)`, all tokens legal, `verify_solution` true; duplicate centre → 422 body `== duplicate-center.error.json`; twisted corner → 422 body `== invalid-cube-state.error.json`; count mismatch → 422 `COLOR_COUNT_MISMATCH`; parametrized malformed bodies (not JSON, `[]`, missing `faces`, extra top-level key, `schemaVersion` 2/`true`/`false`/`"1"`/`1.0` (`test_schema_version_rejects_bool_and_string`), face of 8, `"White"`) → 422 `INVALID_FACE_SHAPE` with exactly the three envelope keys; double raising `SolverTimeout` → 503 `SOLVER_TIMEOUT` retryable true; double returning a wrong list → `SolverFault` → 500 with no `error` key (default `TestClient`: the fault is handled, nothing is re-raised); `test_unexpected_exception_returns_500`: double raising `RuntimeError`, client built as `TestClient(app, raise_server_exceptions=False)` because the default client re-raises unhandled exceptions → 500, body `{"detail":"Internal solver error"}`; `test_solve_relabelled_scheme`: map the six colour names of `scramble-a` through a fixed permutation → 200, `centerColors` reflects it, replay verifies.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** service, schemas, errors, config, app factory and route.
- [ ] **Step 5: Run** all backend tests/ruff/mypy → pass.
- [ ] **Step 6: Commit** `feat(backend): solve service and POST /api/solve with strict contracts`.

### Task 7: `GET /health`

**Files:**
- Create: `backend/app/api/health.py`, `backend/tests/api/test_health_api.py`, `backend/tests/test_config.py`
- Modify: `backend/app/main.py` (router)

**Interfaces:**
- Consumes: `Settings`, `create_app`.
- Produces: `HealthResponse` model (required `schemaVersion,status,detectorMode,visionReady,solverReady`; optional `modelVersion,device,error`; `exclude_none` on output).

- [ ] **Step 1: Write failing tests:** body `== {"schemaVersion":1,"status":"degraded","detectorMode":"yolo","visionReady":false,"solverReady":true,"error":"Vision is not available in this build."}`; key set ⊆ the frontend's allowed keys and equals `fixtures/health/model-unavailable.json` keys; `load_settings({"RUBIK_DETECTOR_MODE":"fixture"})` and `"banana"` raise `ConfigError`; `create_app` with an empty tables dir fails at startup with the prepare instruction.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(backend): GET /health reporting solver ready and vision unavailable`.

### Task 8: Solver cross-check at scale and frontend binding of real responses (cross-check 2)

**Files:**
- Create: `backend/tests/crosscheck/test_solver_crosscheck.py`, `backend/tests/crosscheck/record_backend_solutions.py`, `fixtures/solve/backend-solutions.json` (generated), `frontend/tests/crosscheck/backend-solutions.test.ts`

**Interfaces:**
- Consumes: `create_app`, engine fixtures, `facesFromState`-equivalent in Python (add `faces_from_state(state: str, centers: Mapping[FaceId, ColorName]) -> dict[FaceId, list[ColorName]]` to `facelets.py` with a round-trip test).
- Produces: `fixtures/solve/backend-solutions.json` = `{"schema":"backend-solutions/1","generatedBy":"backend/tests/crosscheck/record_backend_solutions.py","solver":"cube-solver 1.1.4","cases":[{"id","request","response"}]}` — 40 cases from the engine-fixture final states plus `solved` and `scramble-a`.

- [ ] **Step 1:** `@pytest.mark.slow test_300_seeded_states`: 300 states from a seeded Python generator using `apply_moves` → POST through `TestClient` → 200 and `verify_solution`; record p50/p95/max solve time to stdout.
- [ ] **Step 2:** `test_recorded_solutions_replay` (not slow): every recorded response replays in Python and its `request` rebuilds the same `initialState`.
- [ ] **Step 3:** Vitest `backend-solutions.test.ts` (first line `// @vitest-environment node`): for each case `parseSolveResponse(response).ok` and `bindSolveResponse(request, parsed.value).ok`. In the same file, a live block `describe.runIf(process.env.RUBIK_LIVE_BASE_URL)('live backend via frontend clients', …)` that imports the **unmodified** `getHealth` (`@/services/health-client`), `solve` (`@/services/solver-client`), `deriveLiveReadiness` and `bindSolveResponse`, passes `baseUrl: process.env.RUBIK_LIVE_BASE_URL` and an `AbortController().signal`, and asserts: health equals the Phase 2 body and readiness is `{kind:'blocked', reason:'MODEL_UNAVAILABLE', solverReady:true}`; `solve(solved.request)` → `ok`, `outcome.source === 'backend'`, `moves` empty; `solve(scramble-a.request)` → `ok` and `bindSolveResponse(request, outcome.response).ok`; `solve(duplicate-center request)` → `{ok:false, error:{kind:'api', code:'DUPLICATE_CENTER', retryable:true}}`. Without the variable the block reports as skipped.
- [ ] **Step 4:** Run both RED (fixture missing) → record with `uv run python -m tests.crosscheck.record_backend_solutions` → GREEN; run `uv run pytest -m slow -s`.
- [ ] **Step 5: Commit** `test(crosscheck): real solver outputs verified by Python and the frontend binder`.

### Task 9: Live smoke through the Vite proxy

**Files:** none committed except the report rows (Task 10). Evidence in the git-ignored workspace.

- [ ] **Step 1:** `uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000` (record startup time and RSS) and `npm run dev` in `frontend/`.
- [ ] **Step 2: Frontend client integration (required):** from `frontend/`, `$env:RUBIK_LIVE_BASE_URL='http://127.0.0.1:5173'; npx vitest run tests/crosscheck/backend-solutions.test.ts` → the live block runs (0 skipped) and passes; then unset the variable. Supplementary: `curl -s http://127.0.0.1:5173/health` equals the Task 7 body; `curl -s -X POST -H "Content-Type: application/json" --data @fixtures/solve/scramble-a.request.json http://127.0.0.1:5173/api/solve` → 200 that replays (pipe to a Python check); the duplicate-centre fixture → 422 envelope.
- [ ] **Step 3:** playwright-cli at 1440×900: Landing → "Scan My Cube" shows "Vision model is not available — the solver is still usable", no DEMO banner, capture disabled; demo flow unchanged (one Solving screenshot). Never click "Enable camera".
- [ ] **Step 4:** Stop both servers by PID; confirm ports 8000/5173 closed and `git status` clean apart from the user's two files.

### Task 10: Documentation and Phase 2 verification report

**Files:**
- Modify: `README.md` (Backend section: prerequisites, `uv sync`, `uv run python -m app.solver.prepare` with time/disk warning, run command, tests, env vars), `CLAUDE.md` (only the "Backend (once created)" command line → `uv run pytest` / factory command; roadmap sentence: Phase 1 merged, Phase 2 status), `docs/ARCHITECTURE.md` (v1.2 changelog; status line; §2 solver row; §6.5 validator; §8.1 status; §8.3 status map; §10 actual backend tree; §11 solver licence and resources; §12.1 cross-check done with evidence; §13 status; §14 risks R1–R8 from the design; note YOLO26s report for Phase 6)
- Create: `docs/superpowers/reports/phase2-verification.md`

- [ ] **Step 1:** Write docs; every number from a command run in this phase.
- [ ] **Step 2:** `git grep -nE "kociemba\b" -- docs README.md CLAUDE.md` — each hit is either the algorithm name or historical text (explain each).
- [ ] **Step 3: Commit** `docs: Phase 2 backend architecture, README and verification report`.

### Task 11: Phase 2 gate (verification only)

- [ ] From `backend/`: `uv sync --locked`, `uv run pytest -m "slow or not slow"`, `uv run ruff check .`, `uv run mypy app` — record counts and exit codes.
- [ ] From `frontend/`: `npm ci`, `npm run lint`, `npm run test`, `npm run build` — record counts (761 + new; the live block counts as skipped here).
- [ ] Live client integration: start the backend (`uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000`) and `npm run dev`, run the live block as in Task 9 Step 2 (must run, not skip, and pass), then stop both servers by PID and confirm ports 8000/5173 are closed.
- [ ] `git status --short`, `git log --oneline main..HEAD`, `git remote -v` (empty), `git ls-files backend | grep -E "solver-cache|\.npz|\.venv"` (empty).
- [ ] Fill the report's summary table PASS / FAIL / NOT RUN / BLOCKED, list limitations (R1 orientation, no physical cube, vision absent), and **stop for the user's approval**. Do not start Phase 3.

---

## Dependencies and milestones

```text
M1 cube core      T1 → T2 → T3 (cross-check 1) → T4
M2 solver         T5 → T6 → T7
M3 cross-check    T8 (needs T3, T6)
M4 integration    T9 (needs T7) → T10 → T11 gate
```

Stop conditions: any Python/TypeScript/fixture mismatch (T3, T8), any solution that fails replay, any need to change a frontend contract, or the solver table build failing on this machine.
