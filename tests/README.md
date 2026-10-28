# Tests

Browser tests for the app, run with [Playwright](https://playwright.dev) in headless Chromium.
They don't touch the real Supabase project.

- `local.test.js`: the board in "this device only" mode. Points, treats, History, targets and
  late tiles, delays, Rest mode, the goal bar, week start, minimising days, and the looks.
- `cloud.test.js`: accounts and sync across simulated devices. Sign-up and confirmation, signing in,
  edits and removals reaching other devices, offline edits, purchases, settings, signing out.
  Supabase is replaced by `mock-supabase.js` and an in-memory database that keeps the real
  database's rules (newest edit wins, rows are private to each person, no empty columns).

Every test runs on a fixed date, Wednesday 21 October 2026, so results don't depend on the day of
the week.

## Running

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/run.js                # everything; exits 1 if any step fails
node tests/local.test.js         # or one file
node tests/shot.js y2k shot.png  # a screenshot of a look, for checking designs
```

If Playwright is installed somewhere else, point to it with `PLAYWRIGHT_PATH=/path/to/playwright`,
and to a Chromium binary with `CHROMIUM_PATH`.
