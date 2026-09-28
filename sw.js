// Service worker de Mi Furgo: permite abrir la app sin cobertura.
// Primero intenta la red (para recibir siempre la última versión) y, si no hay
// conexión o tarda más de 3 segundos, usa la copia guardada.

const CACHE = 'mi-furgo-v1';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/storage.js',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
const NETWORK_TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const fromNetwork = fetch(request);
  // La copia para la caché se saca antes de entregar la respuesta a la página.
  const copy = fromNetwork.then((response) => (response.ok ? response.clone() : null));
  // Aunque se responda con la copia guardada, la descarga sigue y actualiza la caché.
  event.waitUntil(
    copy
      .then((response) => response && caches.open(CACHE).then((cache) => cache.put(request, response)))
      .catch(() => {}),
  );
  event.respondWith(respond(request, fromNetwork));
});

async function respond(request, fromNetwork) {
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
  try {
    const response = await Promise.race([fromNetwork, timeout]);
    if (response) return response;
  } catch {
    // Sin conexión: se usa la copia.
  }
  const cache = await caches.open(CACHE);
  const cached =
    (await cache.match(request, { ignoreSearch: true })) ||
    (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  return cached || fromNetwork;
}
