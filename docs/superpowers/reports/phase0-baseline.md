# Phase 0 — Baseline Verification Report

Date: 2026-11-19 · Branch: `chore/phase-0-baseline` · Plan: `docs/superpowers/plans/2026-11-19-frontend-refactor.md` (Revision 2, approved)
Status legend: **PASS** · **FAIL** · **NOT RUN** · **BLOCKED**. Every PASS/FAIL below comes from a command that was actually run and whose output was inspected. Raw logs were kept in the session scratchpad. They are not committed and are summarised here.

## Summary

| # | Item | Status |
|---|---|---|
| 1 | Git baseline and branch | **PASS** |
| 2 | Backup and checksum manifest | **PASS** |
| 3 | Repository and secret audit (redacted) | **PASS**, no credentials found |
| 4 | Node / npm versions | **PASS** (recorded) |
| 5 | Installed dependency versions | **PASS** (recorded) |
| 6 | npm lockfile migration | **PASS after 1 approved deviation**. The first attempt **FAILED** (ERESOLVE). |
| 7 | Typecheck (`npm run lint`) | **PASS**: 0 errors. Strict mode, informational: 0 errors. |
| 8 | Production build (`npm run build`) | **PASS**, with 2 warnings |
| 9a | Dev-server HTTP / module-transform smoke (loopback) | **PASS** |
| 9b | Browser smoke test, six screens and screenshots | Original run: **NOT RUN** (no browser tool). **Superseded by the supplemental run in §15: PASS**, with 51 screenshots. |
| 10 | Prototype defects reproduced at runtime | Original run: **NOT RUN**. **Supplemental run (§15):** F1, F8 and F13 were reproduced; F10 was not reproduced; F11 is not reproducible from the UI. |
| 11 | Dependency usage audit | **PASS** (recorded) |
| 12 | Agent model allocation | Recorded below. The runtime model identity is not observable. |

## 1. Git baseline and branch — PASS

- The user initialised the repo. The baseline commit `ad7c23b` on `main` is preserved and was neither amended nor recreated. No remote is configured (`git remote -v` is empty). Work happened only on `chore/phase-0-baseline`.
- Phase 0 commits on top of the baseline:
  - `c0bf1f3` docs(plan): adapt to the per-phase Git workflow and execution constraints.
  - `80141d6` build: drop the unused `esbuild` devDependency (user-approved deviation, see §6).
  - `ea5d40c` build: add `package-lock.json`.
  - This report.
- `.gitignore` audit: the baseline `.gitignore` already contains every hardening line from the original T0.1 (Python venvs and caches, `datasets/`, `runs/`, `*.pt`/`*.pth`/`*.onnx`, `backend/weights/*` with a `.gitkeep` exception, `.claude/settings.local.json`, `.codegraph/`, `captures/`, `*.mp4`/`*.mov`, `.env*` with an exception for `!.env.example`). No gaps were found, so no edit was made. `package-lock.json` is tracked, not ignored.
- `git status --ignored` before the install showed no ignored or untracked files. Afterwards, `node_modules/` and `dist/` exist and are ignored.

## 2. Backup — PASS

- Location: `D:\Programming\AI\project\rubik-solver-yolo-baseline-20261119-2239\`. It is outside the repo and untracked. The run checked that the destination did not already exist, so nothing was overwritten.
- Content: an exact export of commit `ad7c23b` (`git archive`), so no untracked or ignored content was copied.
- Manifest: `MANIFEST.sha256` (37 files) inside the backup. `sha256sum -c` verified OK. SHA-256 of the manifest file: `5537d94036c27da00dc0462e42cab22708e6f4be175829aa3454a15826721ecb`.

## 3. Repository audit (redacted) — PASS

| Check | Result | Disposition |
|---|---|---|
| Tracked files with sensitive names | Only `.env.example` | Placeholders only (`GEMINI_API_KEY`, `APP_URL` with dummy values). No real values. Removal is scheduled for T1.18. |
| High-entropy credential patterns (private keys, Google `AIza…`, `sk-…`, `ghp_…`, Slack tokens, JWTs) across all tracked files, including `bun.lock` | 0 matches | none |
| Keyword hits (`secret`, `token`, `api key`, `password`) | Prose in docs, comments in `.env.example`, a `.gitignore` comment | Not credentials |
| Large or binary tracked files (>500 KB) | `src/assets/images/webcam_cube_hands_1795070971051.jpg` (709,998 B) | A stock-style demo image with no EXIF or GPS block. Not a private capture. Kept. |
| Untracked or ignored files before work | none | — |

## 4. Toolchain — PASS

- Node **v26.9.0**, npm **11.19.1**, Windows 11 Pro 10.0.26200.
- Bun is not installed (D2-B).

## 5. Installed dependency versions (`npm ls --depth=0`) — PASS

Every direct dependency resolved to **the same version as `bun.lock`**:

| Package | Version | Package | Version |
|---|---|---|---|
| @google/genai | 2.32.0 | lucide-react | 0.546.0 |
| @react-three/drei | 10.7.9 | motion | 12.43.0 |
| @react-three/fiber | 9.8.2 | react / react-dom | 19.3.1 |
| @tailwindcss/vite | 4.3.5 | tailwind-merge | 3.7.0 |
| @types/canvas-confetti | 1.9.0 | tailwindcss | 4.3.5 |
| @types/express | 4.17.25 | three / @types/three | 0.187.0 |
| @types/node | 22.20.5 | tsx | 4.23.15 |
| @types/react / react-dom | 19.3.0 | typescript | 7.0.2 |
| @vitejs/plugin-react | 6.3.0 | vite | 8.3.8 |
| autoprefixer | 10.6.2 | zustand | 5.1.0 |
| canvas-confetti | 1.9.4 | class-variance-authority | 0.7.1 |
| clsx | 2.1.1 | dotenv | 17.4.2 |
| express | 4.22.3 | three-stdlib (transitive, via drei) | 2.36.1 |

`npm ls` lists 5 `extraneous` packages: `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`. They are WASM runtime helpers that npm placed outside the declared tree. This is informational, has no effect on lint or build, and will be re-checked after T1.18.

## 6. npm lockfile migration — first attempt FAIL, then PASS after an approved deviation

- **Attempt 1, `npm install`: FAIL (exit 1, `ERESOLVE`).**
  - Exact cause: `Could not resolve dependency: peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.8`, with `Found: esbuild@0.25.12` from the root devDependency `esbuild@"^0.25.0"`.
  - Bun ignores optional peers, which is why `bun.lock` exists despite the conflict.
  - No `--force` or `--legacy-peer-deps` was used, and no versions were changed.
- **User decision:** remove the unused `esbuild` devDependency.
  - Evidence that it is unused: there are no imports, Vite 8 bundles with rolldown, and `tsx` ships its own `esbuild` 0.28.2.
  - Committed alone as `80141d6`. `bun.lock` is untouched; it is kept until T1.1 and then deleted.
- **Attempt 2, `npm install`: PASS** (exit 0). 249 packages were added, 256 audited, **0 vulnerabilities**, in about 3 minutes.
- Warnings:
  - `node-domexception@1.0.0` is deprecated (transitive).
  - npm 11 **did not run** 3 install scripts that are not covered by `allowScripts`: `@google/genai` (a no-op preinstall), `protobufjs` (postinstall), and `esbuild@0.28.2` under `tsx` (postinstall). All three belong to packages the app does not use (S5). Lint, build and dev all pass without them. No scripts were approved.
- Lockfile: all 329 `resolved` URLs point to `https://registry.npmjs.org`. Committed as `ea5d40c`.
- **Baseline deviation, documented:** the verified baseline is "original archive minus the `esbuild` devDependency, resolved with npm". The resolved direct-dependency versions match `bun.lock`.

## 7. Typecheck — PASS

- `npm run lint` (`tsc --noEmit`, current non-strict tsconfig, TypeScript 7.0.2): **exit 0, 0 errors.**
- Informational: `npx tsc --noEmit --strict -p .` also gave **exit 0, 0 errors**. Enabling `strict` in T1.2 is therefore expected to be low-risk.

## 8. Production build — PASS (2 warnings)

- `npm run build` (vite 8.3.8): **exit 0**. 2245 modules transformed, built in 2.44 s.
  - `dist/index.html`: 1.51 kB.
  - `dist/assets/index-*.css`: 55.91 kB (9.87 kB gzip).
  - `dist/assets/index-*.js`: **1,314.94 kB** (362.31 kB gzip).
- Warning 1: the Vite config uses `__dirname` (`vite.config.ts:22`), which the future `configLoader: 'native'` default won't support.
- Warning 2: the JS chunk is larger than 500 kB. Code-splitting is out of Phase 1 scope; recorded as a risk.
- Asset finding (confirms S2): the webcam JPEG reaches `dist/` **only** as `dist/src/assets/images/…jpg`, through the AI-Studio `copy-unbundled-src-assets` plugin. It is referenced as a raw string inside the JS bundle and is not a hashed asset. T1.1 turns it into a module import, and the plugin is removed in T1.18 only after a hashed asset is verified.

## 9. Smoke tests

### 9a. Dev server, loopback HTTP and module transforms — PASS

- Started with a CLI host override and no config edits: `npx vite --host 127.0.0.1 --port 3000 --strictPort`.
- `netstat` showed exactly one listener, `127.0.0.1:3000`. A request to the LAN IP (192.168.x.x) failed as expected.
- HTTP 200 for `/`, `main.tsx`, `App.tsx`, all six screen modules, `RubiksCube3D.tsx`, `cubeEngine.ts`, `useRubikStore.ts`, `index.css`, and the webcam JPEG. Every module compiled and served without a transform error.
- The server was **terminated** afterwards and port 3000 was verified closed.
- This proves serving and compilation only. It says nothing about rendering, WebGL, or behaviour.

### 9b. Browser smoke test (six screens, 1440×900 and 390×844, screenshots) — NOT RUN

- No browser automation tool (Claude browser pane or Chrome extension) is available in this session. No screenshots exist.
- Visual equivalence, WebGL rendering, animation feel, responsive layout and physical move directions are **unverified**.
- **Consequence for Phase 1:** there is no visual baseline to compare against. See the recommendation.

## 10. Prototype defects — NOT RUN at runtime

These defects are confirmed **by reading the source** (findings F1–F14 in the plan, §1.2), not by running the app:

- F1: simulated scanning with hard-coded confidences.
- F2: fake boxes over a mirrored real webcam.
- F3: capture copies the preset.
- F4: reconstruction fills in missing data.
- F5: the "solution" is the reversed scramble.
- F6: hard-coded orientation.
- F7: silent `'W'` fallback.
- F8: animation ignores pause.
- F9: interval-based timers.
- F10: the step-back race.
- F11: empty-solution NaN.
- F12: no session guard.
- F13: padded completion time and auto-confetti.

Runtime reproduction of F8–F11 needs a browser and is **NOT RUN**. New statically observed items:

- The `clean` script references a non-existent `server.js`.
- `process.env.DISABLE_HMR` is the only env usage (`vite.config.ts:39,41`).

## 11. Dependency usage audit (T0.3) — PASS

Static `grep` of `src/`, `index.html`, `vite.config.ts` and the npm scripts:

| Package | Verdict | Evidence |
|---|---|---|
| react, react-dom, three, @react-three/fiber, @react-three/drei, zustand, lucide-react, canvas-confetti, class-variance-authority, clsx, tailwind-merge | used | e.g. `RubiksCube3D.tsx:2-4`, `useRubikStore.ts:1`, `utils.ts:1-2`, `button.tsx:2`, `CompletionScreen.tsx:2` |
| vite, @vitejs/plugin-react, @tailwindcss/vite, tailwindcss, typescript | tooling-used | `vite.config.ts:1-5`, `index.css:1`, `lint` script |
| @types/node, @types/react, @types/react-dom, @types/three, @types/canvas-confetti | types for used packages | — |
| **@google/genai, dotenv, express, @types/express, motion, tsx, autoprefixer** | **unused** | No imports. The "motion" hits are only `prefers-reduced-motion`. There is no postcss config. No script uses `tsx`. |
| esbuild | unused; **already removed** (`80141d6`) | — |
| three-stdlib | **phantom dependency** | `RubiksCube3D.tsx:6` imports types from it, but it isn't declared. It is installed transitively (`@react-three/drei@10.7.9 → three-stdlib@2.36.1`). |
| `metadata.json`, `GEMINI_API_KEY`, `APP_URL`, `import.meta.env` | unreferenced | `metadata.json` can be archived in T1.18. |

## 12. Agent and model allocation

| Work | Executor | Requested model | Confirmed runtime identity |
|---|---|---|---|
| Orchestration, Git audit, backup, plan edits, re-run install/lint/build/smoke, this report | main session | Opus 5.5 (`claude-opus-5-5`, set by the user via `/model`) | Main session reports Opus 5.5 |
| T0.2 first install attempt and T0.3 audit | 1 general-purpose subagent | `sonnet` (explicit per-call model) | **Not observable.** The agent did not report its model, and no runtime identity is exposed. `CLAUDE_CODE_SUBAGENT_MODEL` is unset, so there was no override. |

Notes:
- **The Superpowers plugin is not installed.** No `superpowers:*` skills exist in this session and there is no plugin under `~/.claude/plugins`, so those skills could not be invoked. The plan's equivalent protocol was followed manually. This is recorded in plan §14.
- **Addendum 2026-11-19, after the original run:** the statement above is kept as the historical record of the original Phase 0 execution. Afterwards, the user installed the Superpowers skills (`obra/superpowers` @ `22f0b46`, listed in the untracked `skills-lock.json`). They are standalone skills invoked without a namespace (for example `verification-before-completion`). Invocation was **verified** in-session: `using-superpowers`, `verification-before-completion` and the separate `playwright-cli` skill each loaded through the Skill tool. The plan §14 records the same addendum.
- After the blocker, the orchestrator re-ran the install, lint and build directly instead of starting another agent, per the instruction "no extra agents solely for mechanical operations".

## 13. Remaining blockers and risks

1. ~~No browser available, so there is no visual or WebGL baseline.~~ **Resolved by the §15 supplemental run.** Original text kept: This is the main open issue. It affects plan §6.7, the T1.11/T1.12 renderer checks, and acceptance criteria 9 and 11. In Phase 1 those checks would also be NOT RUN unless a browser becomes available.
2. The main JS bundle is 1.31 MB. This is out of scope and recorded.
3. The `__dirname` Vite deprecation warning should be addressed when `vite.config.ts` is cleaned in T1.18 (`import.meta.dirname`).
4. Three install scripts were not run (unused packages). Removing those packages in T1.18 resolves this.
5. Five extraneous WASM-helper packages appear in `npm ls`; to be re-checked after T1.18.
6. ~~Superpowers skills are unavailable~~ (resolved; see the §12 addendum), and the subagent's model identity cannot be confirmed (see §12).
7. The reference fetch in T1.4a still needs network access and a licence check; this stays a Phase 1 stop condition.

## 14. Recommendation

**Phase 1 may begin, with one decision needed first:** how to handle the missing visual baseline. Options:

- **(a) Recommended:** before T1.1, you run `npm run dev -- --host 127.0.0.1` yourself and capture the six screens at the two viewports, or enable a browser tool for this session so I can capture them. Phase 1 UI tasks then have a real reference.
- **(b)** Proceed without a browser. Every visual, WebGL and move-direction check in Phase 1 is reported as NOT RUN, and acceptance criteria 9 and 11 would remain open at the Phase 1 gate.

The build, typecheck, install and audit gates are green. No refactoring has started.

---

## 15. Supplemental browser verification (2026-11-19, after the original gate report)

This section is **new evidence**; §1–§14 above are the original results and are unchanged apart from cross-reference notes. The work was observation only: no source, config or dependency change was made.

### 15.1 Environment

| Item | Value |
|---|---|
| Application commit | `963168f` on `chore/phase-0-baseline` (application source identical to the baseline `ad7c23b`, except the removed `esbuild` devDependency) |
| Tool | `playwright-cli` 0.1.25, installed globally with user approval (`npm install -g @playwright/cli@0.1.25`; it pulls in `playwright@1.66.0-alpha-2026-11-18`). **Not** added to the app's `package.json`. No browser was downloaded. |
| Browser | System Google Chrome, **headless**, `HeadlessChrome/152.0.0.0` (`--browser=chrome`) |
| WebGL | WebGL2 hardware: `ANGLE (NVIDIA GeForce GTX 1060 3GB, Direct3D11)`. Not software GL, so the app's SwiftShader quality fallback is not triggered. |
| Dev server | `npx vite --host 127.0.0.1 --port 3000 --strictPort`. Listened on `127.0.0.1:3000` only. Baseline config was not edited. |
| Viewports | Desktop 1440×900. Mobile 390×844 by **resize only**: no touch or DPR device emulation. |
| Webcam | Never enabled. No camera prompt appeared. No personal footage. |
| Executor | Browser walkthrough by a Sonnet subagent (requested model `sonnet`; runtime identity not observable). The orchestrator (Opus 5.5) independently re-checked the file count and dimensions, port closure, process cleanup, git status, and 4 screenshots visually. |

**Environment incident:**
- The first dev-server instance served a stale Vite dependency-optimizer cache. The page was blank, with `Invalid hook call` and `Cannot read properties of null (reading 'useCallback')` at `App.tsx:18`.
- The server was restarted once with `--force`, which rebuilds the git-ignored `node_modules/.vite`. Everything was clean afterwards.
- This is classified as an environment artefact, not an app defect. Nothing was edited. All results below come from the second instance.

### 15.2 Screenshots — PASS (captured)

- 51 PNGs, about 14 MB, in `docs/superpowers/reports/screenshots/baseline/`.
- The orchestrator verified the dimensions:
  - 20 at 1440×900 (desktop screens);
  - 18 at 1440×836 (desktop move-direction captures);
  - 8 at 390×844 (mobile viewport);
  - 5 mobile full-page captures (390×935 to 390×3725).
- **Desktop:** all six screens, covering:
  - Landing;
  - Scanning: normal plus 6 simulated conditions (02a–02f);
  - Reconstruction: running, complete with the 2D net, 3D twin, invalid state;
  - Alignment;
  - Solving: mid-animation, countdown, paused, Lost-track dialog;
  - 9 move-direction pairs (`05-move-stepNN-<move>-{mid,post}`);
  - Completion: on arrival, before confirm, after confirm.
- **Mobile:** all six screens at least once, plus full-page captures.
- **NOT RUN:** mobile Solving paused and mobile Lost-track dialog; the duplicate "Normal" re-simulation (02g).

### 15.3 Behaviour checks

Screenshots and pixel diffs are observations. They do **not** establish correct animation or move semantics.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Pause stops the 3D animation | **FAIL** (defect **F8** reproduced) | Pause was pressed about 60 ms into an R2 animation, and the UI showed "Paused". Between a screenshot right after the click and one 400 ms later, 140,314 px changed and the move completed. `05-solving-paused-desktop.png` shows the L layer mid-turn under "Session paused". Unrelated changes of about 5,000 px also occur while paused. That region is most likely the pulsing move arrow (`RubiksCube3D.tsx:237-241`, an orchestrator inference), so hash equality could not be used as proof. |
| 2 | Countdown | **PASS** (prototype behaviour) | Starts at 5 s about 1.1–1.4 s after a step begins, decrements about once per second, auto-advances at 0. Pause freezes it; Resume continues from the frozen value. |
| 3 | Replay | **PASS** (prototype behaviour) | "Step 2 of 18" is unchanged and the same move re-animates. **Finding:** Replay while paused followed by Resume restarts the countdown at the full value. This is acceptable under the planned semantics; recorded for T1.9. |
| 4 | Speed slider | Observed: it applies **immediately** to the current countdown ("4s" became "2s" at once) | Differs from ARCHITECTURE §7.3, where the change applies at the next step. Phase 1 changes this deliberately (plan §2.1 item 9). |
| 5 | Prev/Next | Observed working | Next/Prev change the step; Prev is disabled at step 1; Next at step 18 goes to Completion. Removed in Phase 1 (D3-B). |
| 5b | Step-back race **F10** | **NOT REPRODUCED** in the attempts made | Prev→Replay and Prev→Prev→Replay gave consistent steps. The race remains plausible from the code (plan §1.2). |
| 6 | Empty solution **F11** | **NOT RUN** | Not reproducible from the UI (every preset has 18 moves). Covered by unit tests in Phase 1. |
| 7 | Visible move directions | **PASS as observation only** | R, R', F, L, U2, B: consistent with the plan §6.7 table. D and U': probably consistent, low confidence. Move sequence: `D' F U' R2 B D2 L U' F' R U2 B2 L' D F2 R U' R'`. The orchestrator viewed `05-move-step10-R-mid`: the right layer rotates with the arrow arcing up the right face, consistent with R. |
| 8 | Completion | **FAIL** (defect **F13** reproduced) | "Time Spent 1:12" after a run of about 10 s (72 s floor = `solution.length*4`, `CompletionScreen.tsx:84`). Confetti fires automatically on arrival. After confirm: "VERIFIED SOLVE … Solve confirmed across all 54 stickers". |
| 9 | Browser console | **PASS** (no app errors after the cache rebuild) | 0 app errors. Warnings: `THREE.Clock … deprecated, use THREE.Timer` on every load. One `favicon.ico` 404 per load. |
| 10 | Scanning fake detections **F1** | **FAIL** (defect reproduced) | Per-sticker labels such as "G 0.99" and "Detection Confidence 98.2%" over a static stock photo; the labels do not match the photo's stickers. The landing hero also shows "98.4% avg". Auto-capture advances on a timer, about 2.5 s per face. |
| 11 | Responsive layout (390 px) | **FAIL** (layout defects) | No horizontal overflow on any screen (`scrollWidth == innerWidth == 390`). But **Solving** on mobile has an oversized, clipped cube, and the countdown ring and control dock overlap it (orchestrator viewed `05-solving-mobile.png`). **Completion** clips the cube and its badges overlap it. Landing, Scanning and Alignment look fine. |
| 12 | Three.js / WebGL available | **PASS** | Hardware WebGL2. The 3D cube rendered on every screen that has one. |

### 15.4 Additional defects for Phase 1 (new, observed in the browser)

| ID | Defect | Phase 1 owner |
|---|---|---|
| N1 | Desktop and mobile Completion: the cube is clipped by its card (seen in `06-completion-before-confirm-desktop.png`), and the mobile badges overlap it | T1.13 (keep the visual design; fix the framing only if it is a trivial layout fix, otherwise log a follow-up) |
| N2 | Mobile Solving: oversized, clipped canvas; HUD and countdown overlap the cube | T1.12 (record; a layout redesign is out of scope unless trivial and approved) |
| N3 | "Test Invalid Cube State" shows "Parity check failed" while its message describes a colour-count mismatch | T1.15 (real validation stages replace this) |
| N4 | The simulated "Loading AI Model" option has no visible effect; the loading UI appears only for about 1 s at startup | T1.14 (fake loading delay removed) |
| N5 | Speed change applies to the current countdown, contrary to ARCHITECTURE §7.3 | T1.9 / T1.12 |
| N6 | `THREE.Clock` deprecation warning; missing favicon (404) | T1.18 (favicon) and T1.11 (only if the clock is touched) |
| N7 | Mobile Reconstruction opened on the 3D Twin tab while desktop opened on the 2D Net (timing-dependent; low priority) | T1.15 (observe) |

### 15.5 Cleanup — PASS (verified by the orchestrator)

- `playwright-cli close-all` was run.
- The vite processes started by the agent were stopped by PID.
- `netstat` shows nothing listening on :3000.
- No headless Chrome processes remain.
- No `.playwright-cli/` folder exists in the repo.
- `git status` showed only the new screenshots folder, plus the user's pre-existing untracked `.claude/` and `skills-lock.json`, which were not staged.

### 15.6 Updated recommendation

The visual and WebGL baseline now exists, so blocker §13.1 is resolved. **Phase 1 may begin after your approval.**

Remaining open points:
- Desktop UI equivalence checks in Phase 1 can be compared against these screenshots.
- Mobile Solving and Completion are already defective in the baseline, so mobile equivalence means "no worse than baseline", unless you approve layout fixes.
- `playwright-cli` stays installed globally until you ask for it to be removed.
- The screenshots add about 14 MB of binary files to the repository history.
