# RubikVision — Phase 2 Technical Design: FastAPI backend, cube validation and solving

| Field | Value |
| --- | --- |
| Status | **Approved by the user 2026-11-23** (Q1–Q5 as defaulted; `cube-solver==1.1.4`), with the review corrections in §13 applied. |
| Date | 2026-11-22 |
| Scope | `GET /health`, `POST /api/solve`, canonical reconstruction, physical legality, real two-phase solver, Pydantic contracts, cross-checks against the Phase 1 TypeScript engine |
| Out of scope | Vision, YOLO/weights, `/ws/scan`, fixture detector, dataset/training, frontend behaviour changes |
| Inputs read | `CLAUDE.md`; `docs/ARCHITECTURE.md` v1.1 (§6, §7.1, §8, §10–§14); `docs/superpowers/reports/phase1-verification.md`; `docs/superpowers/plans/2026-11-19-frontend-refactor.md`; `frontend/src/types/{api,cube}.ts`; `frontend/src/services/{parsers,solver-client,health-client,readiness}.ts`; `frontend/src/engine/{cube-state,move-engine,solve-binding}.ts`; `fixtures/{health,solve}/*.json`; `frontend/src/features/scanner/LiveUnavailablePanel.tsx` |
| Git state at writing | `main` = `refactor/phase-1-frontend` = `cae4df6` (Phase 1 merged). Untracked: `.claude/`, `skills-lock.json` only. |

## 1. Intent

Phase 1 left the frontend with strict, tested clients for `/health` and `/api/solve` but nothing to talk to. Phase 2 builds that local backend so that a captured six-face cube can be **validated physically and solved by a real two-phase solver**, returning exactly the payloads the frontend already parses and binds. Vision stays absent: in Phase 2 the backend honestly reports that vision is unavailable while the solver is usable.

Success means: the existing frontend clients accept every real backend response unmodified; every returned solution replays to solved in both the Python and the TypeScript engines; illegal cubes are rejected with the documented wire codes; and the Python ↔ TypeScript engine cross-check (a Phase 2 gate in ARCHITECTURE §12.1) is done.

### Goals
1. `GET /health` and `POST /api/solve` matching `frontend/src/types/api.ts` and the shared fixtures exactly (schema v1, no new fields).
2. Canonical 54-facelet `URFDLB` state built from the request the same way as `buildFaceletState` (`frontend/src/engine/cube-state.ts`).
3. Full legality validation: shape, six unique centres, nine of each colour, every corner and edge exists exactly once, corner twist sum ≡ 0 (mod 3), edge flip sum ≡ 0 (mod 2), corner/edge permutation parity equal.
4. A real two-phase (Kociemba algorithm) solver; every solution independently replayed server-side before it is returned.
5. Strict Pydantic request/response models; one predictable error envelope.
6. Cross-checks: Python engine vs TypeScript engine (shared fixtures), solver output vs both engines.

### Non-goals (Phase 2)
Vision, detector modes other than the vision-absent report, WebSocket, weights loading, CORS for remote origins, auth, persistence, Docker, performance tuning beyond the measured need.

### Anti-goals (failure even if it "works")
- Any mocked or fixture solution served by the real `/api/solve`.
- Changing a wire field, error code set or HTTP status the frontend already depends on without approval.
- A backend that "solves" an illegal cube (one solver candidate does exactly this; §4).
- Silent colour fill-in, silent face rotation, or claiming a scan is physically correct because it is legal.
- Selecting a GPL solver without explicit approval.

## 2. Constraints that shape the design (verified in code)

| # | Fact (source) | Consequence |
| --- | --- | --- |
| C1 | `solver-client.ts` parses an error envelope **only on HTTP 422 and 503**; 404/≥500 without envelope → `BACKEND_UNAVAILABLE`; any other status → `BAD_RESPONSE`. | Input/state errors → 422; `SOLVER_TIMEOUT` → **503** (a 504 would lose its code). |
| C2 | `parseApiErrorEnvelope` requires exactly `{error:{code,message,retryable}}` with a known `ApiErrorCode`; extra keys rejected. | FastAPI's default `{"detail":[...]}` 422 body must be replaced by our envelope. |
| C3 | `parseSolveResponse` requires exactly `schemaVersion, centerColors, initialState, moves, moveCount`; tokens limited to the 18 `[URFDLB]['2]?`. | Response model `extra='forbid'`; solver output normalized to these tokens. |
| C4 | `parseHealthResponse`: required `schemaVersion,status,detectorMode,visionReady,solverReady`; optional `modelVersion,device,error`; `detectorMode ∈ {fixture,yolo}`. | No new health fields. |
| C5 | `bindSolveResponse` recomputes `initialState`/`centerColors` from the **request** and replays the moves. | Backend construction must be byte-identical to `buildFaceletState`. |
| C6 | `fixtures/solve/scramble-a.response.json` moves are not Kociemba output (they are an inverse scramble). | Contract tests compare `initialState`, `centerColors`, `moveCount==len(moves)` and **replay**, never move equality, for scrambled states. |
| C7 | `deriveLiveReadiness`: yolo + vision not ready → `blocked/MODEL_UNAVAILABLE` with `solverReady`; the panel then reads "Vision model is not available — the solver is still usable". | Phase 2 health = `detectorMode:"yolo", visionReady:false, solverReady:true, status:"degraded"`. |
| C8 | Live scanning stays blocked in the UI, so the browser never reaches `/api/solve` in Phase 2. | End-to-end verification calls the frontend's real `solve()`/`getHealth()` clients against the running server through the Vite proxy. |
| C9 | Request faces are already outside-view row-major per §6.4 (U with B at image top, D with F at image top) — the frontend normalizes scan poses. | Backend never rotates faces; orientation errors can only surface as illegality (risk R1). |

## 3. Approaches considered

**Backend shape**

| Approach | Trade-off | Decision |
| --- | --- | --- |
| A. Thin FastAPI app + **own cube core** (facelets, cubie legality, move engine) + solver adapter behind a small interface | Small amount of our own code, but precise error categories, solver-independent legality, server-side replay, and an engine we can cross-check against TypeScript. | **Selected** |
| B. Delegate legality to the solver library (catch its exception) | Least code, but error detail depends on one library, one candidate does not validate at all, and nothing independent checks the solver. | Rejected |
| C. Reuse the TypeScript engine from Python (Node subprocess / transpile) | No duplication, but a second runtime in the backend and no independent check. | Rejected |

**Solver library** — chosen by measurement (§4).

## 4. Solver evaluation (throwaway benchmark, 2026-11-22)

Run outside the repository in isolated Python 3.12.13 virtual environments (uv), on this machine (Intel i3-9100F, 4 threads, 19.9 GB RAM, Windows 11). States were generated by the **repo's own TypeScript engine** (read-only import): solved, 6 named patterns (incl. superflip, checkerboard, cube-in-cube, six-spot), the `scramble-a` fixture state (built through `buildFaceletState`), 40 seeded 30-move random scrambles, then a separate 300-state seeded stress set. Every returned move list was replayed with the repo's `verifySolution` (TypeScript). Sanity check: the engine's superflip state equals the published superflip facelet string exactly. Five illegal-but-well-formed states (twisted corner, flipped edge, two edges swapped, flipped edge on a scramble, 8 U/10 R count mismatch) checked rejection. Licences were read from the GitHub licence API and package metadata; package sources were downloaded and read before any code ran.

| | `kociemba` 1.2.1 | `RubikTwoPhase` 1.1.1 | `cube-solver` 1.1.4 | `rubik-solver-py` 0.1.1 |
| --- | --- | --- | --- | --- |
| Licence (verified) | GPL-2.0 | GPL-3.0 | **MIT** | **MIT** |
| Upstream activity | last release 2019; 644★ | Herbert Kociemba; active (2026); 766★ | release Jul 2025; 2★ | release Feb 2026; 2★; single author |
| Distribution | sdist only for Windows (C via cffi) | pure-Python wheel | compiled wheels cp39–cp313 (win/linux/mac); no cp314 | pure-Python wheel |
| Runtime deps | cffi, future | none | numpy, typer (+rich, pydantic via typer CLI) | numpy |
| Install on this machine (Py 3.12) | **FAILS**: "Microsoft Visual C++ 14.0 or greater is required" | 0.4 s | 2.5 s | 0.6 s |
| First-ever table build | n/a | _see §4.1_ | **386.6 s**; writes `tables/` (cwd-relative) **1.63 GB** | 21.7 s; 8.4 MB cache |
| Start with tables present | n/a | _see §4.1_ | 2.5–3.6 s | 0.01 s |
| Resident memory (peak) | n/a | _see §4.1_ | **1,591 MB** | 35 MB |
| 48 states: replay to solved | n/a | _see §4.1_ | 48/48 | 48/48 |
| 300 stress states: replay to solved | n/a | _see §4.1_ | **300/300** | **300/300** |
| Warm latency (300 stress) median / p95 / max | n/a | _see §4.1_ | **75 / 436 / 1,271 ms** | 508 / 2,992 / 10,696 ms |
| Moves (300 stress) avg / max | n/a | _see §4.1_ | 22.9 / 26 | 21.7 / 22 |
| Rejects the 5 illegal states | n/a | _see §4.1_ | **5/5** (`ValueError: invalid cube state`) | **0/5** — returns move lists for all five |
| Timeout control | — | built-in | built-in cooperative `timeout` (s) → best-so-far or `None` | none (pure-Python recursion; only a process kill stops it) |

Notes: `rubik-solver-py` with `max_depth=24` was slower (median 617 ms, max 17.7 s; that run overlapped another benchmark). `cube-solver` emits `UserWarning`s while parsing illegal strings; our validator runs first so it never sees one. Its table location is hard-coded relative to the working directory (`Path("tables/...")`).

### 4.1 GPL candidates (evaluation only)
Neither is a production candidate without the user's explicit approval (licence).

- **`kociemba` 1.2.1:** `pip`/`uv` install **fails** on this machine because its C extension needs MSVC Build Tools. Its bundled pure-Python fallback (`pykociemba`, ships its own pickled tables) was run from the unbuilt source copied into an isolated venv:
  - start: import 1.0 s; 82 MB resident.
  - 48 states: 48/48 replay to solved; moves average 19.3, maximum 22.
  - latency: median 949 ms, p95 7.2 s, slowest **85.1 s**. This run overlapped the `RubikTwoPhase` table build, so it is somewhat inflated.
  - illegal cubes: rejects all five, each with a specific reason (twist, flip, parity, colour count).
  - Correct, but too slow at the tail and not installable without a compiler.
- **`RubikTwoPhase` 1.1.1:** installs in 0.4 s and builds its tables on first import. That build ran for **more than 24 minutes** and was still inside its first large pruning table (`phase1_prun`, depth 9; 9 MB written) when this design was finalized. Upstream's own log warns "may take half an hour or even longer". Warm latency, correctness and rejection are **NOT RUN**: the background build was stopped when the session ended, before it finished. It was not restarted, because the licence already excludes it.

### 4.2 Recommendation: `cube-solver` 1.1.4 (MIT), behind an interface, with our own validation and replay

- It is the only permissive candidate that is both **correct on all 348 states** and **validates legality itself**, with a worst observed solve of 1.27 s on a modest CPU and a cooperative timeout, so no worker process is needed.
- The costs are real and accepted explicitly: a **one-time 6.4-minute table build**, **1.63 GB on disk** and **~1.6 GB RAM** while the backend runs. Tables are never committed; they live in a git-ignored, configurable directory and are built by an explicit `prepare` command, not silently at startup.
- Library maturity is low (2★). Mitigations: exact version pin with hashes in `uv.lock`; our own legality validator and server-side replay mean a wrong or missing library result can never reach the client; a `Solver` protocol lets `rubik-solver-py` (35 MB, but no validation and an 11 s tail) be swapped in if the memory cost proves unacceptable.
- `rubik-solver-py` is the fallback, not the pick: it returned "solutions" for impossible cubes, has no timeout, and its tail latency is ~8× worse.

**This is a decision for the user (Q1).**

## 5. Architecture

```text
backend/                          # new; Python 3.12, managed with uv (pyproject.toml + uv.lock)
├── pyproject.toml                # deps pinned; [tool.pytest], [tool.ruff], [tool.mypy] strict
├── uv.lock
├── .python-version               # 3.12
├── README section → root README  # run instructions live in the root README
├── app/
│   ├── main.py                   # create_app(settings) factory, lifespan (load solver), routers, handlers
│   ├── config.py                 # Settings from env (RUBIK_*), immutable
│   ├── errors.py                 # ApiError, wire codes, envelope builder, exception handlers
│   ├── schemas.py                # Pydantic v2 models: SolveRequest, SolveResponse, HealthResponse, ErrorEnvelope
│   ├── api/
│   │   ├── health.py             # GET /health
│   │   └── solve.py              # POST /api/solve
│   ├── cube/                     # pure: no FastAPI, no I/O, no solver library
│   │   ├── constants.py          # FACE_ORDER URFDLB, offsets, centre indices, colours, geometry table (§6.4)
│   │   ├── facelets.py           # build_facelet_state(faces) → (state, centers); structural errors
│   │   ├── geometry.py           # facelet ↔ (position, normal) from the n/a/b table
│   │   ├── moves.py              # 18 permutations from integer rotations; apply/replay/verify
│   │   └── legality.py           # facelet → cubie (cp, co, ep, eo); identity, twist, flip, parity checks
│   └── solver/
│       ├── base.py               # Solver protocol, SolverResult, SolverTimeout/SolverFailure
│       ├── cube_solver_adapter.py# cube-solver: notation conversion, timeout, lock, token normalization
│       ├── prepare.py            # `python -m app.solver.prepare` builds tables explicitly
│       └── service.py            # solve pipeline (validate → solved short-circuit → solve → replay → response)
└── tests/
    ├── conftest.py               # app/client fixtures; shared-fixture loader (repo-root fixtures/)
    ├── cube/                     # facelets, geometry, moves, legality
    ├── solver/                   # adapter, service, timeout path
    ├── api/                      # /health and /api/solve contracts, error envelopes
    └── crosscheck/               # Python engine vs TS-generated fixtures; solver vs both engines
fixtures/
├── health/, solve/               # existing (unchanged)
└── engine/                       # NEW shared, generated by the TS engine (see §8)
```

The planned `app/vision/` and `weights/` (ARCHITECTURE §10) are **not created** in Phase 2.

### 5.1 Data flow — `POST /api/solve`

1. **Parse** (Pydantic, `extra='forbid'`): `schemaVersion` is declared `StrictInt` with an explicit validator requiring the value 1 (`Literal[1]`, even with `strict=True`, is not relied on: it can accept `true`/`1.0`), so `true`, `false`, `1.0`, `"1"` and `2` are all rejected; `faces` has exactly keys `U R F D L B`; each value is a list of exactly 9 strings from the six colour names. Any failure → 422 `INVALID_FACE_SHAPE` (retryable false).
2. **Centres**: six distinct centre colours, else 422 `DUPLICATE_CENTER` (retryable true; message = fixture text).
3. **Counts**: each colour exactly 9 times, else 422 `COLOR_COUNT_MISMATCH` (retryable true).
4. **Canonical state**: translate each colour to its home face via the inverse centre map; concatenate in `URFDLB` row-major order (identical to `buildFaceletState`).
5. **Legality** (`cube/legality.py`, independent of the solver): every corner and edge identity exists exactly once; Σ twist ≡ 0 (mod 3); Σ flip ≡ 0 (mod 2); corner parity = edge parity. Any failure → 422 `INVALID_CUBE_STATE` (retryable true; message = fixture text; the specific reason is logged, not asserted to the user, per §8.3).
6. **Solved short-circuit**: solved state → `moves: []` without calling the library.
7. **Solve**: adapter call in a worker thread under one lock, library `timeout` = `RUBIK_SOLVER_TIMEOUT_S` (default 10). The library result is classified by the adapter using the library's own `terminated` flag: `None` **with** `terminated == True` (the time limit stopped the search) → `SolverTimeout` → 503 `SOLVER_TIMEOUT` (retryable true); `None` **without** termination (search ended with no solution on a cube our validator called legal) → `SolverFault` → 500.
8. **Normalize and verify**: map library notation to the 18 tokens; replay with `cube/moves.py`; must reach solved. Failure (unknown token, replay mismatch) → `SolverFault` → 500 (logged; never returned as a solution).
9. **Respond** 200: `{schemaVersion:1, centerColors, initialState, moves, moveCount}`.

### 5.2 `GET /health`

`{"schemaVersion":1,"status":"degraded","detectorMode":"yolo","visionReady":false,"solverReady":true,"error":"Vision is not available in this build."}` once the solver is loaded. `status` is `"degraded"` because vision is absent (matching `fixtures/health/model-unavailable.json`'s shape). If the solver tables are missing, the process **does not start** and prints the prepare command (fail fast; no silent 6-minute build). `RUBIK_DETECTOR_MODE=fixture` is rejected at startup in Phase 2 (no fixture detector exists until Phase 3; reporting `fixture` would make the UI show a test-detector banner for nothing).

### 5.3 Error envelope and status map

| Condition | HTTP | Code | retryable |
| --- | --- | --- | --- |
| Body not JSON / wrong types / missing or extra keys / `schemaVersion ≠ 1` / face shape / unknown colour | 422 | `INVALID_FACE_SHAPE` | false |
| Two faces share a centre colour | 422 | `DUPLICATE_CENTER` | true |
| A colour not exactly 9 times | 422 | `COLOR_COUNT_MISMATCH` | true |
| Corner/edge identity, twist, flip or parity failure | 422 | `INVALID_CUBE_STATE` | true |
| Solver stopped by its time limit with no solution (`None` and `terminated`) | 503 | `SOLVER_TIMEOUT` | true |
| Internal fault: `None` without termination, unknown token, replay mismatch, or any unexpected exception | 500 | no envelope (no wire code exists; handled by our exception handlers, returning `{"detail":"Internal solver error"}`) → client shows `BACKEND_UNAVAILABLE` | — |
| Unknown path / wrong method | 404 / 405 | FastAPI default | — |

All envelope bodies are exactly `{"error":{"code","message","retryable"}}`. Messages for `DUPLICATE_CENTER` and `INVALID_CUBE_STATE` equal the fixture texts. `MODEL_UNAVAILABLE`, `FRAME_TOO_LARGE`, `INVALID_FRAME` are unused in Phase 2.

### 5.4 Configuration (env, read once)

| Variable | Default | Phase 2 meaning |
| --- | --- | --- |
| `RUBIK_DETECTOR_MODE` | `yolo` | Only `yolo` accepted; reported in `/health` with `visionReady:false`. |
| `RUBIK_SOLVER_CACHE_DIR` | `backend/.solver-cache/` (git-ignored) | Parent directory: the library hard-codes `tables/` relative to the working directory, so tables are built and read at `<dir>/tables/`. |
| `RUBIK_SOLVER_TIMEOUT_S` | `10` | Library cooperative timeout (integer seconds). |

Server start (the only supported form; there is no module-level `app` object): `uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000` from `backend/`. No CORS middleware: the browser reaches the backend only through the Vite proxy (same origin). No request or frame is persisted.

### 5.5 Concurrency

One process, one solver instance, one `asyncio.Lock` around a `asyncio.to_thread` call (the library object is not thread-safe). A second concurrent solve waits; solves are once per scan, so a queue is unnecessary. The cube-solver table directory is relative to the working directory; the adapter resolves it by changing directory **only during startup** (before serving), and the prepare command does the same. This wart is isolated in the adapter and tested.

## 6. Cube core details

- **Geometry and moves** are derived from ARCHITECTURE §6.4 (normal n, image-right a, image-down b; `p = n + (c−1)a + (r−1)b`) and §7.2 (layer predicate, axis, −90° for clockwise about the outward normal) with **integer** rotation matrices, mirroring the documented method — not copied from the TypeScript code.
- **Legality** derives each corner's and edge's three/two facelet indices from the same geometry (positions with 3 or 2 stickers), names cubies by their sticker home faces, and uses the Kociemba orientation conventions: corner twist = index of the U/D sticker in the slot's clockwise facelet order; edge flip = 0 when the edge's U/D sticker (or, for E-slice edges, its F/B sticker) sits on the slot's U/D (or F/B) facelet. Parity from cycle decomposition. Each check has its own unit test with a hand-built mutant.
- **Independence**: three separately sourced oracles must agree — (1) TypeScript-engine-generated fixtures, (2) published facelet strings (superflip and the solved string), (3) the solver library's own solutions replaying to solved in **both** engines. A shared conceptual error would have to fool all three.

## 7. Integration boundaries with Phase 1

- **No frontend source or contract changes.** Frontend `src/` is untouched.
- **Test-only frontend additions (need approval as part of this plan, Q4):** a Vitest file that (a) generates/guards `fixtures/engine/*.json` from the TS engine, and (b) feeds backend-recorded solve responses (`fixtures/solve/backend-*.json`) through `parseSolveResponse` + `bindSolveResponse`, and (c) holds the `RUBIK_LIVE_BASE_URL`-guarded live block that runs the real `getHealth()`/`solve()` clients (§8, §13 item 4).
- Existing fixtures stay byte-identical. New fixtures are additive.
- The demo path (`demo/`) keeps using its own fixtures; Phase 2 does not route demo through the backend.

## 8. Verification strategy (pytest + shared fixtures)

| Layer | Tests |
| --- | --- |
| Facelets | solved request → solved string; `scramble-a.request` → exactly the fixture `initialState`; asymmetric per-face grids land at the documented indices; every structural error path and its code. |
| Geometry/moves | all 18 tokens: m⁴=id, m2·m2=id, m·m′=id, centres fixed, counts conserved; hand-derived goldens (U, D, U′ on asymmetric states, as in Phase 1); superflip sequence → published string; **TS-fixture equality** after every move of seeded sequences covering all 18 tokens. |
| Legality | accepts every TS-generated state; rejects twisted corner, flipped edge, two swapped edges (parity), two swapped corners, duplicated/missing edge and corner, impossible colour pair; each with its specific internal reason. |
| Solver adapter | notation conversion round-trips; token normalization; timeout path (adapter with timeout 0 on a hard state, or a test-double `Solver` injected only in tests); lock serializes calls. |
| Service | solved → `[]` with no library call; every accepted solution replays to solved; `SolverTimeout` propagates; `None` without termination or a bad replay → `SolverFault`, never a 200. |
| HTTP 500 paths | `TestClient` re-raises server exceptions by default (`raise_server_exceptions=True`). Handled faults (`SolverFault`) return a 500 response through our handler and are tested with the default client. The catch-all for an **unexpected** exception (a test double raising `RuntimeError`) is tested with `TestClient(app, raise_server_exceptions=False)` and must return 500 with no `error` key and no traceback text. |
| API contract | `/health` validates against the frontend schema rules (exact key set) and equals the expected Phase 2 body; `/api/solve` with `solved.request.json` equals `solved.response.json` exactly; `scramble-a.request.json` → same `initialState`/`centerColors` as the fixture, valid tokens, `moveCount==len(moves)`, replays; error fixtures equal exactly; FastAPI validation errors produce envelopes; 422/503 statuses as in §5.3. |
| Cross-check | 300+ seeded states solved by the real library, replayed in Python **and** (via recorded fixtures) by the TS `bindSolveResponse` in Vitest. |
| Frontend client integration | A committed live block in `frontend/tests/crosscheck/backend-solutions.test.ts` (Node test environment, `describe.runIf(process.env.RUBIK_LIVE_BASE_URL)`) calls the **unmodified** frontend `getHealth()` and `solve()` with `baseUrl` set to the Vite dev server (`http://127.0.0.1:5173`, so the real proxy is exercised): `getHealth()` returns the Phase 2 body and `deriveLiveReadiness` gives `blocked/MODEL_UNAVAILABLE` with `solverReady: true`; `solve()` on `solved` and `scramble-a` returns `ok` with `source: 'backend'`, and `bindSolveResponse` accepts it; `solve()` on the duplicate-centre fixture returns `{kind:'api', code:'DUPLICATE_CENTER'}`. Without the variable the block is reported as skipped. |
| Live smoke | uvicorn on 127.0.0.1:8000 + Vite dev server; the client integration block above is run with `RUBIK_LIVE_BASE_URL` set; browser Live screen shows "Vision model is not available — the solver is still usable". |

Slow tests (hundreds of solves) are marked and run in the gate, not on every edit. Any Python/TypeScript/API mismatch stops the phase for investigation.

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **Missing orientation information**: the request carries no evidence of face roll; a face scanned rotated, or U/D captured in the wrong tilt, produces a different facelet string. Most such errors become illegal (422), but a legal wrong state is possible. | Accept and disclose (ARCH §6.2, §14); backend never rotates faces or "repairs" a cube; legality ≠ correctness wording in docs and messages. Phase 3+ scan UX is where it is reduced. |
| R2 | Solver library immaturity (2★) or abandonment | Pin + hashes; own validation + replay; `Solver` protocol; documented fallback. |
| R3 | 1.6 GB tables / RAM, 6.4-min first build | Explicit prepare step, git-ignored dir, fail-fast startup message; measured, revisit at Phase 6 with YOLO loaded. |
| R4 | cwd-relative table path | Isolated in the adapter; startup-only directory change; tested. |
| R5 | Shared convention error between Python and TS engines | Third oracle (library solutions) + published strings. |
| R6 | `cube-solver` has no cp314 wheel | Backend pinned to Python 3.12 (`.python-version`, `requires-python >=3.12,<3.13`). |
| R7 | Wire-code gaps (no code for internal faults or "solver not ready") | 500/fail-fast mapped to the client's existing `BACKEND_UNAVAILABLE`; adding codes is a contract change (Q2). |
| R8 | Docs drift: ARCHITECTURE still says Phase 1 "awaiting approval"; it names YOLO26n while the user reports a YOLO26s model trained separately | Fix status lines in the Phase 2 docs task; record the YOLO26s note for Phase 6 without changing vision scope. |

## 10. Open questions for the user

1. **Q1 — Solver**: approve `cube-solver` 1.1.4 (MIT; 1.6 GB tables/RAM; 6.4-min one-time build)? Alternative: `rubik-solver-py` 0.1.1 (MIT; 35 MB; no legality checks, no timeout, 11 s tail). GPL options only with explicit approval.
2. **Q2 — Error codes**: keep the wire code set frozen (internal faults → bare 500, which the client already treats as unavailable), or add an additive code such as `SOLVER_UNAVAILABLE`/`INTERNAL_ERROR` (needs a small frontend type/parser change)? Default: frozen.
3. **Q3 — Request-shape code**: use `INVALID_FACE_SHAPE` for every malformed request (including `schemaVersion ≠ 1`)? Default: yes.
4. **Q4 — Test-only frontend additions** in §7 (Vitest guard for engine fixtures; binding of backend-recorded responses). Default: allowed as part of plan approval.
5. **Q5 — Tooling**: uv + `pyproject.toml`/`uv.lock`, ruff, mypy `--strict`, Python 3.12. Default: yes.

## 11. Builder-check resolutions (author's calls, 2026-11-22)

An independent builder review checked constraints C1–C5 and C7 against the code and found no false claim. Its open points, settled here as the author's calls:

1. **Tests and the 1.6 GB tables.** Tests for the cube core, schemas and error paths need no tables; error paths use a `Solver` test double that exists only under `backend/tests/`. Once the adapter exists, contract tests run the **real** solver through a session fixture. If tables are missing, that fixture **fails** and prints the prepare command; it never skips. The 300-state cross-check is marked `slow` and runs at the gate (`pytest -m "slow or not slow"`). A fresh checkout runs `python -m app.solver.prepare` once before the full suite.
2. **Timeout semantics.** `RUBIK_SOLVER_TIMEOUT_S` caps solve time. Any solution the library returns within it is accepted if it replays to solved, including a longer best-so-far one. `None` with the library's `terminated` flag set becomes 503 `SOLVER_TIMEOUT`; `None` without it is an internal fault (500). (Amended after review, see §13.)
3. **Lock wait and disconnects.** The timeout covers the solver call only. Lock wait is bounded by one in-flight solve, at most one timeout (observed maximum 1.27 s). Client disconnects are not detected: a superseded solve finishes and its result is discarded by the client's request guard. The stall is accepted at this scale.
4. **Fixture formats.** `fixtures/engine/move-sequences.json` comes from the TypeScript engine via a Vitest file. The file writes only when `UPDATE_ENGINE_FIXTURES=1`; otherwise it compares. Content: 40 seeded 25-move sequences with every intermediate state, plus all 18 single moves on the `scramble-a` state, about 120 KB. `fixtures/solve/backend-solutions.json` holds about 42 request/response pairs recorded from the real backend by a committed Python script, run manually and re-run only when the solver or contract changes. The 300-state cross-check is generated in Python at test time and not committed. Exact schemas are in the plan (Tasks 3 and 8).
5. **Strictness.** `schemaVersion: StrictInt` plus an explicit `== 1` validator, so `true`, `1.0` and `"1"` are rejected (amended after review, see §13). No coercion of colour strings. Duplicate JSON keys follow Python's `json` (last one wins). No explicit body-size limit: the server is loopback-only and any oversize body fails the schema. Revisit with frames in Phase 3.
6. **Health `error` text** is free-form. The Phase 2 body uses `Vision is not available in this build.`; tests compare its **key set** with `fixtures/health/model-unavailable.json` and its exact body with the Phase 2 string. The fixture's "Detection weights not found" stays a Phase 6 example.
7. **`solverReady` is always `true` while the process serves.** A missing solver means the process never started, which the client already shows as `BACKEND_UNAVAILABLE`. `solverReady:false` stays in the contract for later phases.

## 12. What is left to the builder

Exact module-internal function names, test file splits, log format, the precise integer-seconds timeout value within 5–15 s after measuring, and the wording of non-fixture error messages — all within the contracts above.

## 13. Review corrections required by the user before implementation (2026-11-23)

1. **Pydantic strictness.** `ConfigDict(strict=True)` with `Literal[1]` is not trusted to reject `true`/`1.0`. `schemaVersion` is `StrictInt` with an explicit validator requiring 1. Rejection tests for `true`, `false`, `1.0`, `"1"`, `2` stay (§5.1 step 1, plan Task 6).
2. **Startup command.** The single supported form is the factory: `uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000`. There is no module-level `app` object (§5.4, README, CLAUDE.md, plan Tasks 6, 9, 10).
3. **Solver `None`.** It is classified by the library's `terminated` flag. `None` with termination → `SolverTimeout` → 503 `SOLVER_TIMEOUT`; `None` without termination → `SolverFault` → 500 (§5.1 step 7, §5.3, §11 item 2, plan Tasks 5 and 6).
4. **Frontend client integration.** The unmodified frontend `getHealth()` and `solve()` are run against the live backend through the Vite proxy, from a `runIf`-guarded live block inside the already-approved `frontend/tests/crosscheck/backend-solutions.test.ts`. That file runs in Vitest's Node environment and is skipped unless `RUBIK_LIVE_BASE_URL` is set. It is run at plan Task 9 and at the gate (§8).
5. **HTTP 500 tests.** `TestClient` re-raises unhandled server exceptions by default. Handled faults are tested with the default client; the catch-all unexpected-exception path is tested with `raise_server_exceptions=False` (§8, plan Task 6).
