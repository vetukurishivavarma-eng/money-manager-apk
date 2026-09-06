# Money Tracker

Personal expense + budget tracker for **India / INR**, Android-only. It reads your
bank's transaction SMS **on the device** and turns each one into a transaction
(amount, merchant, date filled in automatically). You open a transaction later to
set its category / sub-category / notes. Everything is stored locally — no account,
no server, nothing leaves the phone.

## Features

**Capture**
- Automatic capture from bank SMS (UPI, card, NEFT/IMPS, ATM) — ~40 banks + a
  generic parser. OTPs, promos, failed txns and EMI reminders are ignored.
- Internal transfers between your own accounts are auto-excluded.
- Refunds are matched to the original purchase and netted out.
- Bank balance is read from "Avl Bal" lines → a rough total across accounts.

**Categorise later**
- 16 categories, each with sub-categories; free-text notes.
- Auto-guesses the category; a "needs category" queue holds the rest.
- "Always categorise X as Y" turns one fix into a permanent rule.

**Stay in budget**
- Overall + per-category monthly budgets, 3-month "Suggest".
- **Payday cycles** — set the cycle to start on your salary date, not the 1st.
- **Rollover** — unspent category budget carries into next cycle (overspend is
  deducted).
- **"Safe to spend today"** — the one number, on the dashboard and a widget.
- **Left to allocate** — income minus the sum of category budgets.
- **Warnings** — notification at 80%, when your pace will blow the budget, when
  you cross it, and for any single large payment.
- **Weekly review** notification every Sunday.

**Home-screen widgets**
- *Budget* (4×2): spend vs budget, colour state, safe-to-spend.
- *Safe* (2×2): just today's number.

**Insights**
- 6-month trend, category & sub-category breakdown, subscription / recurring
  detection ("₹X/month locked in"), **Coming up** bill calendar, top merchants
  with month-over-month change, biggest expense, weekday pattern.

**Cash wallet** (optional) — ATM withdrawals move to a cash balance instead of
counting as spends; log cash spends as you make them.

**Savings goals** — targets with progress and a per-month savings figure.

**Data** — CSV export, monthly PDF report, JSON backup & restore, per-account
on/off, erase-all.

**Security**
- Optional biometric app lock (fingerprint / face).
- Screenshots and screen recording are blocked app-wide (balances stay out of the
  recents preview too).
- `allowBackup=false` — the database can't be pulled via `adb backup`.
- No `SYSTEM_ALERT_WINDOW` / `RECEIVE_SMS` — the app only reads the SMS inbox on
  a schedule, it has no overlay and no incoming-SMS receiver.
- All SQL is parameterised; the PDF export HTML-escapes every value; SMS bodies
  over 1600 chars are ignored (ReDoS guard); a restored backup is validated and
  never carries the lock state.
- The database is **not encrypted at rest** — it relies on the Android app
  sandbox + the optional lock. The `INTERNET` permission is present (required by
  React Native) but the app makes no network requests.

## Build the APK

Prereqs: Node 20+, JDK 17, Android SDK (`ANDROID_HOME` set).

```bash
cd money-tracker
npm install
npx expo install --fix          # snap deps to the installed Expo SDK
npm test                         # sanity-check the pure logic (30 checks)
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease        # gradlew.bat on Windows
```

APK: `android/app/build/outputs/apk/release/app-release.apk`.

> Can't run in Expo Go (native SMS / widget / biometric modules). Use the APK or
> `npx expo run:android`.
>
> On Windows the C++ step (`expo-modules-core`) can hit a transient Defender
> file-lock ("Permission denied" on a `.o.d`) — just re-run `gradlew
> assembleRelease`, it's incremental and clears on the next pass. Adding the
> project folder to Defender exclusions avoids it entirely.

## First run

1. Grant **SMS** — scans ~6 months of history.
2. Allow **notifications** for budget alerts.
3. **Budget** tab → set a monthly budget; optionally set the cycle start day and
   turn on rollover.
4. Long-press the home screen → Widgets → *Money Tracker*.
5. New payments appear automatically (on open + periodically). Tag the ones
   marked *needs category*.

## How it works / limitations

- SMS parsing catches ~95% of digital spending. Cash is manual (+ on the Spending
  tab). An unusual bank SMS format → add a pattern in `src/sms/patterns.js` and
  full-rescan from Settings.
- No direct GPay/PhonePe/Paytm API exists for individuals; SMS is the route every
  Indian expense app uses.
- Background refresh cadence is Android's call (15–30 min+). Opening the app
  always syncs.
- `npm test` runs `scripts/test-parser.mjs` — parser, categoriser, budget/rollover
  math, recurring detection, formatting.
