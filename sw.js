// Offline működés: az alkalmazás fájljait gyorsítótárazza (az adatok a böngésző tárhelyén és az adatmappában vannak, nem itt).
const CACHE = "ots-web-v4";
const FILES = [
  "./", "./index.html", "./style.css", "./manifest.webmanifest", "./skill/bundle.json",
  "./src/app.js", "./src/attendance.js", "./src/calendar.js", "./src/csv.js", "./src/dates.js", "./src/entries.js", "./src/folder.js", "./src/insights.js",
  "./src/manual.js", "./src/pomodoro.js", "./src/skill.js", "./src/store.js", "./src/types.js",
  "./src/ui/calendar-view.js", "./src/ui/capture.js", "./src/ui/ctx.js", "./src/ui/fields.js", "./src/ui/icons.js", "./src/ui/lower.js",
  "./src/ui/ots.js", "./src/ui/settings.js", "./src/ui/skill-wizard.js", "./src/ui/sound.js", "./src/ui/util.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Gyorsítótár először, a háttérben frissítés (a következő megnyitáskor az új változat kerül elő).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
