# Phase 3 verification report (real YOLO26s live scanning)

| Field | Value |
| --- | --- |
| Date | 2026-11-23/24 |
| Branch | `feat/phase-3-live-vision` (from `main` `994984e`) |
| Design | `docs/superpowers/specs/2026-11-23-phase-3-live-vision-design.md` (approved 2026-11-23, Q1 to Q6 and the section 15 corrections) |
| Plan | `docs/superpowers/plans/2026-11-23-phase-3-live-vision.md` |
| Physical checklist | `docs/superpowers/reports/phase3-physical-test-checklist.md` |
| Status | **Implemented; awaiting the user's approval.** Two gates are still open: the whole-branch review and the controller's final gate run (section 12), and the physical webcam test, which is **NOT RUN** and is performed by the user. The performance budget was **not met** on the development machine (section 4). |

Nothing in this report was verified against a physical cube or a real webcam. The browser gate used Chrome's fake camera device playing a video made locally from labelled dataset photographs. A correct fake-camera scan means the pipeline reads those photographs correctly; it says nothing about lighting, glare, hand shake or real cubes.

Evidence for the per-task and browser-gate rows comes from the ledger and task reports under `.superpowers/sdd/2026-11-23-phase-3-live-vision/` and the gate findings in its `t11/` folder. That folder is local, git-ignored scratch, not part of the repository; the numbers below are copied from it. The test counts in section 2 were produced by commands re-run on 2026-11-23 for this report.

Git record when this report was written (before the two documentation commits of Task 13a): `git log --oneline main..HEAD` listed 27 commits, `1d36f70` (design and plan) to `f2ad442` (physical checklist). `git diff --stat main..HEAD`: 71 files changed, 7441 insertions, 74 deletions. `git remote -v` printed nothing (no remote). `git status --short` showed only the user's `?? .claude/`, `?? skills-lock.json` and `?? training/`.

## 1. Summary

Legend: PASS, FAIL, NOT RUN, BLOCKED. Counts quoted in the evidence column were reported by the task's implementer and, where the ledger says so, reproduced by the controller.

### 1.1 Per task

| Task | Deliverable | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Git hygiene, dependencies (ultralytics 8.4.216, torch 2.14.1 CPU, torchvision 0.29.2 CPU), settings | PASS | Commits `959896e`, `86b58e0`; default suite 183 passed; ruff and mypy clean; `.venv` 1.1 GB; one fix round |
| 2 | Detector interface, `YoloDetector`, vision health | PASS | Commits `094bdb0`, `f463e50`; default 198 passed, 3 deselected; `-m model` 2 passed; load plus warm-up about 3.4 s; one fix round |
| 3 | Pure 3×3 grid analysis | PASS | Commit `d548f7d`; 20 grid tests; default 218 passed, 3 deselected; review clean |
| 4 | Frame decoding and limits | PASS | Commit `83b550b`; 13 frame tests; default 231 passed, 3 deselected; review clean |
| 5 | `/ws/scan` endpoint | PASS | Commits `59b024c`, `a391287`; 19 ws tests at first, default 252 passed, 3 deselected after the fix; one fix round |
| 6 | Frontend wire types, parsers, WebSocket transport, recorded messages | PASS | Commits `1fc54fe`, `2f2c301`, `beb36e9`, `fb80ce9`; frontend 854 passed, 4 skipped; backend 254; one fix round |
| 7 | Guide geometry and the pure live-scan machine | PASS | Commits `7bacea1`, `0d8004e`; frontend 895 passed, 4 skipped after the fix; one fix round |
| 8 | `useLiveScan` capture loop, frame grabber | PASS | Commits `9c4f875`, `7bdfe7c`, `2a0b13a`; frontend 923 passed, 4 skipped; two fix rounds |
| 9a | `LiveScanGuide`, `RotationCue`, U/D copy and golden | PASS | Commits `afd6732`, `6fc3e90`; frontend 941 passed, 4 skipped; one fix round |
| 9b | Wiring into the scanning screen | PASS | Commits `3cfb55e`, `6cbad3e`, `faf04f0`, `24a00ec`; frontend 991 passed, 4 skipped; two fix rounds |
| 10 | Integration and isolation checks | PASS | Commit `43e3ce3` (tests only); frontend 994 passed, 4 skipped; backend 254 passed, 4 deselected; `-m model` 3 passed |
| 11 | Fake-camera browser gate | PARTIAL: PASS 16, FAIL 1, NOT RUN 1 | Section 3. The FAIL is the performance row; the NOT RUN is mobile (out of scope). Found the start-command blocker D1 |
| 11b | `websockets` dependency and real-server regression test | PASS | Commit `87645d6`; 6 new tests; default 260 passed, 4 deselected; documented start command run with the real model |
| 12 | Physical webcam checklist | DONE (documents only) | Commit `f2ad442`; every physical result is NOT RUN |
| 13 | Documentation (ARCHITECTURE v1.3, README, CLAUDE.md) and this report | DONE, review pending | Commits of Task 13a; whole-branch review and final gate follow (section 12) |

### 1.2 Per acceptance area

| Area | Result | Evidence |
| --- | --- | --- |
| Contract (`hello`, `ready`, `frame_result`, `error`, exact keys) | PASS | `fixtures/vision/ws-messages.json` recorded from the real backend app with a detector double; frontend strict parsers and backend strict models both validate it; a drift test fails if a re-recording differs |
| Model loading and health | PASS | Task 2 tests (missing file, wrong task, wrong class names, bad device, sanitized reasons); gate item 1 (`status: ok`, `modelVersion` `yolo26s_rubik_v1@93b727eca123`); gate item 13 (missing model gives `degraded` and the solver still returns 200) |
| Grid analysis | PASS | 20 tests on synthetic detections (complete, missing, ambiguous, misaligned, tilted, background, boundary cases) |
| Frame decoding | PASS | 13 tests: size, JPEG signature, header-declared canvas rejected before decode, grayscale, truncated, non-square |
| `/ws/scan` | PASS | Task 5 tests with a detector double (protocol, Origin, disconnect, cancellation keeps the lock until the worker returns); one real-model test; one real-uvicorn test |
| Frontend transport | PASS | Fake `WebSocket` tests; fatal bad response and monotonic `frameSeq` (fix round) |
| Scan machine | PASS | 33 tests plus the fix-round tests (epoch, non-finite time, latched hint, start convention) |
| UI | PASS (jsdom and a fake-camera browser) | Screen and integration tests; browser items 3 to 9 |
| Flow | PASS (fake camera) | Gate items 8 to 10: six faces captured, Reconstruction, Alignment, Solving with 21 moves from the real backend |
| Fake-camera browser gate | PASS 16 / FAIL 1 / NOT RUN 1 | Section 3 |
| Real-server WebSocket (documented start command) | PASS | Task 11b: handshake, hello and ready, four fixture frames in about 160 to 177 ms with the real model; regression test with a real uvicorn |
| **Physical webcam gate** | **NOT RUN (user-run; see `phase3-physical-test-checklist.md`)** | No real webcam and no physical cube were used. The assistant never opens the webcam |
| **Performance** | **FAIL vs budget** | Section 4: p95 303 to 1037 ms vs 300 ms; 2.7 results per second vs 3 |
| Demo isolation | PASS | Task 10 test (zero transport constructions in Demo); gate item 12 (zero `/ws/scan` connections and no `getUserMedia` during Demo) |
| Dependency policy | PASS with a user-approved exception | `websockets==17.4` added by decision (section 7) |

## 2. Counts (commands re-run on 2026-11-23 for this report)

| Command | Result |
| --- | --- |
| `uv run pytest` (backend) | exit 0, 260 passed, 4 deselected (3 model tests and the slow test), 8.93 s |
| `uv run pytest -m model` | exit 0, 3 passed, 261 deselected, 6.36 s |
| `uv run ruff check .` | "All checks passed!" |
| `uv run mypy app` | "Success: no issues found in 26 source files" |
| `npm run test` (frontend, Git Bash, Node 26) | exit 0, 51 files passed, 994 tests passed, 4 skipped (the live block without `RUBIK_LIVE_BASE_URL`) |
| `npm run lint` (frontend) | exit 0 (`tsc --noEmit`) |
| `npm run build`, `uv sync --locked`, `npm ci`, `uv run pytest -m slow` | NOT RUN in Task 13a (documentation task); they belong to the controller's final gate (section 12). Last recorded: Task 10 `npm run build` OK |

Environment note: PowerShell's Node 20.20.2 cannot start Vitest forks for the jsdom tests on this machine (an environment error, not a code error); Git Bash with Node 26.9 works, and the shell must `cd` with a capital `D:` drive letter.

## 3. Fake-camera browser gate (Task 11)

Branch `feat/phase-3-live-vision` at `43e3ce3` (before the Task 11b dependency fix). Desktop 1440×900, system Chrome headless via the Playwright CLI, Chrome's fake device only (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<mjpeg>`). Machine: Intel i3-9100F, 4 logical cores, Windows 11. Video: 1280×720 MJPEG, 30 fps, six dataset test faces of 9 s each separated by 1.5 s of empty frames (62.8 MB, scratch only, never committed). A second synthetic video (flat stickers of `fixtures/solve/scramble-a.request.json`) was used for the full-flow run; the model read it 54 of 54 offline before use. Ground truth for the faces: dataset TEST and VALID splits (CC BY 4.0), chosen where the real model reads the face correctly and `analyze` on the label boxes was valid.

**Blocker found first, D1.** The documented start command could not serve `/ws/scan`: the backend environment had no WebSocket library (uvicorn 0.54.0 logged "No supported WebSocket library detected"), the browser handshake got 404 and the Live screen showed "Vision connection lost." In-process TestClient tests cannot see this. The items below were run with the ephemeral overlay `uv run --with websockets uvicorn ...` (no tracked file touched). Resolution: section 7 and Task 11b.

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Health and readiness | PASS | `/health` through the Vite proxy: `{"status":"ok","detectorMode":"yolo","visionReady":true,"solverReady":true,"modelVersion":"yolo26s_rubik_v1@93b727eca123","device":"cpu"}`; no DEMO banner, no unavailable panel |
| 2 | Fake device and lifecycle | PASS | Exactly one videoinput with "fake" in its label; `getUserMedia` count 0 and `srcObject` null on mount; after the click, video playing at 1280×720, transform `none`, `object-fit: contain` |
| 3 | Guide geometry | PASS | Expected square 367.4 px at (302.95, 224.45); measured (303.06, 224.56, 367.17); error under 0.3 px |
| 4 | Overlay alignment | PASS | Overlay box centres vs raw detections: max 0.01 px. Vs dataset label boxes: worst per face F 2.98, R 3.34, B 2.34, U 3.72, D 2.23, L 6.56 px (model versus human label, not an overlay error). Nine cell letters equal ground truth on all six faces |
| 5 | Per-cell feedback | PASS | Empty gap: "Place one cube face inside the square." and nine "not detected" cells. Gate hints persisted 2.8 s, 2.8 s, 2.1 s and about 7 s (rescan) |
| 6 | Stability and auto-capture | PASS | No capture button in Live. First boxes to capture: F 2.0, R 1.9, B 2.0, L 2.7, U 2.2, D 2.6 s. Slower than the designed 1 s (observation O1) |
| 7 | Rotation cue | PASS | Cue below the video (cue top 708.3 px vs guide bottom 591.7 and video bottom 691.3: no overlap); text and caption as built; page `scrollHeight` 900 not above `innerHeight` 900 in all 5 cues; reduced motion makes the arrow static; cue lasts about 1.5 s |
| 8 | Capture correctness | PASS | Reconstruction net: F, R, B, L, U, D each equal to ground truth (6 of 6 faces, 54 of 54 stickers); the second scan and the rescan matched |
| 9 | Completion hand-off | PASS | After the sixth capture: all tracks `ended`, `srcObject` null, WebSocket closed 1000, Reconstruction shown 1.22 s later; "Back to scan" stayed on Scanning for at least 4 s (no bounce) |
| 10 | Reconstruction, solve, recovery | PASS | Mixed real-cube faces: "VALIDATION FAILED" with colour counts, nothing corrected. Recovery: Back to scan, L card, camera again, wrong faces rejected with hints, L accepted. Full flow with the synthetic video: Scan, Reconstruction (valid), Alignment, Solving, 21 moves from the real backend, 0 console errors |
| 11 | Leave, Restart, reload | PASS | Brand button: 4 of 4 tracks ended, all sockets closed 1000, no new frame log lines in 4 s. Restart Scan: track ended, frames 413 to 413 over 5 s. Reload: frames stop, 0 established connections to :8000, "Camera Off" (old tracks cannot be introspected after a reload: indirect evidence) |
| 12 | Demo isolation | PASS | Demo shows the DEMO banner and "Simulated Camera"; 0 `/ws/scan` accepted lines before and after, hooked `WebSocket` count 0, `getUserMedia` 0, no `<video>` |
| 13 | Backend down and model missing | PASS | Backend stopped: "Vision service is not running" with Retry, no DEMO. Missing model: `/health` `{"status":"degraded","visionReady":false,"solverReady":true,"error":"Detection weights not found."}` (no path), screen "Vision model is not available - the solver is still usable", `POST /api/solve` returned 200 |
| 14 | Performance | **FAIL (budget)** | Section 4 |
| 15 | Console | PASS (with notes) | Only the known `THREE.Clock` deprecation warning; two expected `502 /health` while the backend was stopped; one 404 handshake error in the first session (D1). No React warnings |
| 16 | Responsive sanity 1440×900 | PASS (Live) | Live screen `scrollWidth` 1440 equals `innerWidth` in all 1074 samples with the guide visible. Observation O4 on another screen |
| 17 | Orientation honesty | PASS | No text claims pose verification; F stage shows the start pose; U and D show two-step lists |
| 18 | Mobile 390×844 | NOT RUN | Out of scope by decision (desktop-first) |

Counts: PASS 16, FAIL 1 (item 14), NOT RUN 1 (item 18). The blocker D1 is a defect recorded outside the 18 rows and is resolved by Task 11b.

Screenshots (local, in the git-ignored findings folder): 01 live-ready, 02 ws-handshake-404-no-ws-library, 03 live-first-frames, 10 reconstruction-invalid, 11 back-to-scan-no-bounce, 12 rescan-L-selected, 13 gate-rejection-hint, 20 rotation-cue, 21 rotation-cue-reduced-motion, 22 no-face-empty-gap, 23 stable-face-progress, 24 cue-U and cue-D, 30 to 32 demo-scanning, 40 backend-down, 41 model-missing, 50 to 53 bonus full flow. The controller read the findings and screenshots 20 and 23.

## 4. Performance

Budget (design section 8): server inference p95 at most 300 ms and an effective result rate of at least 3 per second. Measured from the backend `scan ... NNNms` log lines on the Intel i3-9100F (4 logical cores) with Chrome and the Vite dev server running on the same machine.

| Run | Frames | Median | p95 | Max |
| --- | --- | --- | --- | --- |
| A, scan 1 | 41 | 464 ms | 865 ms | 1530 ms |
| A, scan 2 | 88 | 484 ms | 847 ms | 1256 ms |
| A, scan 3 | 70 | 413 ms | 812 ms | 1917 ms |
| A, scan 4 | 150 | 263.5 ms | 447 ms | 981 ms |
| A, all (427 frames) | 427 | 374 ms | 782 ms | 1917 ms |
| C, scan f07c86f5 (includes cold start, concurrent with screenshots) | 116 | 283 ms | 1037 ms | 3270 ms |
| C, scan 8b01c2f8 | 172 | 252 ms | 303 ms | 481 ms |
| C, all | 288 | 259.5 ms | 575 ms | 3270 ms |

- Effective result rate (browser `frame_result` messages, 150 frames): 2.71 results per second. Budget 3: **not met**.
- Inference p95 budget 300 ms: **not met** in all six scans; the best scan's p95 was 303 ms. Variance between scans is large (cold start, concurrent browser and Vite load).
- Backend process while scanning: working set 2266 MB, private 2560 MB (design budget 2.5 GB), CPU 6.16 s per 5 s, about 1.2 cores of 4 (torch intra-op threads).
- Time to capture: 1.9 to 2.7 s from the first nine boxes (designed 1 to 2 s): observation O1.
- Design-time measurement, for comparison (full test images, not the guide crop): 640 px median 186 ms, p95 262 ms; 480 px median 107 ms; 320 px median 58 ms.

**User decision (2026-11-23): keep `imgsz=640` and let the physical test decide.** The documented lever is `RUBIK_IMGSZ=480`, changed only after the physical gate. Result row: **FAIL against the budget; accepted as a known limitation pending the physical test.**

## 5. Review record

- Code tasks 1 to 9b each had two independent reviewers (spec compliance, code quality; Sonnet, by user instruction), plus scoped re-reviews after each fix round.
- Task 10 (tests only) and Task 11b (a dependency and a test) had one combined spec and quality reviewer. Both were clean.
- Task 11 (browser gate) and Task 12 (checklist) had no code diff to review: the controller read the findings and screenshots, and the checklist in full.
- Task 13a (this documentation) has a combined documentation reviewer; Task 13 then has the whole-branch review and the final gate (section 12).
- Fix rounds: 10 in total. Task 1: 1; Task 2: 1; Task 3: 0; Task 4: 0; Task 5: 1; Task 6: 1; Task 7: 1; Task 8: 2; Task 9a: 1; Task 9b: 2; Task 10: 0; Task 11b: 0.

### 5.1 Important findings the reviews caught (all fixed)

| Task | Finding | Fix |
| --- | --- | --- |
| 1 | An empty or drive-relative `RUBIK_MODEL_PATH` was not working-directory independent (empty resolved to the backend folder; `C:foo` stayed non-absolute) | Configuration error for both; tests with a changed working directory |
| 2 | `/health` `error` exposed the absolute path and raw exception text, and `ModelUnavailable` was not logged (I1) | Fixed public reason plus a private logged `detail` |
| 2 | Non-`ModelUnavailable` errors from the device check (bad device, torch import) crashed startup (I3) | Device check fails closed into `ModelUnavailable` |
| 5 | The global inference lock was released on handler cancellation while the worker thread was still running (overlapping inference on a non-thread-safe model) (I1) | `locked_detect` waits for the worker before releasing; cancellation test; mutation check (lock removed makes two tests fail) |
| 5 | The disconnect test asserted almost nothing (I2) | Test waits for the detect start, drops the client, and proves the next connection works |
| 6 | A non-fatal `BAD_RESPONSE` during a frame send left the socket open, so a late real result could resolve the next send (I1) | Bad responses are fatal; `frameSeq` must advance |
| 6 | The recorded ws-messages fixture could drift from the backend without a failing test (I2) | Drift test that re-records and compares |
| 7 | `CAPTURE_FAILED` kept the epoch, so a stale result from the failed attempt could confirm a later capture (I1) | `CAPTURE_FAILED` bumps the epoch |
| 7 | A non-finite timestamp bypassed the 1000 ms stability gate (I2) | Non-finite `at` ignored; `!(at - since >= STABLE_MS)` |
| 7 | The gate-rejection hint vanished after one frame (I3) | Hint latched until the centre changes, an invalid result, a capture, a rescan or a rotation |
| 9a | Recognised colours were conveyed only visually (I1) | Colour letters (aria-hidden) in cells, group role |
| 9a | The amber hint and "?" were unreadable on live video (I2) | Dark backing and rings |
| 9b | The rotation cue was absolute at the bottom of the frame and overlapped the guide square (spec, Important) | Cue moved below the frame; layout-number tests at four widths |
| 9b | The Reconstruction hand-off was derived from "all six captured", so "Back to scan" bounced back after 1.2 s (Q1) | Hand-off only on the false-to-true transition while mounted |
| 9b | Stale detection boxes stayed drawn during captured and rotating (Q2) | Boxes only while aligning or stabilizing |
| 9b | The cue covered the progress bar and hint (Q3) | As above |
| 9b | After moving the cue below the frame, the page became about 950 to 970 px tall at 1440×900 (found in the re-review) | The compact cue replaces the status strip while rotating; measured later in the browser gate: `scrollHeight` 900 |

Minor findings that went into a fix round anyway (Task 8 round 2): an un-caught `void run()` could leave the connection "live" with a dead loop; a stale-epoch result still updated `lastResult`; a throwing `createTransport()` crashed the effect; plus vacuous test assertions.

## 6. Rulings (with the cost if wrong)

Every ledger line containing "Ruling" or "Rulings" is listed.

| Ruling | Decision | Cost if wrong |
| --- | --- | --- |
| P1 | `backend/tests/conftest.py` autouse fixture points `RUBIK_MODEL_PATH` at a non-existent tmp file for every test not marked `model`, so ordinary tests never load the checkpoint and behave the same with or without weights | One fixture change |
| P2 | `modelVersion` = `<train_args.name or file stem>@<sha256[:12]>`, i.e. `yolo26s_rubik_v1@93b727eca123` (the plan is authoritative over the design's hyphenated example) | None (display string) |
| P3 | 3 to 4 JPEGs of at most 100 KB from the dataset's test split (CC BY 4.0) in `fixtures/vision/` with `ATTRIBUTION.md` (four were committed) | Replace images |
| Task 1 minor | `RUBIK_ALLOWED_ORIGINS` accepts `*` and malformed values; the origin check uses exact string equality, so `*` can only match a literal `*` Origin | An origin-validation follow-up |
| Task 2, I2 | `load()` blocking inside the async lifespan is accepted: it is a one-time load before the app serves, as the solver load already is | A later `to_thread` wrap |
| Task 3 | `quality.reason` precedence `NO_FACE` > `TILTED` > `AMBIGUOUS` > `MISALIGNED` > `INCOMPLETE`; ambiguous cells carry `null` colour and confidence; misaligned cells keep colour and confidence; `TILTED` marks every kept cell misaligned (the design left precedence open) | UI hint order |
| Task 4, R1 | Only JPEG is accepted (signature `FF D8 FF`); PNG and others are `INVALID_FRAME` | Extra rejections |
| Task 4, R2 | Decompression-bomb guard: parse JPEG SOF0/1/2 dimensions before `cv2.imdecode`; an edge above the limit is `FRAME_TOO_LARGE` without decoding; non-three-component JPEGs are `INVALID_FRAME` | Extra rejections of unusual JPEGs |
| Task 5, Q1 | Process sequentially (receive, decode, detect, send); the one-in-flight rule is enforced by the client; the design's "second frame closes 1008" is not detectable with a sequential loop | A misbehaving client waits instead of being disconnected |
| Task 5, Q2 | Origin header required and exactly equal to an allowed origin; rejected during the handshake (HTTP 403) | None for browsers |
| Task 5, Q3 | `frameSeq` counts every binary frame received (1-based), including frames that produce an error | A different sequence meaning for error frames |
| Task 5, Q4 | Detector exceptions send `error MODEL_UNAVAILABLE` and close 1011, logged by type only | Revisit if retry is wanted |
| Task 7, (a) to (g) | `guideSquare` floors side, x and y and returns null for non-positive or non-finite sizes; the machine carries `rescan`; the capture gate (centre not already captured; F green; U white; rescan reproduces the previous centre); next stage is the first face without a captured centre; the epoch rules; an exported hint table; a `stabilityProgress` helper | Copy and small API tweaks |
| Task 7, gate order | Hint precedence F/U convention, then already-captured centre, then rescan mismatch | Copy only |
| Task 7, epoch override | `CAPTURE_FAILED` now bumps the epoch (overrides rule (e)) | None |
| Task 7, R/B/L | R, B and L centres must not be white (closes the U deadlock) | A non-standard cube with white on a side during R, B, L is rejected with a clear hint |
| Task 8, guard exemption | The exemption in `boundaries.test.ts` is **not accepted**; the machine moved to `frontend/src/lib/live-scan-machine.ts` and the test file was restored byte-identical | One more file move |
| Task 8, round 2 | Three user-visible minors and the weak tests are fixed in a second round although the review approved | One small extra round |
| Task 9 split | Task 9 is split into 9a (presentational components, U/D copy, golden) and 9b (wiring, flow) because each half merits its own review gate | One extra review pair |
| Task 9b | In Live a pending face selection is ignored (order enforced by the guide); a captured face dispatches `rescan` with its captured centre; a new session calls `reset()`; `rescan` flags from `markFaceNeedsRescan` are demo-only | Documented limitation |
| Task 9a, I3 | The U/D golden rewrite is authorised by design section 7 and 13.7; a comment is added in the golden test | None |
| Task 9b fix round 1 | The cue moves out of the frame (below it, only while rotating); caption "Follow the arrow and the reference cube — the app checks colours, not how you hold the cube."; hand-off only on the false-to-true transition; an integration-style screen test keeps the real hook and stores | Copy edit or one more test file |
| Task 9b fix round 2 | The compact cue replaces the status strip while rotating | One layout tweak |
| User decision, ruff | The 16 reformatted files were discarded after the controller proved them AST-identical to HEAD (section 7) | None |

## 7. User decisions

1. **`websockets` dependency exception (2026-11-23).** The plan allowed no new Python dependencies beyond ultralytics, torch and torchvision. The browser gate showed uvicorn had no WebSocket library. The user approved adding `websockets==17.4` (BSD-3-Clause). Only that package was added (`uv.lock` diff is that package and its entries); the constraints file was updated.
2. **Keep `imgsz=640`; the physical test decides (2026-11-23).** See section 4.
3. **Discard the 16 reformatted files (2026-11-23).** See section 9.

## 8. Deviations from the plan

- **File location.** The pure scan machine is `frontend/src/lib/live-scan-machine.ts` (test in `frontend/tests/lib/`), not `features/scanner/`. `hooks/` may not import `features/`; the architecture test was left unchanged rather than weakened.
- **Task 9 split** into 9a and 9b (section 6).
- **Extra Task 11b** (the `websockets` dependency and a real-uvicorn regression test), found by the browser gate.
- **U/D copy rewrite and golden change.** `legacy-scan-guide.json` changed for U and D only (return to the front, then tilt; two-step lists), as mandated by the design.
- **`websockets` added** (section 7).
- **Server-side `roi` not built.** The client crops the guide square (design Q2); ARCHITECTURE section 8.2 was rewritten.
- **No `FixtureDetector`.** The model was already trained, so no fixture backend mode was built (ARCHITECTURE section 13).
- **Four Phase 1 LIVE-block screen tests changed** in Task 9b (Capture button and "Capture unavailable" text removed by design); all Demo tests unchanged.
- **Rotation cue** replaced the status strip while rotating (two fix rounds) instead of a separate block.

## 9. Disclosed TDD gaps and process incidents

- **ruff format incident (Task 5 fix round).** The implementer ran `ruff format app tests` repo-wide, leaving 16 tracked files modified and uncommitted (format only; 155 insertions, 36 deletions). They were in no commit. The implementer asked the controller to discard them; the controller did not, and asked the user. The user approved ("Discard them"). The controller first proved all 16 were AST-identical to HEAD, then ran `git checkout --` on exactly those 16 paths; afterwards `git status` showed only the user's three untracked paths and the suite was green (252 passed, ruff and mypy clean). A similar slip in Task 2 had been reverted by the implementer. Standing rule for all later subagents: never run `ruff format`.
- **Missing task brief.** The Task 7 brief file did not exist when the task was dispatched; the implementer worked from the dispatch text (which carried the full rules) and the brief was generated afterwards for the reviewers.
- **Tests written after (or with) the implementation:** Task 2 fix round (tests and fix together, no separate RED); Task 6 drift test (no observable RED, 0 equals 0.0); Task 8 (implementation before tests, RED shown by removing the implementation); Task 9b (screen tests after the implementation, and after fix rounds 1 and 2; the remount test was mutation-checked); Task 10 (post-hoc integration checks, no RED); Task 11b (test written first and seen RED, but the guard test shares the module).
- **Node versions.** The implementers' shells used different Node versions; one could not start Vitest forks. Counts were reproduced in a working shell by the controller.
- **Not run:** `npm run build` and the slow cross-check were not part of Task 13a.

## 10. Known limitations

**Parked minor findings from the ledger**

| Task | Finding |
| --- | --- |
| 1 | Duplicated positive-int parse; `float()` accepts `0_5` and whitespace; `cuda:N` passes configuration though torch is CPU-only (fails clearly at load); the drive-relative test assumes the repo is not on drive C |
| 2 | Redundant `valid` and type-ignore in `class_map`; test-local imports; the protocol could declare `model_version` and `device`; no direct wrong-task or warm-up-failure tests |
| 3 | A zero or negative-area box among two or more kept cells reports `TILTED` rather than `MISALIGNED` (safe: no wrong colour reaches the grid); NaN confidence passes the minimum filter; missing tests for a negative centre, degenerate box and aspect or size boundaries; the cell index could be clamped |
| 4 | `test_truncated_invalid` lacks a no-decode check; untested parser branches; no imdecode-exception test; EXIF orientation flag; redundant `FrameError.message` |
| 5 | No idle timeout after `hello`, no `ws_max_size` or connection cap (documented, loopback only); `RuntimeError` swallowing in `_send` and `_close` is broad; a second cancellation while awaiting the worker could release the lock early (narrow); the overlap test relies on a 0.2 s delay |
| 6 | The parser does not tie status to colour nullness or range-check numbers; `FrameResult.quality` is not a discriminated union; closing a CONNECTING socket logs a browser warning; untested `connect()` twice, `close()` before `connect()`, `ws.send` throwing |
| 7 | `RESCAN` accepts any face and previous centre; float floor could lose 1 px; no size guard in `cropBoxToFrame`; `done` keeps the last stage; the opposite-centre relation is unchecked; an aliasing test half checks nothing |
| 8 | Canvas reused in the grabber; a throwing `grabFrame` is swallowed and retried; timer-count assertions include sleep timers |
| 9a | Box `title` tooltips are dead under `pointer-events-none`; hint placement unclamped near the viewport bottom; the progress bar transition lacks `motion-reduce`; the verification-claim test covers five phases |
| 9b | Live regions swap between captured and rotating; the strip live region re-mounts on rotating to aligning; no test for Retry during rotating plus error; "Connecting" hidden during a rotating-phase reconnect; a dead `stripText` branch |
| 10 | The first flow test title says "supports a one-face rescan" but does not rescan; the Demo isolation test lacks a positive control; `path: Any` could be `Path` |
| 11b | The server startup wait loop is bounded at about 5 s (a lifespan event would be sturdier); the module-scoped fixture shares one detector double; the README test-count comment was already stale (removed) |

**Browser-gate observations (deferred)**

- **O1** Capture takes about 2 to 2.7 s from the first boxes: five results at about 2.7 per second dominate the 1 s window.
- **O2** The previous face stays on screen after a capture, so the progress bar fills to about 80 % and then the "We still see…" hint appears. Possible improvement: reject an already-captured centre on the first valid result (not done, to avoid churn in the reviewed machine).
- **O3** "Enable camera" still works when the vision service or model is down (Phase 1 behaviour); Restart Scan ends it.
- **O4** The Reconstruction screen's invalid-state view overflows horizontally (scrollWidth 1800 at 1440). The files of that screen are unchanged since `994984e`, so it predates Phase 3.
- **O5** `fixtures/solve/scramble-a.response.json` is a hand-made 12-move demo solution; the backend returns 21 moves for the same request (expected).
- **O6** The rotation cue is visible only about 1.5 s; guide cells at its start may still show the last face's colours. Copy uses British "centre" in hints and "center" elsewhere.

**Other**

- No idle timeout, no `ws_max_size` beyond uvicorn's 16 MiB default, no connection cap on `/ws/scan` (loopback only).
- Face roll and whole-cube orientation remain unprovable; the centre-colour gate catches only some mistakes.
- `vite preview` has no WebSocket proxy and is not supported for live scanning.
- Rescanning after all six faces needs the camera enabled again (the camera and socket stop by design); the first real exercise was the browser gate's recovery run.
- Live faces flagged for rescan by `markFaceNeedsRescan` are not produced in Live today (demo only).
- CPU only; GPU (`cu126`, sm_61) is unverified and deferred.
- Ultralytics is AGPL-3.0 (local use only).
- The `THREE.Clock` deprecation warning remains (known and accepted).

## 11. How to run

```bash
cd backend
uv sync
uv run python -m app.solver.prepare          # once; about 5-7 min, 1.6 GB
uv run pytest                                # default: excludes slow and model tests
uv run pytest -m model                       # real-checkpoint tests; need backend/weights/best.pt
uv run pytest -m slow                        # 300-state cross-check
uv run ruff check .
uv run mypy app
uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm ci
npm run test
npm run lint
npm run build
npm run dev          # http://127.0.0.1:5173 (the only supported live-scan origin, with the backend running)
```

Place the trained checkpoint at `backend/weights/best.pt` (git-ignored). Without it the backend starts, solving works and live scanning reports the model as unavailable. The physical webcam test is run by the user from `docs/superpowers/reports/phase3-physical-test-checklist.md`. Reproducing the fake-camera gate needs the dataset test images and a locally built MJPEG, which are not committed (and their scripts live in the git-ignored findings folder).

## 12. Final gate (controller run at the end)

NOT RUN — the controller fills this section after the whole-branch review.
