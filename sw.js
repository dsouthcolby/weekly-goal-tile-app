// Keeps Weekly Tracker opening with no signal. The app's files are served from this cache first and
// refreshed in the background, so a new version shows up the next time the app is opened.
// Requests to Supabase are never cached.
const CACHE = 'tile-week-v17';
const SHELL = ['./', './index.html', './supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('tile-week-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  const nav = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = (await cache.match(req, { ignoreSearch: nav })) || (nav ? await cache.match('./') : undefined);
    const net = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
