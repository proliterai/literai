// ================================================================================
// ФАЙЛ: src/lib/domain/story-catalog/storyCatalog.service.ts
// Описание: Сервис загрузки манифеста историй и запуска конкретных шаблонов
// ================================================================================

import { ui } from '$lib/ui/ui.store';
import { parseImportedSession } from '$lib/domain/session-import/sessionImport.service';
import { sessionLaunchService } from '$lib/domain/session-import/sessionLaunch.service';
import type { StoryManifest } from './storyCatalog.types';

// === ИМПОРТЫ СТОРОВ ДЛЯ ОЧИСТКИ ===
import { eyeStore } from '$lib/domain/eye/eye.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';

const MANIFEST_URL = '/data/story-catalog/manifest.json';

export const storyCatalogService = {
  /**
   * Загружает манифест историй из папки static.
   * Возвращает распарсенный объект или null в случае ошибки сети/отсутствия файла.
   */
  async loadManifest(): Promise<StoryManifest | null> {
    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: StoryManifest = await response.json();
      return data;
    } catch (error) {
      console.error('[StoryCatalogService] Failed to load manifest:', error);
      return null;
    }
  },

  /**
   * Скачивает JSON-шаблон истории по указанному пути, проверяет его валидность
   * и запускает как новую независимую сессию.
   *
   * @param sessionPath Путь к файлу шаблона (например, '/data/story-catalog/sessions/hero_1.json')
   * @returns boolean Успешно ли запущен чат
   */
  async startStoryFromTemplate(sessionPath: string): Promise<boolean> {
    try {
      // === ЖЁСТКАЯ ОЧИСТКА СТОРОВ ПЕРЕД ЗАПУСКОМ НОВОЙ ИСТОРИИ ===
      // Это предотвращает "утечку" данных из предыдущей сессии
      eyeStore.reset();
      cheatmodeStore.importData(null);
      lorebookStore.importData(null);
      // ===================================================

      // 1. Скачиваем файл сессии
      const response = await fetch(sessionPath);
      if (!response.ok) {
        throw new Error(`Не удалось скачать шаблон истории (Код: ${response.status})`);
      }

      const json = await response.json();

      // 2. Парсим шаблон с помощью существующего и проверенного механизма импорта
      const parsedResult = parseImportedSession(json);

      if (!parsedResult.ok) {
        throw new Error(`Шаблон истории повреждён: ${parsedResult.message}`);
      }

      // 3. Запускаем историю (создаем новый ID, сохраняем в базу, переходим в роут)
      await sessionLaunchService.launchFromPreview(parsedResult.preview);

      return true;
    } catch (error: any) {
      console.error('[StoryCatalogService] Failed to start story:', error);
      // Защита от битых шаблонов (Шаг 18) — показываем понятную ошибку юзеру
      ui.notify(error.message || 'Произошла ошибка при запуске истории', 'error');
      return false;
    }
  }
};