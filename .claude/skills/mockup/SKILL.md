---
name: mockup
description: Make side-by-side mockup images of Weekly Tracker design options, or screenshots of a change. Use whenever the owner asks for a new look, colour, layout or UI change, or asks to see options, before building anything.
---

# Mockups and screenshots

The owner chooses designs from images, so show options before building.

## A screenshot of the app as it is

`node tests/shot.js <look> <out.png> [width]` with `look` one of `xp`, `classic`, `y2k`, `cobalt`.
It uses a sample board on the tests' fixed date. Save images in the scratchpad, not the repo.

## Options before building

1. Write a small script in the scratchpad that `require`s `tests/lib.js` (for `serve`, `browser`,
   `newPage`, `openLocal`, `lib`, `place`, `setLook`) and, for each option, opens the app, applies the
   option as injected CSS (`page.addStyleTag`) or DOM changes (`page.evaluate`), and takes a
   screenshot. Base the sample board on the owner's real setup when known.
2. Combine the shots side by side with Python Pillow, a label above each (for example
   "A: cool rose"), and halve the size so the image stays readable.
3. Send the image, describe each option in a line, say which you recommend and why, and point out
   honest trade-offs (readability, contrast, performance). Check text contrast (WCAG 4.5:1 for
   text) for any colour change and quote the numbers.
4. Only build the option the owner picks; then follow the `ship` skill's pre-ship steps.

## Things to know

- Animations: hold them still for screenshots (`animation:none`); for motion, capture frames and
  make a GIF. Never assume an effect is smooth on an iPhone: say it can't be confirmed here.
- Fonts are blocked in tests, so screenshots use fallback fonts; mention it if typography matters.
- Hide the toast (`#toast{display:none}`) unless it's part of what you're showing.
