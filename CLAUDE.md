# Weekly Tracker: notes for Claude

A weekly reward board: point-valued habit tiles placed on days, points banked and spent on treats.
Its owner uses it daily on an iPhone (installed to the Home Screen) and other devices.

## How the owner works

- **Mockups first** for anything visual or behavioural: show 2 to 4 options side by side as images,
  say which you recommend and why, then build the one they pick.
- After a change: run the tests, take a screenshot, commit and push to the working branch, rebuild
  and republish the claude.ai artifact, then summarise. **Do not touch `main` until they say
  "ship it"** (then fast-forward `main` to the branch; see the `ship` skill). If they say to
  "unship" something, fix it and push to `main` straight away.
- Preferences: no em dashes anywhere (chat, code comments, commit messages, UI text); be
  accurate and say "I cannot confirm this" rather than guess; challenge their ideas fairly; cite
  sources for factual claims; ask clarifying questions before big changes; keep UI text short.
- Nothing here runs on their phone. Performance and feel on an iPhone can't be confirmed from the
  cloud container: say so. (Animated bubbles had to be removed for being too slow on the iPhone.)

## Files

| Path | What |
|---|---|
| `index.html` | The whole app (HTML, CSS, JS in one file, ~2,200 lines) |
| `sw.js` | Service worker. **Bump `CACHE` (`tile-week-vNN`) on every release** so installed apps update |
| `artifact/tile-week.html` | claude.ai artifact copy. **Rebuild with `python3 tools/build_artifact.py`** after any change |
| `supabase.js` | Vendored supabase-js 2.117.2 |
| `supabase/schema.sql` | Tables `libraries` and `placements`, keep-newer trigger, row-level security |
| `tests/` | Playwright tests (`node tests/run.js`) and `tests/shot.js` for screenshots. See `tests/README.md` |

Hosting: Render serves the repo as a static site and deploys `main` automatically. The artifact
lives at https://claude.ai/artifact/WXRG8A8PVnrWAmq6YiYKib (republish the rebuilt file to that URL).

## How the app works

- **Library** (`lib`, synced as one row): tiles, rewards (treats), settings (`weekStart`, `limit`,
  `dayTarget`, `dayMax`, `sort`, `look`, `foldPast`, `rest`). Only fields listed in `body()` sync.
- **Placements** (`P`, one row each): `kind` is `'tile'` (earned) or `'buy'` (spent). The database
  only allows those two kinds, and older app versions treat anything else as earned, so new kinds of
  records must be stored as one of them. Delays are `'buy'` records with ids starting `dlyf-` (free)
  or `dly-` (paid).
- Balance = tile points minus buy points; it never goes below zero (removing spent points is blocked).
- **Targets**: a tile can have `every` N days. Due when N counted days pass since it was last done
  (or since `since`, the day the target started, if never done). Late tiles earn 25% less per day
  late, floor 25%, decided when placed. Rest days (`lib.rest`) and delayed days don't count.
- **Goal bar**: the most expensive treat you can't afford yet; shows "N to go!", milestones at
  25/50/75%, and a "sets back" line on purchases that cost 10% or more of progress.
- **Looks** (`html[data-look]`): `xp` (default; its rules use a long `:not(...)` selector chain),
  `classic`, `y2k` ("Y2K pastel"), `cobalt`, plus `plain` for the sign-in screen on a new device.
  Old saved looks `brown` and `riviera` map to `cobalt` via `lookId()`.

## Testing

- `node tests/run.js` runs everything (about 2 minutes). Tests use a fixed date (Wed 21 Oct 2026)
  and a mock Supabase, so they never touch real data. Add tests for new behaviour in
  `tests/local.test.js` or `tests/cloud.test.js`.
- To check a test really guards something, break the app on purpose, see it fail, then
  `git checkout index.html`.
- Screenshots: `node tests/shot.js <look> <out.png> [width]`. Put images in the scratchpad, not the repo.
- Google Fonts are blocked in tests, so screenshots use fallback fonts.

## Commits

End commit messages with the attribution lines the session provides. Never put a model name in
commits, code or the app.
