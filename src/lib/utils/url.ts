// ================================================================================
// ФАЙЛ: src/lib/utils/url.ts
// Описание: Утилиты для безопасной работы с URL (защита от XSS, валидация картинок)
// ================================================================================

/**
 * Безопасно проверяет и нормализует URL.
 * Разрешает только http:, https: и валидные base64 data: изображения.
 * 
 * @param url Строка с URL или Base64
 * @returns Очищенный URL или пустую строку, если URL небезопасен
 */
export function safeUrl(url?: string): string {
  if (!url) return '';
  
  try {
    // В SSR location может быть недоступен, ставим заглушку для относительных путей
    const base = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    const u = new URL(url, base);
    
    // Разрешаем стандартные веб-протоколы
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.href;
    }
    
    // Разрешаем data-URL только для изображений в формате base64
    if (u.protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) {
      return url;
    }
  } catch (e) {
    // URL невалиден (ошибка парсинга)
  }
  
  return '';
}