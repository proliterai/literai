// ================================================================================
// ФАЙЛ: src/lib/domain/story-catalog/storyCatalog.types.ts
// Описание: Типы данных для модуля каталога готовых историй
// ================================================================================

export type StoryMode = 'roleplay' | 'hero' | 'team';

/**
 * Структура одной карточки истории в файле manifest.json
 */
export interface StoryManifestItem {
  id: string;
  title: string;
  description: string;
createdAt: string;
  mode: StoryMode;
  genres: string[];
  tags: string[];
  cover: string;          // Путь к картинке (напр. /data/story-catalog/covers/forest.webp)
  sessionPath: string;    // Путь к JSON шаблону (напр. /data/story-catalog/sessions/forest.json)
  featured: boolean;      // Показывать ли в блоке "Рекомендуемое"
  author: string;         // 'official' или имя автора
authorLink?: string;
  order: number;          // Приоритет сортировки (чем меньше, тем выше)
}

/**
 * Структура корневого файла manifest.json
 */
export interface StoryManifest {
  version: string;
  updatedAt: string;
  stories: StoryManifestItem[];
}

/**
 * Настройки фильтрации, которые выбирает пользователь в UI
 */
export interface StoryFilters {
  search: string;
  mode: StoryMode | 'all';
  genres: string[];
  tags: string[];
  featuredOnly: boolean;
  sortBy: 'order' | 'new' | 'title';
}

/**
 * Состояние Svelte-стора для каталога историй
 */
export interface StoryCatalogState {
  ready: boolean;                      // Манифест успешно загружен
  items: StoryManifestItem[];          // Все истории из манифеста
  filteredItems: StoryManifestItem[];  // Истории после применения фильтров
  filters: StoryFilters;               // Текущие фильтры
  isLoading: boolean;                  // Индикатор загрузки шаблона
  error: string | null;                // Текст ошибки, если манифест не скачался
  
  // Списки для рендера кнопок фильтров в UI (собираются динамически из items)
  allGenres: string[];
  allTags: string[];
}