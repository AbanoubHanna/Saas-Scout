// Never cache authenticated HTML, API responses, rosters, financial data or identity headers.
const OFFLINE_CACHE = 'scout-safe-offline-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add('/scout-offline.html'))));
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.mode !== 'navigate' || url.origin !== self.location.origin || !/^\/(console|me)(\/|$)/.test(url.pathname)) return;
 event.respondWith(fetch(event.request).catch(async()=>{const fallback=await caches.match('/scout-offline.html');return fallback || new Response('لا يوجد اتصال',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));
});
