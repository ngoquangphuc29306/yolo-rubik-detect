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
