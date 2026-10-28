// Accounts and sync: several simulated devices against one in-memory stand-in for Supabase that
// keeps the real database's rules (newest edit wins, rows are private to each person, no nulls).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TODAY, TODAY_IDX, serve, browser, balance, addTile, setLook, runner } = require('./lib');

const MOCK = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');

function backend() {
  const db = { libraries: {}, placements: {} }, users = {}, tokens = {};
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const stamp = () => new Date(clock += 1000).toISOString();
  const pub = u => ({ id: u.id, email: u.email });
  let autoConfirm = false;
  function auth(q) {
    const u = users[q.email];
    if (q.op === 'signup') {
      if (u) return { user: { id: 'fake', email: q.email }, session: false };
      const n = users[q.email] = { id: 'uid-' + q.email, email: q.email, password: q.password, confirmed: autoConfirm };
      if (!autoConfirm) tokens['tok-signup-' + q.email] = n;
      return { user: pub(n), session: autoConfirm };
    }
    if (q.op === 'signin') {
      if (!u || u.password !== q.password) return { error: { message: 'Invalid login credentials', status: 400 } };
      if (!u.confirmed) return { error: { message: 'Email not confirmed', status: 400 } };
      return { user: pub(u) };
    }
    if (q.op === 'reset') { if (u) tokens['tok-recovery-' + q.email] = u; return {}; }
    if (q.op === 'token') { const t = tokens[q.token]; if (!t) return {}; t.confirmed = true; delete tokens[q.token]; return { user: pub(t) }; }
    if (q.op === 'update') { const x = Object.values(users).find(v => v.id === q.uid); x.password = q.password; return { user: pub(x) }; }
  }
  function handle(json) {
    const q = JSON.parse(json);
    if (q.table === 'auth') return JSON.stringify(auth(q));
    const t = db[q.table];
    if (q.op === 'upsert') {
      // A multi-row upsert sends the union of the rows' keys; a missing key becomes null, and the columns are NOT NULL.
      const cols = [...new Set(q.rows.flatMap(r => Object.keys(r)))];
      for (const r of q.rows) for (const c of cols) if (r[c] === undefined || r[c] === null) return JSON.stringify({ data: null, error: { code: '23502', message: `null value in column "${c}"` } });
      for (const r of q.rows) {
        if (r.user_id !== q.uid) return JSON.stringify({ data: null, error: { message: 'new row violates row-level security policy' } });
        const key = q.table === 'libraries' ? r.user_id : r.user_id + '/' + r.id, old = t[key];
        if (old && Number(r.updated_at) < Number(old.updated_at)) continue;   // keep the newer edit
        t[key] = { ...r, synced_at: stamp() };
      }
      return JSON.stringify({ data: null, error: null });
    }
    let rows = Object.values(t).filter(r => r.user_id === q.uid);
    for (const [op, col, v] of q.filters) rows = rows.filter(r => op === 'eq' ? r[col] === v : r[col] > v);
    rows.sort((a, b) => q.order.reduce((s, c) => s || (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0), 0));
    if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
    return JSON.stringify({ data: q.single ? rows[0] || null : rows, error: null });
  }
  return { db, handle, setAutoConfirm: v => { autoConfirm = v; } };
}

module.exports = async function run() {
  const { server, base } = await serve();
  const b = await browser();
  const be = backend();
  const r = runner('Accounts and sync');
  const errors = [];

  async function device(name) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, x => x.abort());
    await ctx.route('**/supabase.js', x => x.fulfill({ contentType: 'text/javascript', body: MOCK }));
    await ctx.exposeFunction('__sb', json => be.handle(json));
    const page = await ctx.newPage();
    await page.clock.setFixedTime(TODAY);
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.goto(base);
    await page.waitForSelector('.day');
    return { ctx, page };
  }
  const synced = p => p.waitForFunction(() => document.querySelector('#syncBtn').textContent === 'Synced', null, { timeout: 10000 });
  const reload = async p => { await p.reload(); await p.waitForSelector('.day'); await synced(p); };
  const chips = p => p.$$eval('.chip .n', c => c.map(x => x.textContent).sort());
  async function signIn(p, email, password) {
    await p.fill('#aEmail', email); await p.fill('#aPass', password); await p.click('#aSubmit');
  }

  const d1 = await device('phone');
  await r.step('first open shows the sign-in screen', async () => {
    assert.ok(await d1.page.isVisible('#auth'));
    assert.strictEqual(await d1.page.textContent('#aTitle'), 'Weekly Tracker');
  });

  await r.step('creating an account asks you to confirm your email first', async () => {
    await d1.page.click('#aMode');
    await signIn(d1.page, 'dani@example.com', 'correct horse');
    await d1.page.waitForSelector('#authMsg:not([hidden])');
    assert.strictEqual(await d1.page.textContent('#mTitle'), 'Check your email');
  });

  await r.step('the confirmation link signs you in and uploads the board', async () => {
    // The link opens the app fresh (a new page load, not just a change to the address's #part).
    await d1.page.goto('about:blank'); await d1.page.goto(base + '#access_token=tok-signup-dani@example.com&type=signup');
    await d1.page.waitForSelector('#auth', { state: 'hidden' });
    await synced(d1.page);
    assert.ok(be.db.libraries['uid-dani@example.com'], 'library saved');
    await addTile(d1.page, 'Pilates', TODAY_IDX);
    await synced(d1.page);
    assert.strictEqual(Object.values(be.db.placements).length, 1);
  });

  const d2 = await device('laptop');
  await r.step('a wrong password shows an error', async () => {
    await signIn(d2.page, 'dani@example.com', 'wrong');
    await d2.page.waitForSelector('#aErr:not([hidden])');
  });

  await r.step('a second device signs in and gets the same board', async () => {
    await signIn(d2.page, 'dani@example.com', 'correct horse');
    await d2.page.waitForSelector('#auth', { state: 'hidden' });
    await synced(d2.page);
    assert.deepStrictEqual(await chips(d2.page), ['Pilates']);
    assert.strictEqual(await balance(d2.page), await balance(d1.page));
  });

  await r.step('a tile added on one device reaches the other', async () => {
    await addTile(d2.page, 'Meal prep', TODAY_IDX); await synced(d2.page);
    await reload(d1.page);
    assert.deepStrictEqual(await chips(d1.page), ['Meal prep', 'Pilates']);
  });

  await r.step('a removal on one device reaches the other', async () => {
    const id = await d1.page.getAttribute('.chip:has-text("Meal prep")', 'data-item');
    await d1.page.click(`.chip[data-item="${id}"]`); await d1.page.click(`.chip[data-item="${id}"] [data-remove]`);
    await synced(d1.page);
    await reload(d2.page);
    assert.deepStrictEqual(await chips(d2.page), ['Pilates']);
  });

  await r.step('buying a treat syncs the balance and History', async () => {
    await addTile(d1.page, 'Meal prep', TODAY_IDX);   // 15 + 10 = 25 pts
    await d1.page.click('#rewards [data-buy="r-coffee"]'); await d1.page.click('#buyOk');
    await synced(d1.page);
    assert.strictEqual(await balance(d1.page), 5);
    await reload(d2.page);
    assert.strictEqual(await balance(d2.page), 5);
    await d2.page.click('#histBtn');
    assert.match(await d2.page.textContent('#histList'), /Fancy coffee · −20 pts/);
    await d2.page.keyboard.press('Escape');
  });

  await r.step('an offline edit on one device and an online edit on the other both survive', async () => {
    await d1.ctx.setOffline(true);
    await addTile(d1.page, '30 min walk', TODAY_IDX);
    await addTile(d2.page, 'Read 20 pages', TODAY_IDX); await synced(d2.page);
    await d1.ctx.setOffline(false);
    await d1.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await synced(d1.page);
    await reload(d2.page);
    assert.deepStrictEqual(await chips(d2.page), ['30 min walk', 'Meal prep', 'Pilates', 'Read 20 pages']);
  });

  await r.step('the look and Rest mode follow you to the other device', async () => {
    await setLook(d1.page, 'cobalt');
    await d1.page.click('#setBtn'); await d1.page.click('#sRest'); await d1.page.click('#setDone');
    await synced(d1.page);
    await reload(d2.page);
    assert.strictEqual(await d2.page.evaluate(() => document.documentElement.dataset.look), 'cobalt');
    assert.ok(await d2.page.isVisible('#restChip'));
  });

  await r.step('signing out clears the board; someone else gets their own', async () => {
    await d2.page.click('#setBtn');
    await d2.page.click('#acctBtn'); await d2.page.click('#acctBtn');
    await d2.page.waitForSelector('#auth:not([hidden])');
    be.setAutoConfirm(true);
    await d2.page.click('#aMode');
    await signIn(d2.page, 'sam@example.com', 'another password');
    await d2.page.waitForSelector('#auth', { state: 'hidden' });
    await synced(d2.page);
    assert.deepStrictEqual(await chips(d2.page), []);
    assert.ok(Object.values(be.db.placements).every(x => x.user_id === 'uid-dani@example.com'), 'Sam has no rows yet');
  });

  await r.step('no page errors on any device', async () => {
    assert.deepStrictEqual(errors.filter(e => !/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/.test(e)), []);
  });

  await b.close(); server.close();
  return r.report();
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
