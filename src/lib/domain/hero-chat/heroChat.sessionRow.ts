// ================================================================================
// ФАЙЛ: src/lib/domain/hero-chat/heroChat.sessionRow.ts
// Описание: Построение строки сессии для режима "Игра за героя" с включением
// всех сопутствующих данных (системный промпт, читмод, лорбук, eyeData, memoryBookData)
// ================================================================================

import { heroChatStore } from './heroChat.store';
import { heroSystemPromptStore } from './heroSystemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
import type { HeroChatSessionRow } from './heroChat.types';

/**
 * Собирает полный объект сессии для сохранения в IndexedDB.
 * Включает данные системного промпта, читмода, лорбука, Ока Мира и MemoryBook.
 */
export function buildHeroSessionRow(): HeroChatSessionRow {
  const base = heroChatStore.toSessionData();

  return {
    ...base,
    mode: 'hero', // явно указываем режим
    systemPromptData: heroSystemPromptStore.exportData(),
    cheatmodeData: cheatmodeStore.exportData(),
    lorebookData: lorebookStore.exportData(),
    eyeData: eyeStore.exportData(),
    memoryBookData: memoryBookStore.exportData()
  } as HeroChatSessionRow;
}