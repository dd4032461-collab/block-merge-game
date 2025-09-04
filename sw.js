const CACHE_NAME = 'block-merge-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/game.js?v=5',
  '/js/telegram.js?v=5',
  '/js/leaderboard.js?v=5',
  '/styles/game.css?v=5',
  '/styles/leaderboard.css?v=5',
  '/manifest.json',
  'https://telegram.org/js/telegram-web-app.js'
];

self.addEventListener('install', function(event) {
  // Принудительно активируем новый service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // Очищаем старый кэш перед добавлением нового
        return cache.keys().then(function(keys) {
          return Promise.all(keys.map(function(key) {
            return cache.delete(key);
          }));
        }).then(function() {
          return cache.addAll(urlsToCache);
        });
      })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Удаляем старые кэши
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Принудительно захватываем контроль над всеми клиентами
  return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
