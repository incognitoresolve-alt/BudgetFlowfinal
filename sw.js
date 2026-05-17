const CACHE_NAME = 'budgetflow-v1.0';

// Liste des fichiers à sauvegarder dans le téléphone pour le mode hors-ligne
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './285614.jpg',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@700;800&display=swap'
];

// 1. INSTALLATION (Mise en cache)
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force l'installation immédiate du nouveau Service Worker
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On utilise catch pour éviter que l'échec de téléchargement d'un fichier (ex: la police) ne bloque tout le reste
      return cache.addAll(ASSETS).catch((err) => console.log('Erreur de cache partiel', err));
    })
  );
});

// 2. ACTIVATION (Nettoyage des vieilles versions)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Supprime l'ancien cache si le nom a changé (v1.1, v1.2...)
          }
        })
      );
    })
  );
  self.clients.claim(); // Prend le contrôle immédiat sans avoir à recharger la page
});

// 3. INTERCEPTION (Mode hors-ligne)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    // Stratégie : On essaie le réseau d'abord. Si on est hors-ligne (catch), on prend le cache.
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
