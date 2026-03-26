const CACHE_VERSION = "suomisanat-v6";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/data/words.v3.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(APP_SHELL_CACHE);
  cache.put(request, response.clone());
  return response;
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached ?? networkPromise;
};

const networkFirstDocument = async (request) => {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put("/index.html", response.clone());
    return response;
  } catch {
    return (await caches.match(request)) ?? (await caches.match("/index.html")) ?? Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (url.pathname === "/data/words.v3.json") {
    event.respondWith(cacheFirst(request));
    return;
  }

  const staticAsset =
    url.pathname.startsWith("/assets/") ||
    ["style", "script", "worker", "font", "image"].includes(request.destination);

  if (staticAsset) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
