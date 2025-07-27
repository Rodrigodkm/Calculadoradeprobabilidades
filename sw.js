// sw.js
// Este é um service worker bem básico.
// Para funcionalidades offline mais avançadas, mais código seria necessário aqui.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalado');
  self.skipWaiting(); // Força a ativação do novo service worker imediatamente
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativado');
  event.waitUntil(clients.claim()); // Assume controle de clientes existentes
});

// Você pode adicionar estratégias de cache aqui para tornar o app offline-first
self.addEventListener('fetch', (event) => {
  // Por enquanto, apenas permite que as requisições sigam normalmente
  // event.respondWith(fetch(event.request));
});