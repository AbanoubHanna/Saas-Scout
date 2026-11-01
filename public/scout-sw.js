// Cache only the generic offline application and its static font/script. Never cache authenticated HTML, API responses, rosters or credentials here.
const OFFLINE_CACHE='scout-safe-offline-v5';
const SAFE_ASSETS=['/scout-offline.html','/scout-offline.js','/assets/cairo-arabic.woff2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(OFFLINE_CACHE).then(cache=>cache.addAll(SAFE_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;if(SAFE_ASSETS.includes(url.pathname)){event.respondWith(caches.open(OFFLINE_CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));return;}if(event.request.mode==='navigate'&&/^\/(console|me)(\/|$)/.test(url.pathname))event.respondWith(fetch(event.request).catch(async()=>{const fallback=await(await caches.open(OFFLINE_CACHE)).match('/scout-offline.html');return fallback||new Response('لا يوجد اتصال',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));});
