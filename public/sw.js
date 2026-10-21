/*
 * Service worker — Réception NEOTRADE
 * - Fichiers statiques Next (/_next/static, icônes, moteur de scan /wasm) : cache d'abord.
 * - Pages : réseau d'abord ; sans réseau, dernière version en cache, sinon /hors-ligne.
 * - Les requêtes POST (actions, synchro des scans) ne passent jamais par le cache.
 * Les scans hors ligne sont stockés dans IndexedDB par l'application (étape scan), pas ici.
 */
const VERSION = "v4";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/wasm/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Ne garde que les vraies pages (pas les redirections vers la connexion)
          if (res.ok && !res.redirected) caches.open(PAGES_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    );
  }
});
