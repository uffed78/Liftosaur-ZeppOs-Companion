import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutController } from '../shared/workout-controller.js';
import { workoutToDayPlan } from '../shared/workout-api-plan.js';
import { createMemoryStorageAdapter, createSessionStore } from '../shared/session-storage.js';
import { MESSAGE_TYPES } from '../shared/protocol.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  let clock = 1000;
  let offline = false;
  let beforeWrite = async () => {};
  let beforeRead = async () => {};
  const batches = [];
  const requests = [];
  const store = createSessionStore(createMemoryStorageAdapter());
  const remote = {
    programId: 'program', startTime: 1000, dayData: { week: 1, dayInWeek: 1 },
    entries: [{ entryId: 'bench', name: 'Bench', sets: [0, 1, 2].map(index => ({
      setId: 'set-' + index, weight: '60kg', reps: 8, rpe: 7, timer: 90,
    })) }],
  };
  const request = async (type, payload) => {
    requests.push(type);
    if (type === MESSAGE_TYPES.SYNC_WORKOUT_SETS) {
      batches.push(payload.sets);
      await beforeWrite();
      if (offline) throw Object.assign(new Error('Offline'), { code: 'NETWORK' });
      for (const write of payload.sets) {
        remote.entries[0].sets.find(set => set.setId === write.setId).completed = structuredClone(write.completed);
      }
      remote.entries[0].sets[1].weight = '65kg';
    } else {
      const snapshot = structuredClone(remote);
      await beforeRead();
      return { payload: { workout: snapshot } };
    }
    return { payload: { workout: structuredClone(remote) } };
  };
  const makeController = () => createWorkoutController({ now: () => clock, store, request });
  const controller = makeController();
  controller.loadPlan(workoutToDayPlan(remote), { sync: { mode: 'DIRECT', startConfirmed: true } });
  controller.startWorkout();
  const correct = (weight, reps = 8) => {
    const { draft } = controller.createLastSetDraft();
    return controller.saveLastSetCorrection({ ...draft, weight, reps });
  };
  return { controller, remote, batches, requests, store, correct, makeController,
    setOffline: value => { offline = value; },
    onWrite: callback => { beforeWrite = callback; },
    onRead: callback => { beforeRead = callback; },
    advance: () => { clock += 120000; },
  };
}

test('corrections append behind an in-flight completion without mutating it', async () => {
  const f = fixture();
  const started = deferred();
  const release = deferred();
  f.onWrite(async () => { started.resolve(); await release.promise; });
  f.controller.completeSet();
  const sync = f.controller.syncSets();
  await started.promise;
  assert.equal(f.correct(65, 9).success, true);
  assert.equal(f.correct(70, 10).success, true);
  assert.equal(f.controller.getPendingSetCount(), 1);
  assert.deepEqual(f.batches[0][0].completed, { reps: 8, weight: '60kg', rpe: 7 });
  release.resolve();
  await sync;
  assert.equal(f.batches.length, 2);
  assert.deepEqual(f.batches[1].map(write => write.completed.weight), ['65kg', '70kg']);
  assert.equal(f.controller.getPendingSetCount(), 0);
  f.controller.nextSet();
  assert.equal(f.controller.canCorrectLastSet().set.weight, 70);
  assert.equal(f.controller.view().pending.set.weight, 65);
});

test('offline correction survives restart and retries the same stable set', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.setOffline(true);
  assert.equal(f.correct(75, 6).success, true);
  await assert.rejects(f.controller.syncSets(), /Offline/);
  assert.equal(f.controller.getPendingSetCount(), 1);
  const restored = f.makeController();
  assert.equal(restored.restore().success, true);
  assert.equal(restored.getPendingSetCount(), 1);
  assert.equal(restored.canCorrectLastSet().set.weight, 75);
  f.setOffline(false);
  await restored.retryPendingWrites();
  assert.equal(restored.getPendingSetCount(), 0);
  assert.deepEqual(f.remote.entries[0].sets[0].completed, { reps: 6, weight: '75kg', rpe: 7 });
});

test('an old poll response cannot overwrite a correction made while it was in flight', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.advance();
  const started = deferred();
  const release = deferred();
  f.onRead(async () => { started.resolve(); await release.promise; });
  const poll = f.controller.requestRefresh();
  await started.promise;
  f.setOffline(true);
  assert.equal(f.correct(80).success, true);
  await assert.rejects(f.controller.syncSets());
  release.resolve();
  assert.equal(await poll, false);
  assert.equal(f.controller.canCorrectLastSet().set.weight, 80);
  assert.equal(f.controller.getPendingSetCount(), 1);
});

test('a known deferred Cloud edit refuses the draft without losing local work', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  const draft = f.controller.createLastSetDraft().draft;
  f.remote.entries[0].sets[0].completed.rpe = 9;
  f.advance();
  assert.equal(await f.controller.requestRefresh(), true);
  const before = f.controller.getWorkoutSetWrites();
  assert.equal(f.controller.saveLastSetCorrection({ ...draft, weight: 65 }).success, false);
  assert.deepEqual(f.controller.getWorkoutSetWrites(), before);
});

test('correction leaves rest, pause, prepared selection and all other completion values intact', () => {
  const f = fixture();
  f.controller.completeSet({ setTimer: 30, userVars: { effort: 4 } });
  f.controller.pauseWorkout({ timestamp: 1500, source: 'manual' });
  f.controller.adjustWeight(1);
  const before = f.controller.view(1600);
  const original = f.controller.getWorkoutSetWrites()[0].completed;
  assert.equal(original.rpe, 7);
  assert.equal(original.setTimer, 30);
  assert.deepEqual(original.userVars, { effort: 4 });
  assert.equal(f.correct(62.5, 9).success, true);
  const after = f.controller.view(1600);
  assert.deepEqual(after.rest, before.rest);
  assert.deepEqual(after.pending.set, before.pending.set);
  assert.equal(after.pending.exerciseIndex, before.pending.exerciseIndex);
  assert.deepEqual(after.pending.setsDots, before.pending.setsDots);
  assert.equal(after.isManualWorkoutPaused, true);
  assert.equal(after.state, before.state);
  assert.deepEqual(f.controller.getWorkoutSetWrites()[1].completed, { ...original, weight: '62.5kg', reps: 9 });
});


test('ambiguous acknowledgement retries the correction without another completed set', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  const draft = { ...f.controller.createLastSetDraft().draft, weight: 67.5, reps: 7 };
  f.setOffline(true);
  // The server applied the edit, but its acknowledgement never reached the watch.
  f.remote.entries[0].sets[0].completed = { weight: '67.5kg', reps: 7, rpe: 7 };
  assert.equal(f.controller.saveLastSetCorrection(draft).success, true);
  await assert.rejects(f.controller.syncSets());
  f.setOffline(false);
  await f.controller.retryPendingWrites();
  assert.equal(f.remote.entries[0].sets.filter(set => set.completed).length, 1);
  assert.equal(f.controller.getPendingSetCount(), 0);
  assert.equal(f.remote.entries[0].sets[0].completed.weight, '67.5kg');
});


test('finish cannot erase a correction that has not been acknowledged', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.setOffline(true);
  assert.equal(f.correct(65).success, true);
  await assert.rejects(f.controller.syncSets());
  await assert.rejects(f.controller.finishWorkoutRemote());
  assert.equal(f.requests.includes(MESSAGE_TYPES.FINISH_WORKOUT), false);
  assert.equal(f.controller.getPendingSetCount(), 1);
  const restored = f.makeController();
  assert.equal(restored.restore().success, true);
  assert.equal(restored.getPendingSetCount(), 1);
});


test('a newer deferred phone completion prevents editing the older last set', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  const draft = { ...f.controller.createLastSetDraft().draft, weight: 65 };
  f.remote.entries[0].sets[1].completed = { weight: '65kg', reps: 8 };
  f.advance();
  await f.controller.requestRefresh();
  assert.equal(f.controller.saveLastSetCorrection(draft).success, false);
});

test('correction can target an earlier completed set without changing completion order', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.controller.nextSet();
  f.controller.completeSet();
  await f.controller.syncSets();

  const draftResult = f.controller.createSetCorrectionDraft('set-0');
  assert.equal(draftResult.success, true);
  const result = f.controller.saveSetCorrection({ ...draftResult.draft, weight: 72.5, reps: 6 });
  assert.equal(result.success, true);
  await f.controller.syncSets();

  const writes = f.controller.getWorkoutSetWrites();
  assert.deepEqual(writes.map(write => write.setId), ['set-0', 'set-1', 'set-0']);
  assert.deepEqual(f.remote.entries[0].sets[0].completed, { reps: 6, weight: '72.5kg', rpe: 7 });
  assert.equal(f.controller.canCorrectCompletedSet('set-1').allowed, true);
});

test('undo is latest-only, queued as Cloud uncompletion, and survives ambiguous acknowledgement', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  assert.equal(f.controller.canUndoCompletedSet('set-0').allowed, false, 'rest blocks undo');
  f.controller.nextSet();
  f.setOffline(true);
  const result = f.controller.undoCompletedSet('set-0');
  assert.equal(result.success, true);
  assert.deepEqual(f.controller.getWorkoutSetWrites().at(-1), {
    entryId: 'bench', setId: 'set-0', completed: null,
  });

  // Cloud applied the idempotent uncompletion, but the acknowledgement was lost.
  f.remote.entries[0].sets[0].completed = null;
  await assert.rejects(f.controller.syncSets(), /Offline/);
  const restored = f.makeController();
  assert.equal(restored.restore().success, true);
  assert.equal(restored.getPendingSetCount(), 1);
  assert.equal(restored.view().allCompletedSets.length, 0);

  f.setOffline(false);
  await restored.retryPendingWrites();
  assert.equal(restored.getPendingSetCount(), 0);
  assert.equal(f.remote.entries[0].sets[0].completed, null);
  assert.equal(f.remote.entries[0].sets.filter(set => set.completed).length, 0);
});

test('mocked Cloud contract acknowledges undo, retries it after restore, then re-completes the same set ID', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.controller.nextSet();

  f.setOffline(true);
  assert.equal(f.controller.undoCompletedSet('set-0').success, true);
  await assert.rejects(f.controller.syncSets(), /Offline/);
  const restored = f.makeController();
  assert.equal(restored.restore().success, true);
  f.setOffline(false);
  await restored.retryPendingWrites();

  assert.equal(f.remote.entries[0].sets[0].completed, null);
  assert.deepEqual(f.batches.at(-1), [{ entryId: 'bench', setId: 'set-0', completed: null }]);
  assert.equal(restored.getPendingSetCount(), 0);

  restored.adjustWeight(-2);
  restored.adjustReps(1);
  restored.completeSet();
  await restored.syncSets();
  assert.deepEqual(f.batches.at(-1), [{
    entryId: 'bench', setId: 'set-0', completed: { reps: 9, weight: '55kg', rpe: 7 },
  }]);
  assert.deepEqual(f.remote.entries[0].sets[0].completed, {
    reps: 9, weight: '55kg', rpe: 7,
  });
  assert.equal(f.batches.flat().filter(write => write.setId === 'set-0').length, 4);
  await restored.syncSets();
  assert.equal(f.batches.flat().filter(write => write.setId === 'set-0').length, 4, 'acknowledged work is not duplicated');
});

test('undo refuses an older completion while preserving the current completed sets', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.controller.nextSet();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.controller.nextSet();
  assert.equal(f.controller.canUndoCompletedSet('set-0').allowed, false);
  assert.equal(f.controller.canUndoCompletedSet('set-1').allowed, true);
  assert.equal(f.controller.view().allCompletedSets.length, 2);
});

test('failed local persistence rolls an undo back before any Cloud write', async () => {
  const f = fixture();
  f.controller.completeSet();
  await f.controller.syncSets();
  f.controller.nextSet();
  f.store.save = () => false;

  const result = f.controller.undoCompletedSet('set-0');
  assert.equal(result.success, false);
  assert.equal(f.controller.view().allCompletedSets.length, 1);
  assert.equal(f.controller.getWorkoutSetWrites().length, 1);
  assert.equal(f.batches.length, 1, 'undo must not reach Cloud before durable local save');
});
