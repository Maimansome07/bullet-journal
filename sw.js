// Service Worker for Mai Bullet Journal
// Cache version rotates monthly — forces refresh when new version is deployed
const CACHE = 'bj-' + new Date().toISOString().slice(0, 7); // e.g. bj-2026-05
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap',
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      // Cache local assets only (skip cross-origin fonts — may fail)
      return cache.addAll(ASSETS.filter(function(a){ return a.startsWith('.'); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // Never intercept Firebase or Google auth calls
  if(url.includes('firestore.googleapis.com') ||
     url.includes('firebase') ||
     url.includes('identitytoolkit') ||
     url.includes('securetoken.googleapis.com')){
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(function(cache){
      return cache.match(e.request).then(function(cached){
        var networkFetch = fetch(e.request).then(function(response){
          // Only cache successful same-origin responses
          if(response.ok && url.startsWith(self.location.origin)){
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(function(){
          // Offline fallback — return cached version or index.html
          return cached || cache.match('./index.html');
        });
        // Cache-first for local assets, network-first for everything else
        return url.startsWith(self.location.origin) ? (cached || networkFetch) : networkFetch;
      });
    })
  );
});

// Allow the page to trigger immediate activation of new SW
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
