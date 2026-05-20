// ================================================================================
// ФАЙЛ: src/lib/domain/catalog/catalog.types.ts
// Описание: Типы для каталога с поддержкой ленивой загрузки
// ================================================================================

import type { CatalogItemRow, CatalogItemType } from '$lib/db/types';

export type CatalogStep = 1 | 2 | 3 | 4 | 5;
export type StepType = CatalogItemType;

export type StepConfig = {
  step: CatalogStep;
  type: StepType;
  title: string;
  icon: string;
  pageSize: number;
  hasAvatar: boolean;
};

export type StepFilters = {
  search: string;
  selectedTags: string[];
  onlyCustom: boolean;
  sortByDate: boolean;
  activeLetter: string | null;
};

export type StepRuntime = {
  items: CatalogItemRow[];        // загруженные карточки (текущая страница + догруженные)
  allTags: string[];              // все возможные теги для этого шага
  allLetters: string[];           // все возможные первые буквы для этого шага
  hasMore: boolean;               // есть ли ещё страницы для загрузки
  isLoading: boolean;             // идёт ли загрузка
  page: number;                   // номер последней загруженной страницы (опционально)
};

export type CatalogSelections = {
  1: CatalogItemRow | null;
  2: CatalogItemRow | null;
  3: CatalogItemRow | null;
  4: CatalogItemRow | null;
  5: CatalogItemRow | null;
};

export type CatalogState = {
  ready: boolean;                 // готово ли хранилище (после seed и первой инициализации)
  step: CatalogStep;              // текущий шаг
  selections: CatalogSelections;  // выбранные элементы для каждого шага
  filters: Record<CatalogStep, StepFilters>;   // фильтры для каждого шага
  runtime: Record<CatalogStep, StepRuntime>;   // рантайм-данные для каждого шага
};