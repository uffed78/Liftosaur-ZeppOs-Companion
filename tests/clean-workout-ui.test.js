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

test('minimal ready screen keeps pass selection and explicit start', () => {
  const controls = [];
  const labels = [];
  const env = {
    MINIMAL_UI_BUILD: 'UI 17',
    THEME: { textMuted: 1, primaryLight: 2, textSecondary: 3, textPrimary: 4 },
    align: { LEFT: 1 },
    readyPage: 0, listPage: 3, screen: 'SESSION',
    EXTENSION_SCREENS: { DAYS: 'DAYS' },
    cleanText(text) { labels.push(text); },
    cleanButton(text, x, y, w, h, click) { controls.push({ text, click }); },
    truncate: text => text,
    readyExercisePage: (exercises, page) => ({ exercises: exercises.slice(page * 2, page * 2 + 2),
      page, totalPages: 2 }),
    scheduleRenderUI() {},
    nativePauseReconciler: { reset() { env.reset = true; } },
    workoutController: { startWorkout() { env.started = true; } },
  };
  const view = { dayName: 'Helkropp + Bänk', programName: 'LiftTrack', totalExercises: 3,
    overviewExercises: [{ name: 'Squat' }, { name: 'T Bar Row' }, { name: 'Bench Press' }] };
  vm.createContext(env);
  vm.runInContext(extract('renderCleanReadyScreen'), env);
  env.renderCleanReadyScreen(view);
  assert.ok(labels.includes('Squat'));
  assert.ok(labels.includes('T Bar Row'));
  controls.find(item => item.text === 'STARTA PASS').click();
  assert.equal(env.started, true);
  assert.equal(env.reset, true);
  controls.find(item => item.text === 'BYT PASS').click();
  assert.equal(env.screen, 'DAYS');
  assert.equal(env.listPage, 0);
});

test('minimal active screen saves a set without weight or rep controls', () => {
  const controls = [];
  const set = { setId: 'bench-2', weight: 60, reps: 8, isUnilateral: false };
  const view = { state: 'ACTIVE_SET', currentSet: set, exerciseName: 'Bench Press',
    currentSetIndex: 1, totalSets: 4, unit: 'kg' };
  let completed = 0;
  let synced = 0;
  const env = {
    MINIMAL_UI_BUILD: 'UI 17',
    SESSION_STATES: { REST: 'REST', FINISHED: 'FINISHED' },
    THEME: { textPrimary: 1, textSecondary: 2, textMuted: 3, primaryLight: 4 },
    widget: { FILL_RECT: 1 }, px: x => x, font: () => 12,
    align: { CENTER_H: 1, CENTER_V: 1 }, text_style: { NONE: 0 },
    addWidget() {}, addLiveLabel(key, props) { controls.push({ key, ...props }); },
    cleanText() {}, renderCleanHeader() {},
    cleanButton(text, x, y, w, h, click, primary, diagnosticAction) {
      controls.push({ text, x, y, w, h, click, diagnosticAction });
    },
    truncate: text => text, formatActiveSetProgress: () => 'Set 2/4',
    formatEditableSetValue: value => String(value),
    scheduleRenderUI() {}, checkRequiredPhoneInput: () => null,
    cleanReviewSetId: null,
    workoutController: {
      completeSet() { completed += 1; }, view: () => ({ state: 'REST' }),
    },
    workoutDiagnostics: { record() {} }, WORKOUT_DIAGNOSTIC_CODES: { SET_TAP: 1, SET_SAVED: 2 },
    syncCompletedSets() { synced += 1; },
  };
  vm.createContext(env);
  vm.runInContext(extract('renderCleanActiveSetScreen'), env);
  env.renderCleanActiveSetScreen(view);
  assert.equal(controls.some(item => item.text === '+' || item.text === '−'), false);
  assert.ok(controls.some(item => item.text === 'Övningar'));
  assert.ok(controls.find(item => item.text === 'SET KLART').y <
    controls.find(item => item.text === 'Övningar').y);
  assert.ok(controls.find(item => item.text === 'Övningar').y +
    controls.find(item => item.text === 'Övningar').h < 442,
  'the exercise action stays above the clock footer');
  controls.find(item => item.text === 'SET KLART').click();
  assert.equal(completed, 1);
  assert.equal(synced, 1);
});

test('clean exercise list chooses directly, opens set details, and confirms finish', () => {
  const controls = [];
  let finishCount = 0;
  let submitCount = 0;
  const env = {
    MINIMAL_UI_BUILD: 'UI 17',
    THEME: { card: 1, primaryDark: 2, cardActive: 3, textPrimary: 4,
      textSecondary: 5, primaryLight: 6, textMuted: 7, bg: 0 },
    widget: { BUTTON: 1 }, px: x => x, font: () => 12, align: { LEFT: 0 },
    cleanText() {}, renderCleanHeader() {},
    cleanButton(text, x, y, w, h, click, primary, diagnosticAction) {
      controls.push({ text, click, diagnosticAction });
    },
    addWidget(_type, props) { controls.push(props); },
    workoutProgress: () => ({ completed: 1, total: 5 }),
    OVERVIEW_PAGE_SIZE: 3, SESSION_STATES: { REST: 'REST' },
    truncate: text => text, supersetColor: () => 7,
    selectedOverviewExerciseIndex: null, overviewPage: 0, overviewSetsPage: 0,
    isOverviewOpen: true, cleanFinishConfirmationRequested: false,
    scheduleRenderUI() {}, renderCleanExerciseSetsScreen() {}, cleanReviewSetId: null,
    workoutController: { selectExercise(index) { env.selected = index; }, finishWorkout() { finishCount += 1; } },
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
  controls.find(item => item.diagnosticAction === 'VIEW_EXERCISE_SETS').click();
  assert.equal(env.selectedOverviewExerciseIndex, 0);
  env.selectedOverviewExerciseIndex = null;
  controls.find(item => item.diagnosticAction === 'SELECT_EXERCISE').click_func();
  assert.equal(env.selected, 0);
  controls.find(item => item.text === 'Avsluta').click();
  assert.equal(env.cleanFinishConfirmationRequested, true);
  assert.equal(finishCount, 0);
  controls.length = 0;
  env.renderCleanFinishConfirmation();
  controls.find(item => item.text === 'Bekräfta').click();
  assert.equal(finishCount, 1);
  assert.equal(submitCount, 1);
});

test('correction screens change one field and offer the finer weight step', () => {
  const controls = [];
  const labels = [];
  const draft = { setId: 'set-1', weight: 80, reps: 8, unit: 'kg',
    step: 2.5, fineStep: false, exerciseName: 'Squat', setIndex: 1 };
  const env = {
    MINIMAL_UI_BUILD: 'UI 17',
    align: { CENTER_H: 1 },
    lastSetDraft: draft, cleanEditField: 'reps', lastSetEditError: null,
    THEME: { textSecondary: 1, error: 2, textMuted: 3, textPrimary: 4 },
    cleanText(text) { labels.push(text); },
    cleanButton(text, x, y, w, h, click) { controls.push({ text, click }); },
    scheduleRenderUI() {}, truncate: text => text,
    saveEditLastSet() {}, cancelEditLastSet() {}, undoEditedSet() {},
    workoutController: { canUndoCompletedSet: () => ({ allowed: true }) },
  };
  vm.createContext(env);
  vm.runInContext(extract('renderCleanFocusedEditScreen'), env);
  env.renderCleanFocusedEditScreen();
  controls.find(item => item.text === '+').click();
  assert.equal(draft.reps, 9);
  assert.equal(draft.weight, 80);
  assert.ok(labels.includes('ÄNDRA REPS'));
  controls.length = 0;
  labels.length = 0;
  env.cleanEditField = 'weight';
  env.renderCleanFocusedEditScreen();
  controls.find(item => item.text === '+').click();
  assert.equal(draft.weight, 82.5);
  controls.find(item => item.text === 'Finjustera').click();
  controls.length = 0;
  env.renderCleanFocusedEditScreen();
  controls.find(item => item.text === '+').click();
  assert.equal(draft.weight, 83.75);
  assert.equal(draft.reps, 9);
  assert.ok(controls.some(item => item.text === 'Ångra set'));
});
