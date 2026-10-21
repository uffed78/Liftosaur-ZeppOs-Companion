import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../data-widget/common/index.js', import.meta.url), 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}

test('clean active screen keeps touch weight steps and saves through the session controller', () => {
  const controls = [];
  const adjustments = [];
  const set = { weight: 60, reps: 8, isUnilateral: false };
  const view = { state: 'ACTIVE_SET', currentSet: set, exerciseName: 'Bench Press',
    currentSetIndex: 1, totalSets: 4, unit: 'kg' };
  let completed = 0;
  let synced = 0;
  const env = {
    SESSION_STATES: { REST: 'REST', FINISHED: 'FINISHED' },
    THEME: { textPrimary: 1, textSecondary: 2, textMuted: 3, primaryLight: 4 },
    widget: { FILL_RECT: 1 }, px: x => x, font: () => 12,
    align: { CENTER_H: 1, CENTER_V: 1 }, text_style: { NONE: 0 },
    addWidget() {}, addLiveLabel(key, props) { controls.push({ key, ...props }); },
    cleanText() {}, renderCleanHeader() {},
    cleanButton(text, x, y, w, h, click) { controls.push({ text, click }); },
    truncate: text => text, formatActiveSetProgress: () => 'Set 2/4',
    formatEditableSetValue: value => String(value),
    formatLoadoutLabel: () => '', weightStepperDisplay: weight => ({ value: `${weight} kg` }),
    fineWeightStep: false, scheduleRenderUI() {}, checkRequiredPhoneInput: () => null,
    workoutController: {
      adjustWeight: value => adjustments.push(value), adjustReps: value => adjustments.push(value),
      completeSet() { completed += 1; }, view: () => ({ state: 'ACTIVE_SET' }),
    },
    workoutDiagnostics: { record() {} }, WORKOUT_DIAGNOSTIC_CODES: { SET_TAP: 1, SET_SAVED: 2 },
    syncCompletedSets() { synced += 1; },
  };
  vm.createContext(env);
  vm.runInContext(extract('renderCleanActiveSetScreen'), env);
  env.renderCleanActiveSetScreen(view);
  controls.find(item => item.text === '+').click();
  assert.deepEqual(adjustments, [1]);
  controls.find(item => item.key === 'weight-value').click_func();
  assert.equal(env.fineWeightStep, true);
  controls.length = 0;
  env.renderCleanActiveSetScreen(view);
  controls.find(item => item.text === '+').click();
  assert.deepEqual(adjustments, [1, 0.5]);
  controls.find(item => item.text === 'COMPLETE SET').click();
  assert.equal(completed, 1);
  assert.equal(synced, 1);
});

test('clean exercise selection opens all sets and finishing requires confirmation', () => {
  const controls = [];
  let finishCount = 0;
  let submitCount = 0;
  const env = {
    THEME: { card: 1, primaryDark: 2, cardActive: 3, textPrimary: 4,
      textSecondary: 5, primaryLight: 6 },
    widget: { BUTTON: 1 }, px: x => x, font: () => 12,
    cleanText() {}, renderCleanHeader() {},
    cleanButton(text, x, y, w, h, click) { controls.push({ text, click }); },
    addWidget(_type, props) { controls.push(props); },
    workoutProgress: () => ({ completed: 1, total: 5 }),
    OVERVIEW_PAGE_SIZE: 3, SESSION_STATES: { REST: 'REST' },
    truncate: text => text, supersetColor: () => 7,
    selectedOverviewExerciseIndex: null, overviewPage: 0, overviewSetsPage: 0,
    isOverviewOpen: true, cleanFinishConfirmationRequested: false,
    scheduleRenderUI() {}, renderExerciseSetsScreen() {},
    workoutController: { finishWorkout() { finishCount += 1; } },
    submitWorkout() { submitCount += 1; },
  };
  const view = { state: 'ACTIVE_SET', currentExerciseIndex: 0,
    overviewExercises: [{ index: 0, name: 'Bench Press', completedSetsCount: 1, totalSets: 3 },
      { index: 1, name: 'Squat', completedSetsCount: 0, totalSets: 2, supersetGroup: 'A' }] };
  vm.createContext(env);
  vm.runInContext(extract('renderCleanOverviewScreen'), env);
  vm.runInContext(extract('renderCleanFinishConfirmation'), env);
  env.renderCleanOverviewScreen(view);
  assert.equal(controls.filter(item => item.diagnosticAction === 'SELECT_EXERCISE').length, 2);
  controls.find(item => item.diagnosticAction === 'SELECT_EXERCISE').click_func();
  assert.equal(env.selectedOverviewExerciseIndex, 0);
  env.selectedOverviewExerciseIndex = null;
  controls.find(item => item.text === 'Finish Lifto').click();
  assert.equal(env.cleanFinishConfirmationRequested, true);
  assert.equal(finishCount, 0);
  controls.length = 0;
  env.renderCleanFinishConfirmation();
  controls.find(item => item.text === 'Confirm').click();
  assert.equal(finishCount, 1);
  assert.equal(submitCount, 1);
});
