// Inaarat Jewels — service worker (GitHub Pages, site root)
// Gives: offline cold start of the app + cached Excel/PDF libs and fonts.
// Never touches Google Drive / sign-in traffic, so backups are never cached.
const VERSION = 'ij-v2';
const SHELL   = 'ij-shell-' + VERSION;   // the app page itself
const LIBS    = 'ij-libs-'  + VERSION;   // CDN libs + fonts

const SHELL_FILES = [
  './', './inaarat-jewels.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => Promise.all(SHELL_FILES.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== LIBS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin (the app): network first so new deploys arrive, cache when offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./inaarat-jewels.html') : undefined))
      )
    );
    return;
  }

  // Libraries + fonts: cache first, refresh in background
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(LIBS).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
  // everything else (Drive API, accounts.google.com, gsi/client) → untouched
});
