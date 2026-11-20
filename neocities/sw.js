// Caché del receptor: la pantalla, la voz, el mando y los gestos siguen funcionando sin internet.
const C = 'mc-rx-v3', FILES = ['r.html', 'receiver.js', 'receiver.css', 'qr.js', 'shared.js', 'manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const p = new URL(e.request.url).pathname.split('/').pop();
  if (e.request.method !== 'GET' || !FILES.includes(p)) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
