---
name: ship
description: Release Weekly Tracker changes. Use when the owner says "ship it" (fast-forward main so Render deploys), and also for the pre-ship routine after any app change (cache bump, artifact rebuild, tests, push to the working branch, republish the artifact).
---

# Shipping Weekly Tracker

## After any change to the app (before "ship it")

1. Bump the service worker cache in `sw.js`: `tile-week-vNN` to the next number. Installed apps
   only pick up a new version when this changes.
2. Rebuild the artifact: `python3 tools/build_artifact.py`.
3. Run the tests: `node tests/run.js`. All steps must pass. If one fails, find out why before going
   on; if a failure turns out to be in the test, fix the test and say so.
4. Take a screenshot of the change (see the `mockup` skill) and look at it.
5. Commit with a message saying what changed and why, ending with the session's attribution lines.
   Push to the working branch (`git push -u origin <branch>`).
6. Republish `artifact/tile-week.html` to https://claude.ai/artifact/WXRG8A8PVnrWAmq6YiYKib.
7. Summarise for the owner: what changed, what was tested, anything unconfirmed (for example how it
   feels on an iPhone), and ask them to say "ship it" when happy.

## When the owner says "ship it"

1. `git status --short` must be clean (commit anything outstanding first, following the steps above).
2. `git fetch origin main` and check `git merge-base --is-ancestor origin/main HEAD` succeeds,
   so `main` can be fast-forwarded. If it can't, stop and explain; never force-push `main`.
3. `git push origin HEAD:main`, then `git fetch origin main` and confirm `origin/main` equals `HEAD`.
4. Tell the owner it's shipped, list what this release includes if it covers several changes, and
   remind them to close and reopen the app once or twice to load it. Say that the live deploy itself
   wasn't checked.

## "Unship"

If the owner says something live is broken or unwanted, fix or remove it, run the tests, and ship
straight to `main` without waiting for "ship it". Say that you did.
