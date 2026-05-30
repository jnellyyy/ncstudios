const CACHE_NAME = "ncstudios-v1";
const APP_FILES = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./bookings.html",
  "./clients.html",
  "./finance.html",
  "./shot-lists.html",
  "./lists.html",
  "./delivery.html",
  "./templates.html",
  "./style.css",
  "./app.js",
  "./site.webmanifest",
  "./register-sw.js"
];

self.addEventListener("install",event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
});

self.addEventListener("activate",event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch",event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
