const cacheName = 'expense-tracker-cache-v1';
const basePath = location.hostname === 'localhost' ? '/' : '/expense-tracker/';

const assetsToCache = [
  `${basePath}`,
  `${basePath}index.html`,
  `${basePath}asset/style.css`,
  `${basePath}asset/app.js`,
  `${basePath}asset/manifest.json`,
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://apis.google.com/js/api.js',
  'https://accounts.google.com/gsi/client'
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('Caching assets...');
      return cache.addAll(assetsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== cacheName).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // Optionally, return a fallback page or asset when offline and the fetch fails.
        return caches.match('/fallback.html');
      });
    })
  );
});
