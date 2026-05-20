<!-- ================================================================================
ФАЙЛ: src/lib/components/story-catalog/StoryFiltersBar.svelte
Описание: Премиальная панель поиска, сортировки и фильтрации
================================================================================ -->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { StoryMode, StoryFilters } from '$lib/domain/story-catalog/storyCatalog.types';

  type Props = {
    filters: StoryFilters;
    allGenres: string[];
    allTags: string[];
    totalCount: number;
    
    onSearch: (q: string) => void;
    onModeChange: (m: StoryMode | 'all') => void;
    onGenreToggle: (g: string) => void;
    onTagToggle: (t: string) => void;
    onFeaturedToggle: () => void;
    onSortChange: (s: 'order' | 'new' | 'title') => void;
    onClearAll: () => void;
  };

  let {
    filters,
    allGenres = [],
    allTags = [],
    totalCount = 0,
    onSearch,
    onModeChange,
    onGenreToggle,
    onTagToggle,
    onFeaturedToggle,
    onSortChange,
    onClearAll
  }: Props = $props();

  // Локальный стейт поиска
  let searchValue = $state(filters.search);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Раскрытие панели дополнительных фильтров
  let isFiltersOpen = $state(false);

  // Подсчет активных фильтров (для бейджика на кнопке)
  let activeFiltersCount = $derived(
    filters.genres.length + 
    filters.tags.length + 
    (filters.featuredOnly ? 1 : 0)
  );

  $effect(() => {
    // Запоминаем значение из стора до вызова untrack
    const externalSearch = filters.search; 
    
    untrack(() => {
      // Обновляем локальное значение только если поиск изменился извне 
      // (например, при нажатии на кнопку "Сбросить все фильтры")
      if (externalSearch !== searchValue) {
        searchValue = externalSearch;
      }
    });
  });

  function handleInput(v: string) {
    searchValue = v;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => onSearch(searchValue), 300);
  }

  function clearSearch() {
    searchValue = '';
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
    onSearch('');
  }

  function handleClearAll() {
    onClearAll();
    isFiltersOpen = false; // Закрываем панель при сбросе
  }

  onDestroy(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  const modes: Array<{ id: StoryMode | 'all', label: string, icon: string }> = [
    { id: 'all', label: 'Все', icon: 'fa-layer-group' },
    { id: 'roleplay', label: 'Чат', icon: 'fa-comments' },
    { id: 'hero', label: 'Герой', icon: 'fas fa-gamepad' },
    { id: 'team', label: 'Команда', icon: 'fas fa-people-roof' }
  ];

  const sortOptions = [
    { id: 'order', label: 'По умолчанию' },
    { id: 'new', label: 'Сначала новые' },
    { id: 'title', label: 'По алфавиту' }
  ];
</script>

<div class="filters-container">
  
  <!-- ================= ВЕРХНЯЯ ПАНЕЛЬ (Всегда видима) ================= -->
  <div class="toolbar-main">
    
    <!-- 1. Поиск -->
    <div class="search-box">
      <i class="fas fa-search search-icon"></i>
      <input
        class="search-input"
        type="text"
        placeholder="Найти историю..."
        bind:value={searchValue}
        oninput={(e) => handleInput(e.currentTarget.value)}
      />
      {#if searchValue}
        <button class="clear-btn" type="button" aria-label="Очистить" onclick={clearSearch}>
          <i class="fas fa-times-circle"></i>
        </button>
      {/if}
    </div>

    <!-- 2. Вкладки режимов (Segmented Control) -->
    <div class="mode-tabs">
      {#each modes as m}
        <button 
          class="mode-tab {filters.mode === m.id ? 'active' : ''}" 
          type="button"
          onclick={() => onModeChange(m.id)}
        >
          <i class="fas {m.icon}"></i>
          <span class="tab-label">{m.label}</span>
        </button>
      {/each}
    </div>

    <!-- 3. Элементы управления (Сортировка и Кнопка фильтров) -->
    <div class="controls-group">
      
      <!-- Сортировка -->
      <div class="sort-wrapper">
        <i class="fas fa-sort-amount-down sort-icon"></i>
        <select 
          class="sort-select" 
          value={filters.sortBy} 
          onchange={(e) => onSortChange(e.currentTarget.value as any)}
        >
          {#each sortOptions as s}
            <option value={s.id}>{s.label}</option>
          {/each}
        </select>
      </div>

      <!-- Кнопка открытия панели тегов -->
      <button 
        class="toggle-filters-btn {isFiltersOpen || activeFiltersCount > 0 ? 'active' : ''}" 
        type="button" 
        onclick={() => isFiltersOpen = !isFiltersOpen}
      >
        <i class="fas fa-sliders-h"></i>
        <span class="hide-on-mobile">Фильтры</span>
        {#if activeFiltersCount > 0}
          <span class="filter-badge">{activeFiltersCount}</span>
        {/if}
        <i class="fas fa-chevron-{isFiltersOpen ? 'up' : 'down'} chevron"></i>
      </button>

    </div>
  </div>

  <!-- ================= ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ ТЕГОВ ================= -->
  {#if isFiltersOpen}
    <div class="advanced-filters" transition:slide={{ duration: 250 }}>
      <div class="advanced-filters-inner">
        
        <!-- Секция: Выбор редакции -->
        <div class="filter-section">
          <button 
            class="featured-toggle {filters.featuredOnly ? 'active' : ''}" 
            type="button" 
            onclick={onFeaturedToggle}
          >
            <div class="featured-icon"><i class="fas fa-star"></i></div>
            <div class="featured-text">
              <strong>Выбор редакции</strong>
              <span>Только лучшие и проверенные истории</span>
            </div>
            <div class="featured-checkbox">
              {#if filters.featuredOnly}<i class="fas fa-check"></i>{/if}
            </div>
          </button>
        </div>

        <div class="filter-columns">
          <!-- Секция: Жанры -->
          {#if allGenres.length > 0}
            <div class="filter-section">
              <h4 class="section-title">Жанры</h4>
              <div class="tags-wrap">
                {#each allGenres as g (g)}
                  <button 
                    class="pill pill-genre {filters.genres.includes(g) ? 'active' : ''}" 
                    type="button" 
                    onclick={() => onGenreToggle(g)}
                  >
                    {g}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Секция: Теги -->
          {#if allTags.length > 0}
            <div class="filter-section">
              <h4 class="section-title">Теги</h4>
              <div class="tags-wrap">
                {#each allTags as t (t)}
                  <button 
                    class="pill pill-tag {filters.tags.includes(t) ? 'active' : ''}" 
                    type="button" 
                    onclick={() => onTagToggle(t)}
                  >
                    #{t}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Подвал панели (Сброс) -->
        {#if activeFiltersCount > 0}
          <div class="advanced-footer">
            <button class="btn-reset" type="button" onclick={handleClearAll}>
              <i class="fas fa-trash-alt"></i> Сбросить все фильтры
            </button>
          </div>
        {/if}

      </div>
    </div>
  {/if}

  <!-- ================= СТАТИСТИКА (Счетчик) ================= -->
  <div class="results-summary">
    Найдено историй: <strong>{totalCount}</strong>
  </div>

</div>

<style>
  /* === ГЛАВНЫЙ КОНТЕЙНЕР === */
  .filters-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: var(--space-5);
    background: var(--bg-surface-1);
    border-radius: var(--radius-xl);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-sm);
    overflow: hidden; /* Чтобы углы не торчали */
  }

  /* === ВЕРХНЯЯ ПАНЕЛЬ (TOOLBAR) === */
  .toolbar-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface-2);
    flex-wrap: wrap;
  }

  /* 1. Поиск */
  .search-box {
    flex: 1;
    min-width: 200px;
    max-width: 350px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    color: var(--txt-muted);
    font-size: 14px;
  }

  .search-input {
    width: 100%;
    padding: 10px 36px;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    color: var(--txt-primary);
    font-size: 14px;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--txt-gold);
    background: var(--bg-surface-1);
    box-shadow: 0 0 0 2px rgba(196, 163, 90, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    color: var(--txt-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
  }
  .clear-btn:hover { color: var(--txt-primary); }

  /* 2. Вкладки режимов */
  .mode-tabs {
    display: flex;
    background: var(--bg-surface-3);
    padding: 4px;
    border-radius: var(--radius-full);
    border: 1px solid var(--glass-border);
  }

  .mode-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 11px;
    border-radius: var(--radius-full);
    background: transparent;
    border: none;
    color: var(--txt-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-tab:hover { color: var(--txt-primary); }

  .mode-tab.active {
    background: var(--bg-surface-1);
    color: var(--txt-primary);
    box-shadow: var(--shadow-sm);
  }

  .mode-tab.active i { color: var(--txt-gold); }

  /* 3. Элементы управления (Сортировка + Фильтры) */
  .controls-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-left: auto;
  }

  .sort-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .sort-icon {
    position: absolute;
    left: 12px;
    color: var(--txt-muted);
    pointer-events: none;
    font-size: 12px;
  }

  .sort-select {
    appearance: none;
    padding: 8px 32px 8px 32px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--txt-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .sort-select:hover {
    color: var(--txt-primary);
    background: var(--bg-surface-3);
  }

  .sort-select:focus {
    outline: none;
    border-color: var(--glass-border);
  }

  .toggle-filters-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    color: var(--txt-primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-filters-btn:hover { background: var(--bg-hover); }

  .toggle-filters-btn.active {
    border-color: var(--txt-gold);
    background: rgba(196, 163, 90, 0.05);
  }

  .filter-badge {
    background: var(--p-gold-500);
    color: var(--p-velvet-900);
    border-radius: 50%;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
  }

  .chevron { font-size: 10px; opacity: 0.6; }

  /* === ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ === */
  .advanced-filters {
    background: var(--bg-surface-1);
    border-top: 1px solid var(--glass-border);
  }

  .advanced-filters-inner {
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .filter-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }

  .section-title {
    margin: 0 0 var(--space-3) 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--txt-muted);
  }

  .tags-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Кнопки-пилюли */
  .pill {
    padding: 6px 14px;
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    color: var(--txt-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }

  .pill:hover {
    background: var(--bg-hover);
    color: var(--txt-primary);
    border-color: var(--txt-muted);
  }

  .pill.active {
    background: var(--txt-gold);
    color: var(--p-velvet-900);
    border-color: var(--txt-gold);
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(196, 163, 90, 0.3);
  }

  .pill-genre { border-radius: var(--radius-full); }

  /* Кнопка Рекомендуемое (Большая) */
  .featured-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    max-width: 400px;
    padding: var(--space-3);
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .featured-toggle:hover { border-color: var(--txt-gold); }

  .featured-toggle.active {
    background: rgba(196, 163, 90, 0.1);
    border-color: var(--txt-gold);
  }

  .featured-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-surface-3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--txt-muted);
    transition: all 0.2s;
  }

  .featured-toggle.active .featured-icon {
    background: var(--txt-gold);
    color: var(--p-velvet-900);
  }

  .featured-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .featured-text strong { color: var(--txt-primary); font-size: 14px; }
  .featured-text span { color: var(--txt-secondary); font-size: 12px; }

  .featured-checkbox {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s;
  }

  .featured-toggle.active .featured-checkbox {
    border-color: var(--txt-gold);
    color: var(--txt-gold);
  }

  /* Подвал панели (Сброс) */
  .advanced-footer {
    padding-top: var(--space-4);
    border-top: 1px dashed var(--glass-border);
    display: flex;
    justify-content: flex-end;
  }

  .btn-reset {
    background: transparent;
    border: none;
    color: var(--state-error);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }
  .btn-reset:hover { background: var(--state-error-bg); }

  /* === СТАТИСТИКА (Нижняя полоска) === */
  .results-summary {
    padding: 8px var(--space-4);
    background: var(--bg-surface-3);
    font-size: 12px;
    color: var(--txt-muted);
    border-top: 1px solid var(--glass-border);
    text-align: right;
  }
  .results-summary strong { color: var(--txt-primary); }

  /* ================= МОБИЛЬНАЯ АДАПТАЦИЯ ================= */
  @media (max-width: 900px) {
    .filter-columns {
      grid-template-columns: 1fr; /* Жанры и Теги друг под другом */
      gap: var(--space-2);
    }
  }

  @media (max-width: 768px) {
    .toolbar-main {
      flex-direction: column;
      align-items: stretch;
      padding: var(--space-3);
    }

    .search-box { max-width: 100%; }

    .mode-tabs {
      /* На мобилках вкладки скроллятся горизонтально, если не влезают */
      overflow-x: auto;
      justify-content: flex-start;
      padding-bottom: 2px;
    }
    .mode-tabs::-webkit-scrollbar { display: none; }

    .controls-group {
      justify-content: space-between;
      margin-left: 0;
      width: 100%;
    }

    .hide-on-mobile { display: none; } /* Прячем слово "Фильтры", оставляем иконку и бейдж */

    .advanced-filters-inner {
      padding: var(--space-3);
    }
  }
</style>