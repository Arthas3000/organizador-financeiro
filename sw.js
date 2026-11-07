// Cache-first dos arquivos estáticos. Aumente V a cada publicação para os clientes atualizarem.
const V = 'v2';
const ARQUIVOS = ['./', './index.html', './style.css', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-512.png',
  './js/app.js', './js/ui.js', './js/logica.js', './js/estado.js', './js/inicio.js', './js/extrato.js', './js/analise.js',
  './js/mais.js', './js/lancamento.js', './js/cadastros.js'];

// cache:'reload' ignora o cache HTTP (GitHub Pages: max-age=600); se um arquivo falhar, a instalação falha e a versão antiga continua
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
