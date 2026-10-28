// A stand-in for supabase-js, served in place of supabase.js during the cloud tests. It implements
// only what the app uses, and sends every call to the test's in-memory database (window.__sb).
(function () {
  const call = async req => JSON.parse(await window.__sb(JSON.stringify(req)));
  const KEY = 'mock:session';
  const getS = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const setS = s => s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
  const sessionFor = user => ({ access_token: 'tok-' + user.id, user });

  function query(table) {
    const q = { table, filters: [], order: [], range: null, single: false, op: 'select', rows: null };
    const run = async () => {
      if (navigator.onLine === false) return { data: null, error: { message: 'Failed to fetch' } };
      const s = getS();
      if (!s) return { data: null, error: { message: 'JWT expired', status: 401 } };
      return call({ ...q, uid: s.user.id });
    };
    const b = {
      select() { q.op = 'select'; return b; },
      upsert(rows) { q.op = 'upsert'; q.rows = Array.isArray(rows) ? rows : [rows]; return b; },
      eq(col, v) { q.filters.push(['eq', col, v]); return b; },
      gt(col, v) { q.filters.push(['gt', col, v]); return b; },
      order(col) { q.order.push(col); return b; },
      range(from, to) { q.range = [from, to]; return b; },
      maybeSingle() { q.single = true; return b; },
      then(ok, bad) { return run().then(ok, bad); },
    };
    return b;
  }

  function createClient() {
    // Like detectSessionInUrl: a link from an email signs you in.
    const hash = new URLSearchParams(location.hash.slice(1));
    let pending = null;
    if (hash.get('access_token')) pending = call({ table: 'auth', op: 'token', token: hash.get('access_token') }).then(r => {
      if (r.user) setS(sessionFor(r.user));
      history.replaceState(null, '', location.pathname + location.search);
    });
    const auth = {
      async getSession() { if (pending) await pending; return { data: { session: getS() }, error: null }; },
      async signInWithPassword({ email, password }) {
        const r = await call({ table: 'auth', op: 'signin', email, password });
        if (r.error) return { data: { user: null, session: null }, error: r.error };
        setS(sessionFor(r.user)); return { data: { user: r.user, session: getS() }, error: null };
      },
      async signUp({ email, password }) {
        const r = await call({ table: 'auth', op: 'signup', email, password });
        if (r.session) setS(sessionFor(r.user));
        return { data: { user: r.user, session: r.session ? getS() : null }, error: null };
      },
      async resetPasswordForEmail(email) { await call({ table: 'auth', op: 'reset', email }); return { data: {}, error: null }; },
      async updateUser({ password }) {
        const s = getS(); const r = await call({ table: 'auth', op: 'update', uid: s && s.user.id, password });
        return { data: { user: r.user }, error: null };
      },
      async signOut() { setS(null); return { error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    };
    return { auth, from: query };
  }
  window.supabase = { createClient };
})();
