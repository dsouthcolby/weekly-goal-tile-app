// Board, points, treats, targets, delays, Rest mode, the goal bar and the looks, in local mode.
// Each test starts a fresh page on the fixed date (Wed 21 Oct 2026; week Sat 17 – Fri 23).
const assert = require('assert');
const { TODAY, TODAY_IDX, WEEK, weekOf, iso, addDays, serve, browser, newPage, openLocal, place, buy, lib, balance, addTile, setLook, runner } = require('./lib');

const T = {
  pilates: { id: 'pil', name: 'Pilates', points: 20, color: 0 },
  walk: { id: 'walk', name: 'Walk', points: 10, color: 1 },
  ten: { id: 'ten', name: 'Ten', points: 10, color: 2 },
  physio: { id: 'phy', name: 'Physio', points: 15, color: 3, every: 2 },
  stretch: { id: 'str', name: 'Stretch', points: 5, color: 4, every: 3 },
};
const R = { coffee: { id: 'r-cof', name: 'Coffee', points: 20 }, fun: { id: 'r-fun', name: 'Fun', points: 200 } };
const board = (libOver, places = []) => ({ lib: lib(libOver), places: Object.fromEntries(places) });
const dueText = p => p.$eval('#dueline', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
const libNow = p => p.evaluate(() => JSON.parse(localStorage.getItem('tw2:lib')));
const placesNow = p => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('tw2:places'))));

module.exports = async function run() {
  const { server, base } = await serve();
  const b = await browser();
  const r = runner('Local mode');
  const fresh = async (bd, opts) => { const p = await newPage(b, opts); await openLocal(p, base, bd); return p; };
  const noErrors = p => assert.deepStrictEqual(p.errors, [], 'page errors');

  await r.step('placing a tile adds its points and says so', async () => {
    const p = await fresh(board({ tiles: [T.pilates] }));
    assert.strictEqual(await balance(p), 0);
    assert.match(await addTile(p, 'Pilates', TODAY_IDX), /\+20/);
    assert.strictEqual(await balance(p), 20);
    assert.strictEqual(await p.locator(`.day[data-day="${TODAY_IDX}"] .chip`).count(), 1);
    noErrors(p);
  });

  await r.step('the balance carries over from earlier weeks, and History lists each week', async () => {
    const p = await fresh(board({ tiles: [T.pilates, T.walk] }, [place(T.pilates, weekOf(-1), 1), place(T.walk, WEEK, 0)]));
    assert.strictEqual(await balance(p), 30);
    await p.click('#histBtn');
    assert.strictEqual(await p.locator('#histList .h').count(), 2);
    noErrors(p);
  });

  await r.step('buying a treat asks first, takes the points, and can be undone in History', async () => {
    const p = await fresh(board({ tiles: [T.pilates], rewards: [R.coffee, R.fun] }, [place(T.pilates, WEEK, 0), place(T.pilates, WEEK, 1)]));
    await p.click('#rewards [data-buy="r-cof"]');
    assert.match(await p.textContent('#buyText'), /costs 20 pts/);
    await p.click('#buyOk'); await p.waitForTimeout(150);
    assert.strictEqual(await balance(p), 20);
    await p.click('#histBtn');
    assert.match(await p.textContent('#histList'), /Coffee · −20 pts/);
    await p.click('#histList [data-undo]'); await p.waitForTimeout(150);
    assert.strictEqual(await balance(p), 40);
    noErrors(p);
  });

  await r.step('the balance never goes below zero: spent points can’t be removed', async () => {
    const p = await fresh(board({ tiles: [T.pilates], rewards: [R.coffee] }, [place(T.pilates, WEEK, 0, { id: 'only' }), buy(R.coffee, WEEK, 1)]));
    assert.strictEqual(await balance(p), 0);
    await p.click('.chip[data-item="only"]'); await p.click('.chip[data-item="only"] [data-remove]'); await p.waitForTimeout(150);
    assert.match(await p.textContent('#toast'), /already spent/);
    assert.strictEqual(await p.locator('.chip[data-item="only"]').count(), 1);
    noErrors(p);
  });

  await r.step('a tile with a target is flagged due, then late, and a late tile earns less', async () => {
    // Physio every 2 days, last done Sun 18: 3 days ago, so 1 day late and worth 75% (11 of 15).
    // Stretch every 3 days, last done Sun 18: due today.
    const p = await fresh(board({ tiles: [T.physio, T.stretch] }, [place(T.physio, WEEK, 1), place(T.stretch, WEEK, 1)]));
    const due = await dueText(p);
    assert.match(due, /1d late\s*Physio\s*11 of 15 pts/);
    assert.match(due, /Due\s*Stretch\s*5 pts/);
    assert.strictEqual(await p.textContent('.tile[data-tile="phy"] .due'), '1d late');
    assert.match(await p.textContent('.tile[data-tile="phy"] .tp'), /^1511/);
    assert.match(await addTile(p, 'Physio', TODAY_IDX), /Physio, late: 11 of 15 pts/);
    const placed = (await placesNow(p)).filter(x => x.tileId === 'phy').sort((a, c) => a.day - c.day);
    assert.strictEqual(placed[placed.length - 1].points, 11);
    noErrors(p);
  });

  await r.step('delays: the first each week is free, then half the tile’s points', async () => {
    const p = await fresh(board({ tiles: [T.pilates, T.physio, T.stretch] }, [place(T.pilates, WEEK, 0), place(T.physio, WEEK, 1), place(T.stretch, WEEK, 1)]));
    assert.strictEqual(await balance(p), 40);
    assert.match(await dueText(p), /1 free delay left/);
    await p.click('#dueline .dl-row:has-text("Physio") [data-delay]');
    assert.strictEqual(await p.textContent('#delayOk'), 'Delay free');
    await p.click('#delayOk'); await p.waitForTimeout(150);
    assert.strictEqual(await balance(p), 40);
    // Today no longer counts for Physio: it's due rather than late, and marked Delayed.
    assert.match(await dueText(p), /Due\s*Physio\s*15 pts\s*Delayed/);
    assert.match(await dueText(p), /Free delay used/);
    await p.click('#dueline .dl-row:has-text("Stretch") [data-delay]');
    assert.strictEqual(await p.textContent('#delayOk'), 'Delay · 3 pts');
    await p.click('#delayOk'); await p.waitForTimeout(150);
    assert.strictEqual(await balance(p), 37);
    assert.doesNotMatch(await dueText(p), /Stretch/, 'no longer due today');
    await p.click('#histBtn');
    const h = await p.textContent('#histList');
    assert.match(h, /Delay: Physio · free delay/); assert.match(h, /Delay: Stretch · −3 pts/); assert.match(h, /2 delays/);
    noErrors(p);
  });

  await r.step('a delay you can’t afford is greyed out', async () => {
    const used = ['dlyf-x', { id: 'dlyf-x', kind: 'buy', week: WEEK, day: 0, tileId: 'other', name: 'Delay: Other', points: 0, color: 0, deleted: false, createdAt: 1, updatedAt: 1 }];
    const p = await fresh(board({ tiles: [T.physio] }, [place(T.physio, WEEK, 1), buy({ id: 'old', name: 'Old', points: 12 }, WEEK, 1), used]));
    assert.strictEqual(await balance(p), 3);
    await p.click('#dueline [data-delay]');
    assert.strictEqual(await p.textContent('#delayOk'), 'Delay · 8 pts');
    assert.ok(await p.isDisabled('#delayOk'));
    noErrors(p);
  });

  await r.step('a tile never done counts from when its target started, and new tiles record that day', async () => {
    const tiles = [
      { id: 'old', name: 'Old weekly', points: 20, color: 1, every: 7, since: iso(addDays(TODAY, -10)) },   // 3 days late: 5 of 20
      { id: 'mid', name: 'Mid weekly', points: 20, color: 1, every: 7, since: iso(addDays(TODAY, -3)) },    // due
      { id: 'leg', name: 'Legacy weekly', points: 20, color: 1, every: 7 },                                // no date: due
    ];
    const p = await fresh(board({ tiles }));
    const due = await dueText(p);
    assert.match(due, /3d late\s*Old weekly\s*5 of 20 pts/);
    assert.match(due, /Due\s*Mid weekly\s*20 pts/);
    assert.match(due, /Due\s*Legacy weekly\s*20 pts/);
    await p.click('.tile.add'); await p.fill('#tName', 'Brand new'); await p.fill('#tPts', '5'); await p.fill('#tEvery', '7');
    await p.click('#tileForm button[type=submit]'); await p.waitForTimeout(150);
    assert.strictEqual((await libNow(p)).tiles.find(t => t.name === 'Brand new').since, iso(TODAY));
    noErrors(p);
  });

  await r.step('Rest mode pauses due dates, and feeling better the same day leaves no rest days', async () => {
    const p = await fresh(board({ tiles: [T.physio] }, [place(T.physio, WEEK, 1)]));
    await p.click('#setBtn'); await p.click('#sRest'); await p.click('#setDone'); await p.waitForTimeout(150);
    assert.ok(await p.isVisible('#restChip'));
    assert.match(await dueText(p), /Resting since today/);
    assert.strictEqual(await p.locator('.tile .due').count(), 0);
    await p.click('#dueline [data-rest="off"]'); await p.waitForTimeout(150);
    assert.deepStrictEqual((await libNow(p)).rest, []);
    assert.ok(!(await p.isVisible('#restChip')));
    noErrors(p);
  });

  await r.step('past rest days don’t count toward late, and show in History', async () => {
    // Physio every 2, done Sun 18; rested Mon 19 – Tue 20, so only today counts: not due yet.
    const p = await fresh(board({ tiles: [T.physio], rest: [{ from: iso(addDays(TODAY, -2)), to: iso(addDays(TODAY, -1)) }] }, [place(T.physio, WEEK, 1)]));
    assert.doesNotMatch(await dueText(p), /Physio/);
    await p.click('#histBtn');
    assert.match(await p.textContent('#histList'), /Rested 2 days, Monday to Tuesday/);
    noErrors(p);
  });

  // Four earlier weeks of 110 pts each, with enough spent to leave 95: the goal is Fun (200).
  const history = () => [1, 2, 3, 4].map(w => place({ id: 'past', name: 'Past', points: 110 }, weekOf(-w), 1)).concat([buy({ id: 'old', name: 'Old', points: 345 }, weekOf(-1), 2)]);

  await r.step('the goal bar follows the most expensive treat, with a countdown', async () => {
    const p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, R.fun] }, history()));
    assert.strictEqual(await balance(p), 95);
    assert.strictEqual(await p.textContent('#goalName'), 'Fun');
    assert.strictEqual(await p.textContent('#goalTo'), '105 to go!');
    assert.match(await p.getAttribute('#goalFill', 'style'), /47%/);
    assert.deepStrictEqual(await p.$$eval('#rewards [data-buy]', x => x.map(e => e.dataset.buy)), ['r-cof']);
    noErrors(p);
  });

  await r.step('earning says how far the goal moved, and celebrates milestones', async () => {
    const p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, R.fun] }, history()));
    assert.strictEqual(await addTile(p, 'Ten', TODAY_IDX), 'Halfway to Fun!');
    assert.match(await p.getAttribute('#goal', 'class'), /\bpop\b/);
    assert.strictEqual(await addTile(p, 'Ten', TODAY_IDX), '+10 · Fun 57% · about 1 week');
    noErrors(p);
  });

  await r.step('buying a small treat says when it sets the goal back', async () => {
    const p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, R.fun] }, history().concat([place(T.ten, WEEK, 0), place(T.ten, WEEK, 1)])));
    assert.strictEqual(await balance(p), 115);
    await p.click('#rewards [data-buy="r-cof"]');
    assert.match(await p.textContent('#buyText'), /Sets Fun back from 57% to 47%\./);
    noErrors(p);
  });

  await r.step('a single treat gets the bar too; an affordable top treat is a normal button', async () => {
    let p = await fresh(board({ tiles: [T.ten], rewards: [{ id: 'solo', name: 'Solo', points: 500 }] }));
    assert.strictEqual(await p.textContent('#goalName'), 'Solo');
    assert.strictEqual(await p.locator('#rewards [data-buy]').count(), 0);
    p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, { id: 'big', name: 'Big', points: 50 }] }, history()));
    assert.ok(await p.isHidden('#goal'));
    assert.match(await p.getAttribute('#rewards [data-buy="big"]', 'class'), /\bready\b/);
    noErrors(p);
  });

  await r.step('without history the earn message leaves out the pace', async () => {
    const p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, R.fun] }));
    assert.match(await addTile(p, 'Ten', TODAY_IDX), /^\+10 · Fun 5%$/);
    noErrors(p);
  });

  await r.step('minimising the treat bank hides the goal bar too', async () => {
    const p = await fresh(board({ tiles: [T.ten], rewards: [R.coffee, R.fun], look: 'classic' }));
    assert.ok(!(await p.isHidden('#goal')));
    await p.click('#bankMin'); await p.waitForTimeout(150);
    assert.ok(await p.isHidden('#goal'));
    noErrors(p);
  });

  await r.step('today always looks like a filled day; empty past days are faded', async () => {
    const p = await fresh(board({ tiles: [T.pilates] }));
    assert.doesNotMatch(await p.getAttribute('.day.today', 'class'), /\bblank\b/);
    assert.match(await p.getAttribute('.day[data-day="1"]', 'class'), /\bblank\b/);
    noErrors(p);
  });

  await r.step('changing the week start refiles tiles by their date, and back again', async () => {
    const p = await fresh(board({ tiles: [T.pilates] }, [place(T.pilates, WEEK, 1, { id: 'sun' })]));   // Sun 18
    assert.strictEqual(await p.getAttribute('.chip[data-item="sun"]', 'data-item'), 'sun');
    assert.strictEqual(await p.$eval('.chip[data-item="sun"]', c => c.closest('.day').dataset.day), '1');
    await p.click('#setBtn'); await p.selectOption('#sStart', '0'); await p.click('#setDone'); await p.waitForTimeout(150);
    assert.strictEqual(await p.$eval('.chip[data-item="sun"]', c => c.closest('.day').dataset.day), '0', 'Sunday is day 0 of a Sunday week');
    await p.click('#setBtn'); await p.selectOption('#sStart', '6'); await p.click('#setDone'); await p.waitForTimeout(150);
    assert.strictEqual(await p.$eval('.chip[data-item="sun"]', c => c.closest('.day').dataset.day), '1');
    noErrors(p);
  });

  await r.step('past days this week can be minimised, and one can be opened again', async () => {
    const p = await fresh(board({ tiles: [T.pilates] }, [place(T.pilates, WEEK, 0)]));
    await p.click('#setBtn'); await p.click('#sFold'); await p.click('#setDone'); await p.waitForTimeout(150);
    const mins = await p.$$eval('.day', ds => ds.filter(d => d.classList.contains('day-min')).map(d => d.dataset.day));
    assert.deepStrictEqual(mins, ['0', '1', '2', '3']);
    await p.click('.day[data-day="0"] [data-fold]'); await p.waitForTimeout(100);
    assert.doesNotMatch(await p.getAttribute('.day[data-day="0"]', 'class'), /day-min/);
    noErrors(p);
  });

  await r.step('looks: each applies, bubbles only in Y2K, and old Simple brown/Riviera boards become Cobalt', async () => {
    const p = await fresh(board({ tiles: [T.pilates] }));
    for (const k of ['classic', 'y2k', 'cobalt', 'xp']) {
      await setLook(p, k);
      assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.look), k);
      assert.strictEqual(await p.isVisible('.bubbles'), k === 'y2k', `bubbles in ${k}`);
    }
    for (const old of ['brown', 'riviera']) {
      const q = await fresh(board({ tiles: [T.pilates], look: old }));
      assert.strictEqual(await q.evaluate(() => document.documentElement.dataset.look), 'cobalt', old);
    }
    noErrors(p);
  });

  await b.close(); server.close();
  return r.report();
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
