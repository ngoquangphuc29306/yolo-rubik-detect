# Cubie reference provenance

Independent cubie-level move reference for engine tests. It shares no code with `src/`.

| Item | Value |
|---|---|
| Upstream | https://github.com/ldez/cubejs |
| Pinned commit | `6b3da493894d9aed54f4c8aafccadbe676e745b5` |
| Files fetched | `src/cube.coffee`, `LICENSE` |
| URLs | `https://raw.githubusercontent.com/ldez/cubejs/6b3da493894d9aed54f4c8aafccadbe676e745b5/src/cube.coffee` and `.../LICENSE` |
| Licence | MIT. Copyright (c) 2013-2017 Petri Lehtinen, (c) 2018 Ludovic Fernandez. Verified by the controller via the GitHub API and by reading the fetched LICENSE text. A copy is in `vendor/LICENSE-cubejs`. |
| Retrieved | 2026-11-20, with `curl -fsSL` |
| sha256 `cube.coffee` | `8b161bb9c878c729f91d31bb553a7360d878097e6a24a010a870243f4afc5c4a` (529 lines) |
| sha256 `LICENSE` | `c067e8c9a595d13f5644f94388f2ad32c725bcb4a5b1851fe769b9bccd46a1fd` |
| Transcribed by | Claude (implementer agent), by reading the downloaded file; nothing typed from memory |

## What was transcribed (`vendor/cubejs-tables.ts`)

From `cube.coffee`: lines 5 and 8 (corner and edge index enums), 10-33 (`centerFacelet`, `cornerFacelet`, `edgeFacelet`), 35-45 (`centerColor`, `cornerColor`, `edgeColor`), and 284-337 (basic moves U, R, F, D, L, B: `cp`, `co`, `ep`, `eo`). Each table carries its source line numbers in a comment. The mover in `cubie-reference.ts` re-expresses `multiply` (L256-275), `move` (L442-448) and `asString` (L83-101) in TypeScript. The cubejs solver, the slice moves (E, M, S) and the rotations were ignored.

## Execution

The downloaded files were treated as untrusted data and stored outside the repository. The CoffeeScript was never compiled, executed or installed (no coffee compiler, no npm install). Only the numeric tables were read and transcribed.

## Facelet-order convention

cubejs facelets are in Kociemba order U, R, F, D, L, B, nine per face, row-major (`_U/_R/_F/_D/_L/_B` offsets 0, 9, 18, 27, 36, 45 at L11-16; centre indices 4, 13, 22, 31, 40, 49 at L19). Letters are U R F D L B (L35). This matches the project's `URFDLB` serialization. Move semantics: clockwise viewed from outside the face (self-test checks U on the solved cube against a hand-derived physical result).

## Self-test

`cubie-reference.test.ts` checks, on the reference alone: solved string, `m^4 = id`, `m2 m2 = id`, `m m' = id`, order of `R U R' U'` is 6, order of `R U` is 105, centres fixed, 9 of each letter after a 25-move seeded sequence, and the hand-derived U move.

Phase 2 cross-checks against Python kociemba.
