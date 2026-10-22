# Minimal Workout UI

This isolated branch implements the approved minimal, touch-first UI for **Lifto Workout**, the Workout Extension inside Zepp's native Strength Training activity. PR #4, `main`, and the standalone Companion UI are unchanged. The earlier [prototype](prototype.html) remains a design reference; the native screens are in `data-widget/common/index.js`.

## Flow

1. The active screen shows only the exercise, set position, target weight/reps, an exercise-list button, and **SET KLART**.
2. Completing a set opens a large rest timer when rest is planned. The completed reps and weight are tappable there. Without planned rest, a brief result screen offers the same actions.
3. Each correction screen changes one value at a time. Reps move by one; weight uses the existing normal step (2.5 kg for kg plans) and a fine-step toggle. Save and latest-only undo use the existing controller and offline journal.
4. The exercise list lets the user select any unfinished exercise directly. The detail button beside each exercise shows all its sets, with direct editing of completed sets where a stable ID and Workout API permit it. Superset membership remains visible.
5. After the final set, Lifto stays open for correction. The user must explicitly confirm **Avsluta Lifto**. This finishes only the Liftosaur session; Zepp's native workout continues independently.

All primary actions have visible touch targets. Crown and swipe are not required. The screens reuse the PR #4 persistence and ordered Cloud sync paths. Imported or ID-less completions are shown but cannot be edited when the controller cannot identify them safely.

## Build and watch check

Run `npm ci`, `npm test`, then `ZEPP_WORKOUT_EXTENSION_APP_ID=<your extension ID> npm run build:workout`. The generated Workout Extension has version `0.5.16` (code `52`) so a preview under the same App ID updates the earlier `0.5.15` (code `51`) build. The personal App ID stays in the environment, not the repository. The Companion release metadata remains at `0.5.14`.

Check the layout, touch targets, exercise switching, corrections, undo, supersets, rest, offline recovery, and Cloud sync on the physical Balance 2. The Zeus build and preview alone do not verify those interactions on the watch.
