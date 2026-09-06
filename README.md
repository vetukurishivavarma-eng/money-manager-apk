# Money Tracker

Personal expense + budget tracker for **India / INR**, Android-only. It reads your
bank's transaction SMS **on the device** and turns each one into a transaction
(amount, merchant, date filled in automatically). You open a transaction later to
set its category / sub-category / notes. Everything is stored locally — no account,
no server, nothing leaves the phone.

## Features

- **Automatic capture** from bank SMS (UPI, card, NEFT/IMPS, ATM) — HDFC, ICICI,
  SBI, Axis, Kotak, and ~40 more via a generic parser. OTPs, promos, failed txns,
  EMI reminders are ignored.
- **Categorise later** — 16 categories, each with sub-categories; free-text notes.
  Auto-guesses the category from the merchant; "needs category" queue for the rest.
- **"Always categorise X as Y"** — one toggle turns a fix into a permanent rule.
- **Monthly budgets** — overall + per category, with a 3-month "Suggest" button.
- **Budget warnings** — a notification at 80%, when your *pace* will blow the
  budget, and when you cross it. Plus a large-payment alert.
- **Home-screen widget** — month spend vs budget, colour state, "safe to spend
  ₹x/day".
- **Insights** — 6-month trend, category & sub-category breakdown, subscriptions /
  recurring detection ("₹X/month locked in"), top merchants, biggest expense,
  which weekday you spend most.
- **Internal transfers** between your own accounts are auto-excluded.
- **CSV export**, **JSON backup & restore**, per-account on/off, erase-all.

## Build the APK

Prereqs: Node 20+, JDK 17, Android SDK (`ANDROID_HOME` set).

```bash
cd money-tracker
npm install
npx expo install --fix          # snap deps to the installed Expo SDK
npm test                         # sanity-check the SMS parser (25 checks)
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease        # gradlew.bat on Windows
```

APK: `android/app/build/outputs/apk/release/app-release.apk` — install it on your
phone (allow "install unknown apps").

Or with EAS (cloud build, needs a free Expo account):

```bash
npx eas-cli build -p android --profile preview
```

> This app **cannot** run in Expo Go — it uses native modules (SMS, widget). Use
> the APK or a dev build (`npx expo run:android`).

## First run

1. Grant the **SMS** permission — it scans ~6 months of history.
2. Allow **notifications** for budget alerts.
3. Set a monthly budget under the **Budget** tab.
4. Long-press the home screen → Widgets → *Money Tracker* to add the widget.
5. New payments show up automatically (on app open, and periodically in the
   background). Open the ones marked *needs category* and tag them.

## How it works / limitations

- SMS parsing catches ~95% of digital spending. **Cash** must be added manually
  (+ button on the Spending tab). A bank with an unusual SMS format may be missed
  — tell it apart in `src/sms/patterns.js` / `src/sms/parse.js` and re-scan.
- No direct GPay/PhonePe/Paytm API exists for individuals; SMS is the reliable
  route every Indian expense app uses.
- Background refresh cadence is decided by Android (typically 15–30 min+). Opening
  the app always syncs immediately.
- `npm test` runs `scripts/test-parser.mjs` against real-world SMS samples.
