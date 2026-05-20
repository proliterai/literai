// ================================================================================
// ФАЙЛ: src/lib/domain/search/search.sessionRow.ts
// Описание: Формирование объекта сессии для сохранения в IndexedDB
// ================================================================================

import { get } from 'svelte/store';
import { searchStore } from './search.store';
import type { SessionRow } from '$lib/db/types';

export function buildSearchSessionRow(): SessionRow {
  const s = get(searchStore);
  const now = new Date().toISOString();

  // Для поиска нам не нужны chatTree и chatParts, поэтому передаем заглушки
  return {
    id: s.sessionId!,
    mode: 'search',
    title: s.title || 'Новый поиск',
    selectedItems: null,
    generatedScript: '',
    chatTree: { branches: [], activeBranchIndex: 0 },
    chatParts: [],
    currentPartIndex: 0,
    searchData: searchStore.toSearchData(),
    createdAt: now, 
    updatedAt: now
  };
}