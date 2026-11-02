// Статика (озвучка, картинки, иконки) не меняется, поэтому берём её сначала из кэша: без связи, но при «живом» Wi-Fi запрос к сети висит минутами.
// Оболочка (index.html, cards.js, manifest) — сеть, но не дольше NET_WAIT мс, потом кэш; так новая версия подтягивается сразу, а офлайн приложение не ждёт.
importScripts("cards.js");   // даёт список колод DECKS, из него собираем файлы для кэша

const CACHE = "cards-v30";   // префикс «cards-»: на этом же адресе живёт ещё приложение со своим кэшем, чужие кэши не трогаем
const NET_WAIT = 2500;
const US = new Set(["", "cup/", "verbs/", "frames/", "irregular/"]);   // американская озвучка есть только у этих колод; остальные качать незачем
const FILES = ["./", "index.html", "cards.js", "manifest.json", "sessions.json", "icon-v2-192.png", "icon-v2-512.png",
  ...DECKS.flatMap(d => d.cards.flatMap(c => [...(US.has(d.dir) ? [`audio/${d.dir}${c.id}.mp3`] : []), `audio-uk/${d.dir}${c.id}.mp3`, ...(d.noimg ? [] : [`img/${d.dir}${c.id}.jpg`])]))];

// Докачивает недостающие файлы по 6 штук параллельно; отсутствующий на сервере файл (например, нет картинки) остальное не ломает
let filling = null;
function fill() {
  return filling || (filling = fillNow().finally(() => { filling = null; }));
}
async function fillNow() {
  const c = await caches.open(CACHE);
  // сначала берём готовое из кэша прошлой версии: не качать заново десятки мегабайт при каждом обновлении
  for (const k of await caches.keys()) {
    if (!k.startsWith("cards-") || k === CACHE) continue;
    const old = await caches.open(k);
    for (const r of await old.keys()) {
      const p = new URL(r.url).pathname;
      if (/\/(audio|audio-uk|img|sessions)\//.test(p) && !(await c.match(r))) { const hit = await old.match(r); if (hit) await c.put(r, hit); }
    }
  }
  const todo = [];
  for (const f of FILES) if (!(await c.match(f))) todo.push(f);
  for (let i = 0; i < todo.length; i += 6) await Promise.allSettled(todo.slice(i, i + 6).map(f => c.add(f)));
}

self.addEventListener("install", e => {
  e.waitUntil(fill());
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("cards-") && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Длинные тренировки (sessions/*.mp3, ~40 МБ) заранее не качаем: они сохраняются в кэш при первом воспроизведении.
// Страница просит докачать недостающее (если прошлая установка кэша оборвалась на слабой сети)
self.addEventListener("message", e => {
  if (e.data === "precache") e.waitUntil(fill());
});

const isAsset = u => /\/(audio|audio-uk|img|sessions)\//.test(u.pathname) || /\/icon-/.test(u.pathname);
const keep = (req, r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; };

function cacheFirst(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(r => keep(req, r)));
}

function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => caches.match(req).then(finish), NET_WAIT);   // сеть молчит — отдаём копию
    fetch(req).then(r => { clearTimeout(timer); finish(keep(req, r)); })
      .catch(() => { clearTimeout(timer); caches.match(req).then(r => finish(r || Response.error())); });
  });
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(isAsset(u) ? cacheFirst(e.request) : networkFirst(e.request));
});
