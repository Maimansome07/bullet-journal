// Service Worker for Mai Bullet Journal
// Cache version uses full date+hour so every new Netlify deploy busts the cache
const CACHE = 'bj-202605281500'; // build 202605280300
const ASSETS = [
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap',
];
// NOTE: index.html is intentionally excluded from pre-cache so it always fetches fresh

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
        // index.html: always network-first so updates are picked up immediately
        if(url.endsWith('/') || url.endsWith('index.html') || url === self.location.origin + '/'){
          return networkFetch;
        }
        // Other local assets: cache-first for speed
        return url.startsWith(self.location.origin) ? (cached || networkFetch) : networkFetch;
      });
    })
  );
});

// Allow the page to trigger immediate activation of new SW
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // Allow page to send a notification via the SW (more reliable on mobile)
  if(e.data && e.data.type === 'SHOW_NOTIFICATION'){
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: e.data.tag || 'bj',
      renotify: true,
      data: { url: e.data.url || '/' }
    });
  }
});

// Open app when notification is clicked
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
      // Focus existing window if open
      for(var i=0; i<list.length; i++){
        if(list[i].url.includes(self.location.origin) && 'focus' in list[i]){
          return list[i].focus();
        }
      }
      // Otherwise open new window
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Periodic background sync — fire reminders even when app is closed (Chrome PWA)
self.addEventListener('periodicsync', function(e){
  if(e.tag === 'bj-daily-check'){
    e.waitUntil(
      clients.matchAll({type:'window'}).then(function(list){
        // If app is open, let it handle notifications itself
        if(list.length > 0) return;
        // App is closed — post message to any client or skip
        // (full background notification requires IndexedDB; handled by app on next open)
      })
    );
  }
});
