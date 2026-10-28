// Shared helpers for the browser tests: a tiny static server for the repo, a browser with a fixed
// date, ways to seed a board, and a step runner that reports PASS/FAIL without stopping the run.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

// Tests run on a fixed date so they don't depend on the weekday. Wednesday 21 Oct 2026, midday local time.
// With the default Saturday week start, the week is Sat 17 – Fri 23 Oct and today is day 4.
const TODAY = new Date(2026, 9, 21, 12, 0, 0);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const WEEK = iso(addDays(TODAY, -4));          // '2026-10-17', a Saturday
const TODAY_IDX = 4;
const weekOf = (n) => iso(addDays(TODAY, -4 + 7 * n));   // n weeks from this week (negative = earlier)

// The app with its Supabase keys blanked, so it runs as "this device only".
const localHtml = () => fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/^const SUPABASE_URL = .*$/m, "const SUPABASE_URL = '';")
  .replace(/^const SUPABASE_KEY = .*$/m, "const SUPABASE_KEY = '';");

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

async function browser() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

// A fresh phone-sized page with the fixed date. Google Fonts are blocked so tests work offline.
async function newPage(b, { width = 390, height = 844, offline = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.clock.setFixedTime(TODAY);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  if (offline) await ctx.setOffline(true);
  return page;
}

// Open the app in local mode with an optional board: { lib, places } written to storage before it loads.
async function openLocal(page, base, board) {
  await page.route(base + 'local.html', r => r.fulfill({ contentType: 'text/html', body: localHtml() }));
  if (board) await page.addInitScript(b => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('tw2:lib', JSON.stringify(b.lib));
    localStorage.setItem('tw2:places', JSON.stringify(b.places || {}));
    localStorage.setItem('tw2:legacyDone', '1');
    if (b.look) localStorage.setItem('tw2:look', JSON.stringify(b.look));
  }, board);
  await page.goto(base + 'local.html');
  await page.waitForSelector('.day');
}

// Board-building helpers. Places are keyed by id like the app stores them.
let n = 0;
const place = (tile, week, day, extra = {}) => {
  const id = extra.id || 'p' + (++n);
  return [id, { id, kind: 'tile', week, day, tileId: tile.id, name: tile.name, points: tile.points, color: tile.color | 0, deleted: false, createdAt: n, updatedAt: n, ...extra }];
};
const buy = (reward, week, day, extra = {}) => {
  const id = extra.id || 'b' + (++n);
  return [id, { id, kind: 'buy', week, day, tileId: reward.id, name: reward.name, points: reward.points, color: 0, deleted: false, createdAt: n, updatedAt: n, ...extra }];
};
const lib = (over = {}) => ({ weekStart: 6, limit: 0, dayTarget: 0, dayMax: 0, sort: 'added', look: 'xp', foldPast: false, updatedAt: 1,
  tiles: [], rewards: [], ...over });

// Page actions.
const balance = async p => Number((await p.textContent('#pts')).replace(/\D/g, ''));
async function addTile(p, name, day) {
  const t = p.locator(`.tile[data-tile]:has-text("${name}")`).first();
  if (!/\bselected\b/.test(await t.getAttribute('class'))) await t.click();
  await p.click(`.day[data-day="${day}"]`);
  await p.waitForTimeout(150);
  return p.textContent('#toast');
}
async function setLook(p, look) { await p.click('#setBtn'); await p.click(`.look-opt[data-look="${look}"]`); await p.click('#setDone'); await p.waitForTimeout(200); }

// Steps: run in order, record PASS/FAIL, keep going after a failure.
function runner(title) {
  const results = [];
  return {
    async step(name, fn) {
      try { await fn(); results.push(['PASS', name]); }
      catch (e) { results.push(['FAIL', name, String(e && e.message || e).split('\n').slice(0, 4).join(' | ')]); }
    },
    report() {
      console.log(`\n${title}`);
      for (const [s, name, why] of results) console.log(`  ${s} ${name}${why ? '\n       ' + why : ''}`);
      const failed = results.filter(r => r[0] === 'FAIL').length;
      console.log(`  ${results.length - failed} passed, ${failed} failed`);
      return failed;
    },
  };
}

module.exports = { ROOT, TODAY, TODAY_IDX, WEEK, weekOf, iso, addDays, serve, browser, newPage, openLocal, localHtml, place, buy, lib, balance, addTile, setLook, runner };
