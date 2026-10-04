// Offline support for Zoom Out.
// Everything is fetched fresh from the network first, so a new deploy or a new photo
// shows up straight away. The saved copy is only used when there's no connection.
const CACHE = "zoomout-v2";
const SHELL = [
  "/", "/css/fonts.css", "/css/style.css", "/js/game.js", "/js/core.js", "/js/config.js", "/js/app.js", "/js/crowd.js",
  "/puzzles.json", "/manifest.webmanifest", "/icons/icon-192.png", "/favicon.svg",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // leave fonts, analytics and the database alone
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
      return hit || (req.mode === "navigate" ? caches.match("/") : Response.error());
    })
  );
});
