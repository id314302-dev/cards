// Сетевой запрос в приоритете (чтобы подтягивать новую версию), при отсутствии сети — кэш.
const CACHE = "cards-v3";
const FILES = ["./", "index.html", "cards.js", "manifest.json", "icon-v2-192.png", "icon-v2-512.png",
  ...Array.from({ length: 20 }, (_, i) => [`audio/${i + 1}.mp3`, `audio/${i + 1}-slow.mp3`]).flat()];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
