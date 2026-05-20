// ================================================================================
// ФАЙЛ: src/lib/domain/story-catalog/storyCatalog.store.ts
// Описание: Хранилище состояния каталога историй (загрузка, фильтрация, запуск)
// ================================================================================

import { writable, get } from 'svelte/store';
import type { StoryCatalogState, StoryMode } from './storyCatalog.types';
import { storyCatalogService } from './storyCatalog.service';

const initialState: StoryCatalogState = {
  ready: false,
  items: [],
  filteredItems: [],
  filters: {
    search: '',
    mode: 'all',
    genres: [],
    tags: [],
    featuredOnly: false,
    sortBy: 'order'
  },
  isLoading: false,
  error: null,
  allGenres: [],
  allTags: []
};

// Внутренняя функция для применения фильтров к массиву
function applyFilters(state: StoryCatalogState): StoryCatalogState {
  let result = state.items;

  // 1. Поиск по тексту
  if (state.filters.search.trim()) {
    const q = state.filters.search.toLowerCase().trim();
    result = result.filter(
      (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }

  // 2. Фильтр по режиму
  if (state.filters.mode !== 'all') {
    result = result.filter((i) => i.mode === state.filters.mode);
  }

  // 3. Фильтр по жанрам (И логика: карточка должна содержать ВСЕ выбранные жанры)
  if (state.filters.genres.length > 0) {
    result = result.filter((i) =>
      state.filters.genres.every((g) => i.genres.includes(g))
    );
  }

  // 4. Фильтр по тегам
  if (state.filters.tags.length > 0) {
    result = result.filter((i) =>
      state.filters.tags.every((t) => i.tags.includes(t))
    );
  }

  // 5. Только рекомендуемые
  if (state.filters.featuredOnly) {
    result = result.filter((i) => i.featured);
  }

  // 6. Сортировка
  result.sort((a, b) => {
    if (state.filters.sortBy === 'title') {
      return a.title.localeCompare(b.title, 'ru');
    }
    
        if (state.filters.sortBy === 'new') {
      // Сравниваем реальные даты создания (новые сверху)
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA;
    }

    // По умолчанию: sortBy === 'order'
    // Сначала показываем featured (рекомендуемые), затем сортируем по order
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.order - b.order;
  });

  return { ...state, filteredItems: result };
}

export function createStoryCatalogStore() {
  const store = writable<StoryCatalogState>(initialState);
  const { subscribe, update, set } = store;

  return {
    subscribe,

    /**
     * Инициализация каталога: скачивает manifest.json и подготавливает списки
     */
    async init() {
      const state = get(store);
      if (state.ready) return; // Уже загружено

      update(s => ({ ...s, isLoading: true, error: null }));

      const manifest = await storyCatalogService.loadManifest();

      if (!manifest) {
        update(s => ({
          ...s,
          isLoading: false,
          error: 'Не удалось загрузить каталог историй. Проверьте подключение к интернету.'
        }));
        return;
      }

      // Собираем все уникальные жанры и теги для UI фильтров
      const genresSet = new Set<string>();
      const tagsSet = new Set<string>();

      manifest.stories.forEach(story => {
        story.genres.forEach(g => genresSet.add(g));
        story.tags.forEach(t => tagsSet.add(t));
      });

      update(s => {
        const nextState = {
          ...s,
          ready: true,
          isLoading: false,
          items: manifest.stories,
          allGenres: Array.from(genresSet).sort((a, b) => a.localeCompare(b, 'ru')),
          allTags: Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'ru')),
          error: null
        };
        // Сразу применяем фильтры (по умолчанию), чтобы заполнить filteredItems
        return applyFilters(nextState);
      });
    },

    // ========================================================================
    // МЕТОДЫ ФИЛЬТРАЦИИ
    // ========================================================================

    setSearch(query: string) {
      update(s => applyFilters({ ...s, filters: { ...s.filters, search: query } }));
    },

    setMode(mode: StoryMode | 'all') {
      update(s => applyFilters({ ...s, filters: { ...s.filters, mode } }));
    },

    toggleGenre(genre: string) {
      update(s => {
        const current = s.filters.genres.slice();
        const idx = current.indexOf(genre);
        if (idx === -1) current.push(genre);
        else current.splice(idx, 1);
        return applyFilters({ ...s, filters: { ...s.filters, genres: current } });
      });
    },

    toggleTag(tag: string) {
      update(s => {
        const current = s.filters.tags.slice();
        const idx = current.indexOf(tag);
        if (idx === -1) current.push(tag);
        else current.splice(idx, 1);
        return applyFilters({ ...s, filters: { ...s.filters, tags: current } });
      });
    },

    toggleFeatured() {
      update(s => applyFilters({ ...s, filters: { ...s.filters, featuredOnly: !s.filters.featuredOnly } }));
    },

    setSortBy(sortBy: 'order' | 'new' | 'title') {
      update(s => applyFilters({ ...s, filters: { ...s.filters, sortBy } }));
    },

    resetFilters() {
      update(s => applyFilters({
        ...s,
        filters: {
          search: '',
          mode: 'all',
          genres: [],
          tags: [],
          featuredOnly: false,
          sortBy: 'order'
        }
      }));
    },

    // ========================================================================
    // ЗАПУСК ИСТОРИИ
    // ========================================================================

    /**
     * Обертка над сервисом запуска.
     * Позволяет включить глобальный спиннер загрузки в UI каталога.
     */
    async launchStory(sessionPath: string) {
      update(s => ({ ...s, isLoading: true }));
      
      const success = await storyCatalogService.startStoryFromTemplate(sessionPath);
      
      // Если неудача, просто отключаем спиннер (уведомление об ошибке уже выведет сервис)
      if (!success) {
        update(s => ({ ...s, isLoading: false }));
      }
      // В случае успеха мы уже будем на другой странице (редирект в сервисе),
      // но на всякий случай тоже снимаем лоадинг.
      update(s => ({ ...s, isLoading: false }));
    }
  };
}

export const storyCatalogStore = createStoryCatalogStore();