// ================================================================================
// ФАЙЛ: src/routes/+layout.ts
// Описание: Конфигурация маршрутизации для SPA
// ИСПРАВЛЕНИЯ: Отключен SSR для корректной работы с IndexedDB и localStorage
// ================================================================================

export const prerender = false;
export const ssr = false; // Отключаем SSR, так как работаем с IndexedDB и localStorage
export const csr = true;