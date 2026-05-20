// ================================================================================
// ФАЙЛ: src/lib/domain/search/search.persistence.ts
// Описание: Автосохранение поисковой сессии
// ================================================================================

import { get } from 'svelte/store';
import { searchStore } from './search.store';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';

let paused = false;

export function pauseSearchAutosave() { paused = true; }
export function resumeSearchAutosave() { paused = false; }

/**
 * Подключает автосохранение для режима Поиска.
 * Возвращает функцию отписки.
 */
export function attachSearchAutosave(buildRow: () => any): () => void {
  // Подписываемся на триггеры внутри стора
  searchStore.onAutoSave(async () => {
    const s = get(searchStore);
    if (!s.sessionId || paused) return;

    try {
      await sessionsRepo.save(buildRow());
    } catch (e) {
      console.error('[SearchPersistence] Autosave failed:', e);
    }
  });

  // Возвращаем пустую функцию отписки для совместимости API (таймер живет в сторе)
  return () => {
    searchStore.onAutoSave(() => {});
  };
}