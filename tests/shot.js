// Takes a screenshot of the app in a given look, for checking designs by eye.
//   node tests/shot.js <look> <out.png> [width]     looks: xp, classic, y2k, cobalt
// Uses a small sample board on the tests' fixed date. Bubbles are held still so shots are repeatable.
const { TODAY_IDX, WEEK, weekOf, serve, browser, newPage, openLocal, place, lib, setLook } = require('./lib');

(async () => {
  const [look = 'xp', out = 'shot.png', width = '390'] = process.argv.slice(2);
  const tiles = [
    { id: 'pil', name: 'Pilates', points: 20, color: 0 }, { id: 'walk', name: '1 hour walk', points: 10, color: 1 },
    { id: 'bed', name: 'No phone in bed', points: 5, color: 2 }, { id: 'phy', name: 'Physio', points: 15, color: 3, every: 2 },
    { id: 'read', name: 'Read 20 pages', points: 5, color: 4 }, { id: 'prep', name: 'Meal prep', points: 10, color: 5 },
  ];
  const places = [place(tiles[0], WEEK, 0), place(tiles[2], WEEK, 0), place(tiles[1], WEEK, 1), place(tiles[3], WEEK, 1), place(tiles[0], weekOf(-1), 2)];
  const { server, base } = await serve();
  const b = await browser();
  const p = await newPage(b, { width: Number(width) });
  await openLocal(p, base, { lib: lib({ tiles, rewards: [{ id: 'r1', name: 'Face mask', points: 30 }, { id: 'r2', name: 'Fancy pastry', points: 60 }, { id: 'r3', name: 'Online shop', points: 100 }] }), places: Object.fromEntries(places) });
  await setLook(p, look);
  await p.addStyleTag({ content: '.bub{top:calc(var(--y) * 1%)!important;animation:none!important}.bub *,.bub *::before{animation:none!important}#toast{display:none!important}' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  console.log(`${out} (${look}, ${width}px, today is day ${TODAY_IDX})`);
  await b.close(); server.close();
})();
