# Clean Workout UI exploration

This branch explores a simpler touch-first UI for **Lifto Workout**, the Workout Extension inside Zepp's native Strength Training activity. It starts at PR #4 (`aa02a73`) and leaves that branch and `main` intact.

Open [prototype.html](prototype.html) in a browser to try the interaction flow. The prototype simulates set entry, exercise selection, rest, editing, latest-only undo, and finish confirmation. It does not run on a watch or synchronize with Liftosaur Cloud.

The three images are visual references, not verified Balance 2 layouts:

| Screen | Reference | Primary action |
| --- | --- | --- |
| Active set | [active-set.png](active-set.png) | Adjust weight/reps, then complete the set |
| Exercise list | [exercises.png](exercises.png) | Select an exercise in any order |
| Rest | [rest.png](rest.png) | Watch the countdown, adjust rest, or start the next set |

## Interaction requirements

- Every core action has a visible touch target. Crown and swipe input are optional and must not be required.
- Keep the active set focused on exercise name, set position, weight, reps, and one primary action.
- Use 2.5 kg as the normal weight step, with a visible way to switch to a finer step; reps change by one.
- Show all planned and completed sets after tapping an exercise. Preserve stable-ID editing and latest-only undo from PR #4.
- Show supersets as related rows without forcing a fixed exercise order.
- Give the rest countdown most of its screen. Keep access to the next set and timer controls.
- Preserve the offline journal, ordered/idempotent Cloud sync, confirmation before ending the Liftosaur session, and native Zepp workout ownership.
- Do not add workout analytics, images, plate calculation, program editing, or RPE controls to the primary workout screens.

## Hardware and installation boundary

The images are not a compatibility result. Verify layout and touch targets on the physical Balance 2, recording model, firmware, and Zepp OS version. A build using the existing App ID `1132171` would replace the currently installed preview on the watch. To keep both versions installed for side-by-side testing, register a separate Workout Extension App ID and pass it through `ZEPP_WORKOUT_EXTENSION_APP_ID`; do not commit a personal ID.
