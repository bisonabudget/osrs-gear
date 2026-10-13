// Keeps the site on the visitor's device, so a return visit loads without waiting on the network.
// The build puts FILES (this release's files in assets/) above this, so each release installs a
// new copy that clears out the last release's files.
/* global FILES */

const ASSETS = 'assets';
const PICTURES = 'pictures';
const PAGE = 'page';

// The files every visit needs, saved as soon as this installs. The rest are saved when first used.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSETS)
    .then((cache) => cache.addAll(FILES.filter((f) => /\.(js|css)$|-latin-\d+-normal-[\w-]+\.woff2$/.test(f))))
    .then(() => self.skipWaiting()));
});

// Files from older releases are no longer used by any page.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.open(ASSETS)
    .then(async (cache) => {
      const keep = new Set(FILES.map((f) => new URL(f, self.registration.scope).href));
      for (const request of await cache.keys()) if (!keep.has(request.url)) await cache.delete(request);
    })
    .then(() => self.clients.claim()));
});

// Saves only a full, successful reply from the site itself, so a failed one is never kept.
const keep = async (name, request, reply) => {
  if (reply.ok && reply.status === 200 && reply.type === 'basic') {
    const cache = await caches.open(name);
    await cache.put(request, reply.clone());
  }
  return reply;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Prices, hiscores and anything else from another site always come from the network.
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);

  // The page: the newest from the network, so a new release shows at once, or the saved one offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then((reply) => keep(PAGE, 'index.html', reply))
      .catch(() => caches.match('index.html', { cacheName: PAGE }).then((saved) => saved ?? Response.error())));
    return;
  }

  // Release files never change under the same name.
  if (path.startsWith('assets/') && !url.search) {
    event.respondWith(caches.match(request, { cacheName: ASSETS })
      .then((saved) => saved ?? fetch(request).then((reply) => keep(ASSETS, request, reply))));
    return;
  }

  // Pictures show the saved copy at once and are checked in the background, so one updated on the
  // site is shown from the next visit. Retries (with ?try=) skip this and go to the network.
  if (path.startsWith('img/') && !url.search) {
    const fresh = fetch(request).then((reply) => keep(PICTURES, request, reply));
    event.respondWith(caches.match(request, { cacheName: PICTURES }).then((saved) => {
      if (!saved) return fresh;
      event.waitUntil(fresh.catch(() => {}));
      return saved;
    }));
  }
});
