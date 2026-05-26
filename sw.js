// Service Worker for Mai Bullet Journal
const CACHE = 'bj-v1';
const ASSETS = [
  './bullet-journal-complete.html',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap',
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(ASSETS.filter(a => a.startsWith('.')));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k)));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  // Network-first for Firebase, cache-first for local assets
  if(e.request.url.includes('firebase') || e.request.url.includes('googleapis.com/identitytoolkit')){
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached){
      var networkFetch = fetch(e.request).then(function(response){
        if(response.ok && e.request.url.startsWith(self.location.origin)){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});
