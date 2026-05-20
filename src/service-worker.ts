/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE_NAME = `literai-cache-${version}`;

// Добавляем '/' в массив принудительно, чтобы закэшировать HTML-оболочку приложения
const ASSETS = [
  '/',
  ...build, 
  ...files  
];

self.addEventListener('install', (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
  }
  event.waitUntil(addFilesToCache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  async function deleteOldCaches() {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key !== CACHE_NAME) {
        await caches.delete(key);
      }
    }
  }
  event.waitUntil(deleteOldCaches());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Игнорируем запросы к внешним API (OpenRouter, Ollama и т.д.)
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  async function respond() {
    const cache = await caches.open(CACHE_NAME);
    
    // ВАЖНО: Обработка SPA-роутинга. 
    // Если браузер запрашивает HTML-страницу (например, пользователь обновил страницу /hero/chat/123),
    // мы отдаем ему базовый кэшированный '/', а SvelteKit сам отрисует нужный роут.
    if (event.request.mode === 'navigate') {
      const shellResponse = await cache.match('/');
      if (shellResponse) {
        return shellResponse;
      }
    }

    // Стандартная стратегия Cache-First для статики (JS, CSS, картинки)
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const response = await fetch(event.request);
      if (response.status === 200) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      return new Response('Нет подключения к интернету', { 
        status: 503, 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    }
  }

  event.respondWith(respond());
});