const CACHE_NAME = "kalimat-trainer-20260909-19";
const SURAH_COUNTS = { 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3, 111: 5, 112: 4, 113: 5, 114: 6 };
const AUDIO_ASSETS = Object.entries(SURAH_COUNTS).flatMap(([surah, count]) =>
  Array.from({ length: count }, (_, index) => `./audio/ayman-suwaid/${surah}${String(index + 1).padStart(3, "0")}.mp3`)
);
const APP_ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./style.css",
  "./UthmanicHafs1Ver18.woff2",
  "./juz30-data.js",
  "./game.js",
  "./ayah-game.js",
  "./daily-game.js",
  "./continue-game.js",
  "./manifest.webmanifest",
  ...AUDIO_ASSETS
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  if (["script", "style"].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
