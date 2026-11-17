// Service worker da Escola Virtual 3D: app shell em cache-first para funcionar offline.
// Vídeos e áudio nunca entram em cache (ficam só no servidor).
const CACHE = 'escola-3d-v2';
const SHELL = [
  './', './index.html', './app.js', './telas.js', './dados.js', './conteudo.js', './gamificacao.js',
  './modulo-aluno.js', './modulo-secretaria.js', './modulo-escola.js', './modulo-professor.js', './modulo-revendedor.js',
  './modulo-estudo.js', './visao-frente.js',
  './assets/frente-escola.jpg', './assets/sala-real.jpg',
  './style.css', './vendor/three.module.min.js', './vendor/qrcode.min.js',
  './links.html', './apresentacao.html', './manifest.webmanifest', './icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.(mp4|webm|mp3|wav)$/i.test(url.pathname)) return; // mídia não entra no cache
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const rede = fetch(e.request)
        .then((r) => { if (r.ok && url.origin === location.origin) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cl)); } return r; })
        .catch(() => hit || caches.match('./index.html'));
      return hit || rede;
    })
  );
});
