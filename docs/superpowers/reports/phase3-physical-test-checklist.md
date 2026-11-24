# Phase 3 physical webcam test: checklist and results template

This is a to-do list for you, at your desk, with a real 3x3 cube and a real webcam.
Run it once, in one sitting (about 1.5 hours for five sessions).

## 1. Purpose and honesty note

- Goal: find out whether live scanning works on a real cube, with a real camera.
- The assistant has NOT performed any physical test. It is not allowed to open your webcam.
- Every physical result below is **NOT RUN** until you fill it in.
- Automated tests and the fake-camera browser run (a video file pretending to be a camera) do NOT count as physical results.
- Nothing in this document says Phase 3 is physically verified. Only your filled tables can say that.

## 2. Preparation (about 10 minutes)

**Hardware and light**
- A normal stickered 3x3 with white, yellow, red, orange, blue and green stickers.
- Even indoor light. No glare on the stickers. A plain background.
- Hold the cube about arm's length from the webcam, matte side toward the camera.
- Keep the cube steady. Shaky hands are the most common reason a face is not captured.

**Start the backend (terminal 1).** The one-time solver table build takes 5-7 minutes. Skip it if it was done before.

```powershell
cd backend
uv sync
uv run python -m app.solver.prepare
uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000 2>&1 | Tee-Object -FilePath scan.log
```

`Tee-Object` shows the log on screen and also saves it to `backend/scan.log`. You need this file later.

**Start the frontend (terminal 2).**

```powershell
cd frontend
npm run dev
```

**Check before you start**
1. Open http://127.0.0.1:5173/health. It must show `"visionReady": true`. (It needs `backend/weights/best.pt`.)
2. Open http://127.0.0.1:5173, click **Scan My Cube**.
3. The page must NOT show a DEMO banner. If it does, stop: you are in the demo, not live mode.
4. In terminal 1, each camera frame writes a line like `scan a1b2c3d4 frame 5 valid=True reason=None 283ms`. The 8 characters after `scan` are the scan id. A new scan gets a new id.

**Start pose.** Green centre toward the camera, white centre on top.

**One rule.** Rotate the WHOLE cube. Never turn a single layer while scanning.

## 3. Session procedure (repeat 5 times)

Use a DIFFERENT scramble each time (about 20 random moves). Write each scramble down.

| Session | Conditions |
| --- | --- |
| 1 and 2 | Daytime light |
| 3 | Lamp light |
| 4 | Slightly tilted hold (a few degrees, still a normal grip) |
| 5 | A different background |

For each session:
1. Scramble the cube. Hold it in the start pose.
2. Click **Scan My Cube**, then **Enable camera**. Allow the browser to use your camera.
3. Put the cube face inside the square on screen. Hold it steady. The face is captured by itself (there is no capture button).
4. After each capture an arrow shows how to rotate the cube. Follow the arrow and the reference cube. The order is **F, R, B, L, U, D**.
5. Start the clock when the arrow cue ends. Stop it at the capture. Note the seconds for each face.
6. If a face is not captured within 10 seconds: hold steadier, adjust the light, and note it as a **failed attempt** for that face. Keep trying.
7. To redo a face you already captured, click its face card, then scan it again.
8. After the 6th face the camera turns off and the Reconstruction screen opens.
9. **Review.** Compare the 2D net on screen with the physical cube, face by face, every one of the 54 stickers. The net's colours are what the app will solve. Write down every difference.
10. If the backend says the state is invalid, note the message. Rescan the face you suspect, or use **Back to scan**.
11. If the state is valid, continue to Alignment. Turn your real cube so its centres match the on-screen cube, then start the guided moves.
12. Follow every guided move on the real cube until the guidance ends. Then check the real cube. Is it solved? (The button **My Cube Is Solved** is your own confirmation, not the app's.)
13. Copy the backend log lines for this session (see section 4) before you start the next one.

## 4. Per-session results template

Copy this table once per session and fill it in. Leave `NOT RUN` where you did not do something.

| Field | Result |
| --- | --- |
| Session # | NOT RUN |
| Scramble | NOT RUN |
| Lighting / background | NOT RUN |
| Faces auto-captured without help (x/6) | NOT RUN |
| Failed attempts per face (F/R/B/L/U/D) | NOT RUN |
| Wrong captures (face, and which stickers differ from the real face) | NOT RUN |
| Seconds per face, from the end of the arrow cue to capture (F/R/B/L/U/D, or the median) | NOT RUN |
| Reconstruction net matches the cube (54/54: yes/no, list differences) | NOT RUN |
| Backend verdict (valid state / error message) | NOT RUN |
| Followed the guidance to the end and the cube is solved (yes / no / not attempted) | NOT RUN |
| Inference ms (median and p95 from the log) | NOT RUN |
| Notes | NOT RUN |
| Anything surprising | NOT RUN |

**Inference time.** Run this in PowerShell from `backend/`. It reads `scan.log`, takes every frame line and prints the median, p95 and max in milliseconds. (It uses the nearest-rank method.)

```powershell
$v = Get-Content scan.log | Where-Object { $_ -match 'frame \d+ valid=.* (\d+)ms\s*$' } | ForEach-Object { [int]$Matches[1] } | Sort-Object; "n=$($v.Count) median=$($v[[math]::Ceiling(0.5*$v.Count)-1]) p95=$($v[[math]::Ceiling(0.95*$v.Count)-1]) max=$($v[-1])"
```

To measure ONE session, use its scan id (replace `a1b2c3d4`). Change the match to `"scan a1b2c3d4 frame \d+ valid=.* (\d+)ms\s*$"` and keep the rest.

## 5. Acceptance criteria (design section 10)

| Metric | Acceptance |
| --- | --- |
| Faces auto-captured without manual help | 30/30 |
| Wrong captures (captured grid ≠ physical face) | 0 |
| Complete 54/54 reconstructions | ≥ 4 of 5 sessions; any failure must be caught by validation or the review screen, never solved silently |
| Median time per face from end of rotation cue to capture | ≤ 5 s |
| Server inference p95 (from backend logs) | ≤ 300 ms |
| End-to-end: physical cube solved by following the guidance | ≥ 3 different scrambles |

Known before you start:
- The fake-camera run measured p95 303-1037 ms on this machine, with Chrome and Vite running at the same time. The budget may be missed here.
- If the physical run misses the p95 budget, restart the backend with a smaller input size and run again:

  ```powershell
  $env:RUBIK_IMGSZ = '480'
  uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000 2>&1 | Tee-Object -FilePath scan-480.log
  ```

  Record BOTH runs (default size and 480) and say which log each number came from.
- In the fake-camera run, a capture took about 2-2.7 s from the first boxes on screen. This is slower than the design's rough 1 s. Count your time from the end of the arrow cue, as in the table above.
- When you rotate to a new face, the old face may still be seen for a moment. The app may show a hint such as "We still see the green face". That is normal, not a failure, if the next face is then captured.

**STOP rule (design section 5.4).** Stop the test and tell the assistant if either happens:
- Any wrong capture (a captured face differs from the real face), or
- More than 10 % of face attempts fail to auto-capture within 10 s, with a correctly aligned cube under normal indoor light.

Either result stops Phase 3 for a design change. Do not tune anything yourself.

## 6. How to report back

Send the assistant:
1. The five filled tables from section 4.
2. 3-6 screenshots of anything wrong (a wrong net, an error message, a hint that blocked a capture).
3. The backend log lines for any failed session (copy the lines with that session's scan id from `scan.log`).
4. The summary table from section 7, updated.

Use one of these sentences:
- Done: `The Phase 3 physical webcam test is done: the filled results are in the checklist file and the summary table is updated.`
- Failed: `The Phase 3 physical webcam test failed (STOP rule hit): see the filled results and screenshots.`

## 7. Results summary (update after your five sessions)

| Criterion | Acceptance | Result |
| --- | --- | --- |
| Faces auto-captured without help | 30/30 | NOT RUN |
| Wrong captures | 0 | NOT RUN |
| Complete 54/54 reconstructions | ≥ 4 of 5 | NOT RUN |
| Median time per face | ≤ 5 s | NOT RUN |
| Server inference p95 (default size) | ≤ 300 ms | NOT RUN |
| Server inference p95 (`RUBIK_IMGSZ=480`, only if needed) | ≤ 300 ms | NOT RUN |
| Different scrambles solved by following the guidance | ≥ 3 | NOT RUN |
| STOP rule triggered | no | NOT RUN |
