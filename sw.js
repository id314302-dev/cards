// Сетевой запрос в приоритете (чтобы подтягивать новую версию), при отсутствии сети — кэш.
importScripts("cards.js");   // даёт список колод DECKS, из него собираем файлы для кэша

const CACHE = "cards-v7";
const FILES = ["./", "index.html", "cards.js", "manifest.json", "icon-v2-192.png", "icon-v2-512.png",
  ...DECKS.flatMap(d => d.cards.flatMap(c => [`audio/${d.dir}${c.id}.mp3`, `audio-uk/${d.dir}${c.id}.mp3`, ...(d.noimg ? [] : [`img/${d.dir}${c.id}.jpg`])]))];

self.addEventListener("install", e => {
  // allSettled: если для какой-то карточки ещё нет картинки или британской озвучки (audio-uk/), остальное всё равно сохранится
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => c.add(f)))));
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
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
