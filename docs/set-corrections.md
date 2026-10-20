# Synchronization status and set corrections

During an active workout, tap the clock and recording status at the bottom of either watch app.

## Recording status

- **On watch**: the workout is recorded locally and Cloud start has not been confirmed, or direct sync is unavailable.
- **N pending**: N distinct sets have writes waiting for confirmation. Several corrections to the same set count as one pending set.
- **Synced**: all queued set writes have been acknowledged by Liftosaur.
- **Conflict** or **Recovery**: open the status for an explanation and resolve the workout on the phone. Local work is retained.

The status does not increase polling frequency. A pending correction prevents finishing until the required writes are acknowledged.

## Edit or undo a completed set

1. Open the exercise list and select an exercise.
2. Tap an editable completed set to change its weight or repetitions; **Save** applies it and **Cancel** leaves the result unchanged.
3. Use **Undo latest set** only when it is offered. Undo is available only for the latest completion, between sets.

Editing any completed set uses its stable Cloud set ID. It does not pause or restart rest, change the next prepared exercise, or add a completed set. Other recorded values, including RPE and timed durations, are retained. Weight changes use the normal 2.5 kg (5 lb) step; the **Fine step** toggle halves it.

A failed save keeps the draft visible with an explanation. If the target changed, cancel and reopen the editor to read the latest values. Saving an unchanged draft does not send another set write. The exercise list selects exercises for navigation without changing the original program order or superset structure.

Corrections require an active direct workout, a stable set ID, and supported weight/repetition values. Finished workouts, unsupported unilateral repetitions and missing required values require the phone. This is not a workout-history editor.

Sets without a stable Cloud set ID are still shown with their completion values, but cannot be edited or undone from the watch.

## Synchronization boundary

The [official Liftosaur API](https://www.liftosaur.com/doc/api) addresses sets by their set ID. Its [public backend contract](https://github.com/astashov/liftosaur/blob/5f8d5da01ce7795dab64904c07531bc62dd09eb0/docs/content/api.md#log-a-set) defines `completed: null` as un-completing that set; the corresponding [backend API test](https://github.com/astashov/liftosaur/blob/5f8d5da01ce7795dab64904c07531bc62dd09eb0/test/api.test.ts) checks for HTTP 200 and a returned workout where the set is uncompleted. The backend also accepts a subsequent non-null completion for the same set ID, and repeating set writes with the same values is safe. Undo posts `completed: null` for the set; this is not a local-only deletion or a workout discard. Undo is journaled and queued behind earlier writes so it survives offline recovery. These contract checks are against the public API source, not a live account. The API applies the last received write and does not offer revision-based conditional updates; avoid editing the same set on both devices at once.

Lifto detects known changes while a draft is open and preserves local corrections through retries. A simultaneous phone edit that the watch has not received cannot be detected atomically. Avoid editing the same set on both devices at once.

Automated tests cover synchronization, recovery, the mocked Cloud request/response flow and watch interactions. Physical-watch rendering remains a separate validation step.
