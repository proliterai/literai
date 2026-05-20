<!-- ================================================================================
ФАЙЛ: src/routes/stories/+page.svelte
Описание: Страница каталога готовых историй
================================================================================ -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { storyCatalogStore } from '$lib/domain/story-catalog/storyCatalog.store';
  import type { StoryManifestItem } from '$lib/domain/story-catalog/storyCatalog.types';
  import { ui } from '$lib/ui/ui.store';

  // Компоненты
  import StoryFiltersBar from '$lib/components/story-catalog/StoryFiltersBar.svelte';
  import StoryCard from '$lib/components/story-catalog/StoryCard.svelte';
  import StoryInfoModal from '$lib/components/story-catalog/StoryInfoModal.svelte';

  // Подписка на хранилище каталога историй
  let s = $derived($storyCatalogStore);

  // Состояние модального окна
  let showInfoModal = $state(false);
  let selectedStory = $state<StoryManifestItem | null>(null);

  // Инициализация (загрузка manifest.json)
  onMount(async () => {
    await storyCatalogStore.init();
  });

  // Обработчики открытия модалки
  function handleInfoClick(story: StoryManifestItem) {
    selectedStory = story;
    showInfoModal = true;
  }

  function handleCloseModal() {
    showInfoModal = false;
    selectedStory = null;
  }

  // Запуск истории (срабатывает и из карточки, и из модалки)
  async function handleLaunch(story: StoryManifestItem) {
    // Вызываем запуск. Стор сам выставит s.isLoading = true
    await storyCatalogStore.launchStory(story.sessionPath);
  }
</script>

<div class="stories-page">
  <div class="stories-container">
    
    <!-- ЗАГОЛОВОК СТРАНИЦЫ -->
    <header class="page-header">
      <h1 class="page-title"><i class="fas fa-compass"></i> Каталог историй</h1>
      <p class="page-subtitle">Готовые сценарии и миры для ваших приключений.</p>
    </header>

    <!-- СОСТОЯНИЕ: ОШИБКА -->
    {#if s.error}
      <div class="state-container error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>{s.error}</p>
        <button class="btn-primary" onclick={() => storyCatalogStore.init()}>
          <i class="fas fa-sync-alt"></i> Повторить
        </button>
      </div>

    <!-- СОСТОЯНИЕ: ПЕРВИЧНАЯ ЗАГРУЗКА (Манифест) -->
    {:else if !s.ready}
      <div class="state-container loading-state">
        <div class="spinner"></div>
        <p>Загрузка библиотеки историй...</p>
      </div>

    <!-- СОСТОЯНИЕ: ГОТОВО -->
    {:else}
      
      <!-- ПАНЕЛЬ ФИЛЬТРОВ -->
      <StoryFiltersBar 
        filters={s.filters}
        allGenres={s.allGenres}
        allTags={s.allTags}
        totalCount={s.filteredItems.length}
        
        onSearch={storyCatalogStore.setSearch}
        onModeChange={storyCatalogStore.setMode}
        onGenreToggle={storyCatalogStore.toggleGenre}
        onTagToggle={storyCatalogStore.toggleTag}
        onFeaturedToggle={storyCatalogStore.toggleFeatured}
        onSortChange={storyCatalogStore.setSortBy}
        onClearAll={storyCatalogStore.resetFilters}
      />

      <!-- СЕТКА КАРТОЧЕК -->
      {#if s.filteredItems.length === 0}
        <div class="state-container empty-state">
          <i class="fas fa-search"></i>
          <p>По вашему запросу историй не найдено.</p>
          <button class="btn-secondary" onclick={storyCatalogStore.resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      {:else}
        <div class="stories-grid">
          {#each s.filteredItems as story (story.id)}
            <StoryCard 
              {story} 
              isLoading={s.isLoading} 
              oninfo={handleInfoClick} 
              onlaunch={handleLaunch} 
            />
          {/each}
        </div>
      {/if}

    {/if}
  </div>
</div>

<!-- МОДАЛКА ИНФОРМАЦИИ -->
{#if showInfoModal && selectedStory}
  <StoryInfoModal 
    story={selectedStory}
    isLoading={s.isLoading}
    onClose={handleCloseModal}
    onLaunch={handleLaunch}
  />
{/if}

<style>
  /* === БАЗОВЫЙ КОНТЕЙНЕР === */
  .stories-page {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--bg-app);
  }

  .stories-container {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* === ЗАГОЛОВОК === */
  .page-header {
    text-align: center;
    margin-bottom: var(--space-2);
  }

  .page-title {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    color: var(--txt-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .page-title i {
    color: var(--txt-gold);
    margin-right: var(--space-2);
  }

  .page-subtitle {
    font-size: var(--font-size-md);
    color: var(--txt-secondary);
    margin: 0;
  }

  /* === СЕТКА ИСТОРИЙ === */
  .stories-grid {
    display: grid;
    /* Адаптивная сетка: мин ширина карточки 300px, заполняют всё пространство */
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-5);
    padding-bottom: var(--space-8);
  }

  /* === СОСТОЯНИЯ (Ошибки, Загрузка, Пусто) === */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) var(--space-4);
    text-align: center;
    background: var(--bg-surface-2);
    border-radius: var(--radius-lg);
    border: 1px dashed var(--glass-border);
    margin-top: var(--space-6);
  }

  .state-container i {
    font-size: 3rem;
    margin-bottom: var(--space-4);
  }

  .state-container p {
    font-size: var(--font-size-md);
    color: var(--txt-secondary);
    margin: 0 0 var(--space-4) 0;
  }

  .error-state i { color: var(--state-error); }
  .error-state p { color: var(--state-error); }
  
  .empty-state i { color: var(--txt-muted); opacity: 0.5; }

  .loading-state {
    background: transparent;
    border: none;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--glass-border);
    border-top-color: var(--txt-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-4);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* === МОБИЛЬНАЯ АДАПТАЦИЯ === */
  @media (max-width: 768px) {
    .stories-container {
      padding: var(--space-4);
      gap: var(--space-4);
    }
    .page-title { font-size: var(--font-size-2xl); }
    .stories-grid {
      grid-template-columns: 1fr; /* На мобилках по одной в ряд */
    }
  }
</style>