// ─── BudgetFlow Service Worker ───────────────────────────────────────────────
// Stratégie : Cache-First pour les assets locaux, Network-First pour le reste.
// Bump CACHE_NAME à chaque déploiement pour forcer le remplacement.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME   = 'budgetflow-v1.1';
const FONT_CACHE   = 'budgetflow-fonts-v1';

// Assets locaux mis en cache dès l'installation (précache)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './285614.jpg',
];

// URLs Google Fonts (cross-origin, requiert no-cors)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@700;800&display=swap',
];


// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  // Prend immédiatement le contrôle sans attendre la fermeture des onglets
  self.skipWaiting();

  e.waitUntil(
    Promise.all([
      // Précache des assets locaux
      caches.open(CACHE_NAME).then((cache) =>
        cache.addAll(PRECACHE_ASSETS).catch((err) =>
          console.warn('[SW] Précache partiel :', err)
        )
      ),
      // Précache des fonts (opaque, no-cors)
      caches.open(FONT_CACHE).then((cache) =>
        Promise.all(
          FONT_URLS.map((url) =>
            cache.add(new Request(url, { mode: 'no-cors' })).catch((err) =>
              console.warn('[SW] Font non mise en cache :', url, err)
            )
          )
        )
      ),
    ])
  );
});


// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  const VALID_CACHES = [CACHE_NAME, FONT_CACHE];

  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !VALID_CACHES.includes(key))
            .map((key) => {
              console.log('[SW] Suppression ancien cache :', key);
              return caches.delete(key);
            })
        )
      )
      // clients.claim() dans waitUntil garantit qu'il s'exécute
      // seulement après le nettoyage complet
      .then(() => self.clients.claim())
  );
});


// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non-GET (POST, PUT, DELETE…)
  if (request.method !== 'GET') return;

  // Ne pas intercepter les extensions Chrome, devtools, etc.
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // ── Fonts Google : Cache-First (changent rarement, coûteuses en réseau)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request, { mode: 'no-cors' }).then((res) => {
            if (res && res.status === 0 /* opaque */ || res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          }).catch(() => cached); // offline : retourne le cache même périmé
        })
      )
    );
    return;
  }

  // ── Assets locaux (HTML, JS, images…) : Cache-First avec revalidation réseau
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          // Lance une mise à jour en arrière-plan (stale-while-revalidate)
          const networkFetch = fetch(request).then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => null);

          // Retourne immédiatement le cache si dispo, sinon attend le réseau
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // ── Tout le reste : Network-First avec fallback cache
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
