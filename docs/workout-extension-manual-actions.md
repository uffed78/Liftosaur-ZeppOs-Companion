# Workout Extension Manual Actions

This guide lists external actions that require human intervention in the Zepp Developer Console, on a mobile device, or on physical watch hardware.

---

## 1. Use the Registered App IDs

- **Lifto Companion**: `1123411`
- **Lifto Workout Extension**: `1125789`

These IDs belong to this project and are already registered. For another fork, register the app with your own Zepp Developer account and use only an ID assigned to that app; do not copy an upstream project's ID. The Companion ID is in the root `app.json`. The Workout Extension ID is supplied to its generator/build through `ZEPP_WORKOUT_EXTENSION_APP_ID`.

Set the Workout App ID locally before its build or preview:
   ```bash
   export ZEPP_WORKOUT_EXTENSION_APP_ID=1125789
   ```
Or in PowerShell:
   ```powershell
   $env:ZEPP_WORKOUT_EXTENSION_APP_ID = "1125789"
   ```

> **Important**: A synthetic or mock App ID (such as `999999`) is valid only for offline compilation and CI invariant checks. Only a real App ID registered in the Zepp Developer Console can produce a server-accepted, installable preview package or a Store submission.

---

## 2. Install and authenticate Zeus

Install Node.js and npm, then install the official Zeus CLI globally and sign in to the Zepp Open Platform account that owns the registered app:

```bash
npm install --global @zeppos/zeus-cli
zeus login
zeus status
```

`zeus login` opens the interactive account sign-in. `zeus status` confirms the CLI session. The first command is documented by the [official Zeus CLI guide](https://github.com/zepp-health/zeppos-docs/blob/main/docs/guides/tools/cli/index.md) and the [`@zeppos/zeus-cli` package](https://www.npmjs.com/package/@zeppos/zeus-cli).

---

## 3. Build packages and generate preview QR codes

From the repository root, install project dependencies and run the repository's build/preview wrappers. The wrappers call `zeus build` for package builds. Preview wrappers call `zeus preview -s -t "<supported device list>"` and save the returned QR as a PNG under `build/`.

```bash
npm ci

# Build standalone Companion package (Mini Program)
npm run build:companion

# Build Lifto Workout extension (requires real App ID)
ZEPP_WORKOUT_EXTENSION_APP_ID=1125789 npm run build:workout

# Build both product packages
ZEPP_WORKOUT_EXTENSION_APP_ID=1125789 npm run build:all

# Generate Lifto Companion preview QR (root project)
npm run preview:companion

# Generate Lifto Workout preview QR (requires real App ID)
ZEPP_WORKOUT_EXTENSION_APP_ID=1125789 npm run preview:workout
```

In PowerShell, set the Workout ID once for the current shell:

```powershell
$env:ZEPP_WORKOUT_EXTENSION_APP_ID = '1125789'
npm run build:workout
npm run preview:workout
```

Outputs are `build/lifto-companion-qr.png` and `build/lifto-workout-qr.png`. Each preview requires a valid Zeus login and the real registered Workout ID. Do not commit or share stale QR files; preview links expire.

### Preview QR Expiry (~7 Days)

- Both `npm run preview:*` commands upload the generated `.zab` package to Zepp servers via `zeus preview`.
- The returned install QR code is valid for **about 7 days**.
- Zepp deletes preview packages after 7 days; there is no renewal mechanism. A fresh preview QR must be generated when expired.

---

## 4. Install on Physical Watch in Developer Mode

1. Enable Developer Mode in the Zepp mobile app:
   - Navigate to **Profile > Settings > About**.
   - Tap the Zepp icon or version 7 times until Developer Mode is unlocked.
2. In the Zepp mobile app, navigate to **Profile > your paired watch > Developer Mode**.
3. Tap **+ > Scan** and scan the preview QR for the product being tested.
4. Confirm installation of `Lifto Workout` to the connected watch.

---

## 5. Configure Extension Phone Settings

1. In the Zepp mobile app, go to **Profile > your paired watch > Developer Mode** (or App Management).
2. Select **Lifto Workout** and open **Settings**.
3. Enter your Liftosaur API key (`lftsk_*`).

> **Note**: Lifto Companion and Lifto Workout are distinct App IDs with independent `settingsStorage`. API keys do not transfer automatically and must be entered separately in each app's settings.

---

## 6. Enable Lifto in a Native Workout on Watch

Data page setup differs between watch hardware and Zepp OS versions:

### Amazfit Active 2 (firmware 7.23.0.1)

1. On the watch, launch the system **Workout** application.
2. Select **Strength Training**.
3. Open **Settings** > **More** > **Data Page** > **Add Page**.
4. Select **Lifto**.

Repeat the same path after selecting **Free Training**. This path is ASSUMED until it is confirmed on physical Active 2 hardware.

### Amazfit Active 3 Premium (Zepp OS 6, firmware 6.3.13.5)

*Installation evidence: `TESTED (tester report)`, not full compatibility certification.*

1. On the watch, open **Workout Settings**.
2. Select **Data page**.
3. Scroll to the bottom and select **Add page**.
4. Select **App/Workout Data**.
5. Tick **Lifto**.

---

## 7. Balance 2 smoke test (pending)

Balance 2 is included in generated preview targets but **has not been physically tested; this is not a compatibility claim**. Before testing, record the exact watch model, firmware, Zepp OS version, Zepp app version, Lifto commit, and preview generation time. Test both products with their own QR:

1. Install Lifto Companion and Lifto Workout from Developer Mode; confirm both launch/install without an error.
2. In Companion, check round-screen layout and touch targets; select an exercise directly, inspect all sets, edit a completed set, and undo only when the latest-set action is offered.
3. Enter a new set using normal and fine weight steps; verify the value changes and remains readable, along with reps +/-1.
4. Check that direct exercise selection preserves the displayed program order and superset pairing. Tap controls rather than relying on swipe or crown input.
5. In Workout, start a native Strength Training session, add the Lifto data page, and verify its screens and touch controls do not hide native workout controls or accidentally finish the activity.
6. Complete sets, use the rest timer and pause/resume, then confirm the completion appears in Liftosaur. If safe test credentials and connectivity are available, also test offline queue recovery and re-completion of an undone set.
7. Repeat the page installation and core set/rest flow in Free Training only if that workout type is exposed on the tested firmware; record unavailable paths as blocked, not passed.
8. Capture results and any screenshots/log references without API keys or bearer tokens. Keep all rows `pending` until physically run, and report the precise model/firmware rather than generalizing to other Balance models.

---

## 8. Execute Physical Hardware Test Plan

1. Follow the test cases in [docs/workout-extension-hardware-test-plan.md](workout-extension-hardware-test-plan.md).
2. Record watch model, firmware version, Zepp OS version, commit hash, date, result (`pending` / `BLOCKED`), and telemetry.
3. Capture debug logs via Zeus CLI or Zepp Developer tools where accessible.
4. Redact all API keys, bearer tokens, and private data before saving log artifacts.

---

## 9. Store Submission (Release Gate)

Once hardware validation passes:
1. Generate the final release build (`npm run build:workout`).
2. In Zepp Developer Console, upload the `.zab` package from `build/workout-extension/dist/`.
3. Provide store listing metadata, screenshots, icon, and link to privacy policy ([docs/privacy-policy.md](privacy-policy.md)).
4. Submit for Zepp App Store review.
