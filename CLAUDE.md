# CLAUDE.md

## Project mission

RubikVision helps users solve a physical 3×3 Rubik's Cube: guided webcam scanning → YOLO26n facelet detection → cube reconstruction and Kociemba → Three.js digital twin with timed auto-guidance.

Build the software first using deterministic fixtures; train six-color YOLO weights last. Preserve the existing Google AI Studio visual design and six-screen flow unless the user explicitly requests changes. Do not mistake a prototype, fixture result, or digital replay for physical verification.

## Read before working

- `docs/ARCHITECTURE.md`: authoritative product behavior, geometry, API contracts, and release criteria.
- `docs/RUBIKVISION_CLAUDE_HANDOFF.md`: historical source review and migration rationale; verify against current code.
- `docs/superpowers/plans/`: read only the relevant approved plan and its recorded decisions.
- `docs/superpowers/reports/`: check the latest verified phase status and known blockers.
- `README.md`, manifests, lockfiles, and current Git status: establish actual layout, commands, dependency versions, and work in progress.

If paths differ, locate the actual documents rather than creating duplicate specifications. User-approved amendments supersede older design text; do not silently resolve material contract conflicts. A proposed plan is not approval to implement it.

## Workflow and scope

1. Inspect the actual repository, applicable spec, and current diff; protect existing user changes.
2. For a new feature or architecture change, use Superpowers brainstorming and an approved design/plan. For an approved plan, execute using subagent-driven-development or executing-plans. Use TDD for behavioral changes and review each independently testable task.
3. Prefer small, reversible changes. Characterize current behavior before migration; preserve UI during mechanical moves. Separate refactoring from behavior changes where practical.
4. Use the established package manager and lockfile. Do not switch tools, bump major dependencies, change public contracts, initialize Git, create commits, or expand scope without authorization in the current task/approved plan.
5. Run fresh checks after each task. Record real results, failures, deviations, and next steps. Stop at approved gates or unresolved correctness failures. Never claim a command passed without its output.
6. Do not start the next phase automatically.

## Roadmap (model-last)

| Phase | Deliverable |
|---|---|
| 0 | Baseline, reproducible setup, actual build/typecheck and browser observations |
| 1 | Frontend migration/refactor, deterministic engine and timed coach, explicit demo; typed clients |
| 2 | FastAPI, canonical reconstruction/validation, real Kociemba and shared fixtures |
| 3 | Detector interface, fixture detector, geometry and WebSocket protocol |
| 4 | Full-stack fixture integration and YOLO adapter (software-ready gate) |
| 5 | Dataset audit, six-color label mapping, training and evaluation |
| 6 | Load `backend/weights/best.pt`, benchmark real webcam and physical end-to-end recovery (model-ready gate) |

Current authorization is determined by the user's latest approval, not by this roadmap. Phase 1 is merged into `main` (plan `docs/superpowers/plans/2026-11-19-frontend-refactor.md`; evidence in `docs/superpowers/reports/phase1-verification.md`). Phase 2 (backend) is implemented on branch `feat/phase-2-backend` (plan `docs/superpowers/plans/2026-11-22-phase-2-backend.md`) and awaits the user's approval; evidence is in `docs/superpowers/reports/phase2-verification.md`. Phase 3 is not started.

## Architecture boundaries

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand, Three.js/R3F. Preserve the existing scene, theme and six-screen workflow.
- Pure `engine/`: cube state, integer facelet geometry, move permutations and playback reducer; no React, DOM, timers, Three.js, network or store dependencies.
- `components/three/`: controlled renderer and camera viewpoint; no independent mutation of cube state or authoritative playback clock.
- `features/`: product workflows; `hooks/`: browser lifecycle and orchestration; `stores/`: session/application state; `services/`: typed, validated transport boundaries; `demo/`: explicit deterministic fixtures.
- Backend: Python/FastAPI, Pydantic, OpenCV/NumPy, Kociemba, Ultralytics/PyTorch. Detector returns the same typed detections for fixture and YOLO implementations. Frontend owns scan sequence/stability; backend owns frame geometry, physical legality and solution generation.
- Training is isolated from runtime. Do not add a database, authentication, cloud inference, LLM, segmentation or true AR for the MVP without an approved design change.

## Canonical cube invariants — never change casually

- Exactly 54 facelets, nine per face, solver serialization `URFDLB`; guided capture sequence `FRBLUD`. Face identifiers indicate directions/home faces, not colors (`R` is not necessarily red).
- Use the six full color names at API boundaries: `white`, `yellow`, `red`, `orange`, `blue`, `green`. Derive the center mapping from observed faces. Green-front/white-up is the documented initial scan convention, not a universal hard-coded mapping of all six centers.
- Use the facelet axes and row-major outside-view convention in Architecture §6.4. Distinguish camera-facing scan orientation from user-facing solving orientation. U/D poses, back-face ordering and unmirrored images require asymmetric fixtures.
- `FaceletState` is immutable and authoritative; renderer cubies are derived. Verify all 18 legal move tokens against an independent reference; clockwise = viewed from outside the target face. X right/Y up/Z front; positive-axis angles for R,L,U,D,F,B are −90,+90,−90,+90,−90,+90 degrees. Camera orbit never changes logical state.
- Never silently fill missing/unknown colors or accept malformed states. Frontend structural checks are not proof of physical legality; backend validates edges, corners, orientation sums and permutation parity.
- Ensure the solver response matches the submitted grids and center mapping, then replay every move before enabling guidance. An empty move list is valid only for a solved state. A valid digital solution is not proof of a correctly scanned physical cube.

## Vision and transport

- Demo and live are disjoint. Demo fixtures must be visibly labeled, never presented over live webcam as inferred boxes, confidences or captured grids. Fixture backend is opt-in and explicitly visible; never silently fall back to fixtures or COCO weights.
- Guided scanning captures one front-facing 3×3 grid at a time. Only rotate the whole physical cube during scan. Nine detected stickers and a center color do not prove roll or hidden neighbor identity.
- Use unmirrored frame coordinates, consistent contain-fit overlay transform and agreed ROI contract from Architecture. One in-flight frame per connection; discard stale connection/stage/frame results. Reject incomplete, duplicate, unstable or ambiguous grids.
- Endpoints: `GET /health`, `POST /api/solve`, `/ws/scan`. Keep schema/version, fixtures and Python/TypeScript contracts aligned. Validate runtime payloads, not just TypeScript types. Abort/ignore stale requests, including retries within one session.
- Missing or incompatible `best.pt` blocks live vision, not the deterministic solver/process. Load trusted local detection weights once; validate six class names and task, map names rather than assuming model class IDs.
- Never transmit or persist raw webcam frames by default. Use loopback development servers, local proxy and explicit origin checks; no credentials required for normal runtime.

## Timed solving and lifecycle

- After scan, align the real cube to the digital twin's center colors and stop webcam tracks, transport and capture loops.
- One playback controller owns elapsed animation and post-animation delay. Precompute `S[0..N]`; renderer interpolates `S[i] → S[i+1]` then snaps exactly. Delay is adjustable; apply changes at the documented boundary.
- Pause freezes both animation and countdown; replay restarts the same snapshot transition without double-applying the move. Preserve the final waiting period. Hidden tabs suspend playback; resume is deliberate.
- A fresh session resets all state. Guard asynchronous work by generation and, where applicable, request/connection identity. Cancel timers, media acquisition, animation frames and sockets during teardown.
- No mandatory confirmation per move. Keep any skip/previous behavior consistent with the approved plan. Scan Again discards invalid old progress and generates a new solution.
- Guidance completion means instructions finished, not physical success. Do not celebrate or assert a real cube was solved before user confirmation or actual verification.

## Commands and verification

The package manager is npm (`frontend/package-lock.json` is the only lockfile; Bun is no longer used). Run frontend commands from `frontend/`.

- Install: `npm ci`. Do not invent a passing baseline when a tool is missing.
- Frontend: `npm run dev` (http://127.0.0.1:5173, loopback only), `npm run lint` (`tsc --noEmit`), `npm run test` (Vitest; one file with `npx vitest run <path>`), `npm run build`.
- Backend (from `backend/`, uv, Python 3.12): `uv sync`; one-time `uv run python -m app.solver.prepare` (about 5 min, 1.6 GB); `uv run pytest` (`-m slow` for the 300-state cross-check); `uv run ruff check .`; `uv run mypy app`; server `uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000` (the only start form).
- Verify actual browser behavior for affected flows, including 3D direction, pause mid-turn, resize, camera cleanup and missing backend/model. jsdom tests do not verify WebGL.
- Report command, exit status, failed/passed counts, visual checks actually performed, and any remaining limitations. Keep independent reference provenance and shared JSON fixtures reviewable.

## Repository hygiene

Keep implementation plans and architecture in `docs/`, code in its owning module, shared deterministic fixtures at the agreed root location, and run instructions in README. Do not duplicate architecture or temporary progress here. Before any commit inspect staged changes; exclude secrets, `.env` values, model weights, private footage, datasets, caches, build outputs and unrelated user files. Never overwrite unrelated changes or use destructive Git commands without explicit approval.

Update durable contracts only with an approved change; update phase reports based on actual evidence. Keep this file concise and stable; temporary decisions, progress and detailed tasks belong in the appropriate plan/report.
