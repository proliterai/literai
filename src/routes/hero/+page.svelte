<!-- src/routes/hero/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { heroCatalogStore, STEP_CONFIG } from '$lib/domain/hero-catalog/heroCatalog.store';
  import { ui } from '$lib/ui/ui.store';
  import { goto } from '$app/navigation';
  
  // Глобальные сторы для сброса при входе
  import { heroSystemPromptStore } from '$lib/domain/hero-chat/heroSystemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
  import { eyeStore } from '$lib/domain/eye/eye.store'; 
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store'; // <-- ИМПОРТ ЧАТА

  // Компоненты UI
  import ProgressBar from '$lib/components/catalog/ProgressBar.svelte';
  import SearchBar from '$lib/components/catalog/SearchBar.svelte';
  import TagsBar from '$lib/components/catalog/TagsBar.svelte';
  import AlphabetBar from '$lib/components/catalog/AlphabetBar.svelte';
  import CatalogCard from '$lib/components/catalog/CatalogCard.svelte';
  import StepButtons from '$lib/components/catalog/StepButtons.svelte';
  import ImportExportBar from '$lib/components/catalog/ImportExportBar.svelte';
  
  // Модалки
  import CreateItemModal from '$lib/components/catalog/CreateItemModal.svelte';
  import EditItemModal from '$lib/components/catalog/EditItemModal.svelte';
  import InfoModal from '$lib/components/catalog/InfoModal.svelte';
  import ConfirmModal from '$lib/components/catalog/ConfirmModal.svelte';
  import type { CatalogItemRow } from '$lib/db/types';

  let c = $derived($heroCatalogStore);
  
  // Состояния видимости модальных окон
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showInfoModal = $state(false);
  let showConfirmModal = $state(false);
  
  // Выбранные элементы для модалок
  let selectedItemForInfo = $state<CatalogItemRow | null>(null);
  let selectedItemForEdit = $state<CatalogItemRow | null>(null);
  let selectedItemForDelete = $state<CatalogItemRow | null>(null);
  
  let createModalType = $state<'character' | 'role' | 'scene'>('character');
  let scroller = $state<HTMLDivElement | null>(null);

  onMount(async () => {
    // 1. Очищаем глобальные настройки и оперативную память перед новой игрой
    heroSystemPromptStore.importData(null);
    cheatmodeStore.importData(null);
    lorebookStore.importData(null);
    eyeStore.importData(null); 
    memoryBookStore.importData(null);
    heroChatStore.reset(); // <-- ЖЕСТКАЯ ОЧИСТКА ЧАТА В ОЗУ

    // 2. Сбрасываем выбранные ранее карточки в каталоге
    heroCatalogStore.resetCatalog();

    // 3. Инициализируем каталог
    await heroCatalogStore.init();
  });

  function getStepConfig(step: number) {
    return STEP_CONFIG[step as keyof typeof STEP_CONFIG];
  }

  function selectItem(step: number, item: CatalogItemRow) {
    heroCatalogStore.select(step as any, item);
  }

  function handleSearch(query: string) {
    heroCatalogStore.setSearch(c.step, query);
  }

  function handleClearSearch() {
    heroCatalogStore.clearFilters(c.step);
  }

  function handleTagToggle(tag: string) {
    heroCatalogStore.toggleTag(c.step, tag);
  }

  function handleAllTags() {
    heroCatalogStore.clearFilters(c.step);
  }

  function handleNewTags() {
    heroCatalogStore.toggleNew(c.step);
  }

  function handleCustomTags() {
    heroCatalogStore.toggleCustom(c.step);
  }

  async function handleLetterPick(letter: string) {
    await heroCatalogStore.ensureLetterVisible(c.step, letter);
    setTimeout(() => {
      const firstCard = document.querySelector(`[data-first-letter="${letter}"]`);
      if (firstCard && scroller) {
        scroller.scrollTo({
          top: (firstCard as HTMLElement).offsetTop - scroller.offsetTop - 10,
          behavior: 'smooth'
        });
      }
    }, 200);
  }

  function handleBack() {
    if (c.step > 1) heroCatalogStore.setStep((c.step - 1) as any);
  }

  function handleNext() {
    if (c.step < 3 && c.selections[c.step]) heroCatalogStore.setStep((c.step + 1) as any);
  }

  async function handleStart() {
    if (heroCatalogStore.isAllSelected()) {
      try {
        const sessionId = await heroCatalogStore.startSessionFromSelections();
        await goto(`/hero/chat/${sessionId}`);
      } catch (e: any) {
        ui.notify(e.message, 'error');
      }
    } else {
      ui.notify('Не все элементы выбраны', 'error');
    }
  }

  // --- Создание ---
  function handleCreateClick() {
    createModalType = getStepConfig(c.step).type as any;
    showCreateModal = true;
  }

  async function handleCreateSubmit(data: any) {
    try {
      await heroCatalogStore.addItem(createModalType, data, c.step as any);
      showCreateModal = false;
    } catch (e: any) {
      ui.notify(e.message, 'error');
    }
  }

  // --- Информация и Редактирование ---
  function handleInfoClick(item: CatalogItemRow) {
    selectedItemForInfo = item;
    showInfoModal = true;
  }

  function handleEditClick() {
    selectedItemForEdit = selectedItemForInfo;
    showInfoModal = false; 
    showEditModal = true;  
  }

  async function handleEditSubmit(id: string, data: any) {
    try {
      await heroCatalogStore.editItem(id, data);
      showEditModal = false;
      selectedItemForEdit = null;
    } catch (e: any) {
      ui.notify(e.message, 'error');
    }
  }

  // --- Удаление ---
  function handleDeleteClick(item: CatalogItemRow) {
    selectedItemForDelete = item;
    showConfirmModal = true;
  }

  async function confirmDelete() {
    if (selectedItemForDelete) {
      try {
        await heroCatalogStore.deleteItem(selectedItemForDelete.id);
      } catch (e: any) {
        ui.notify(e.message, 'error');
      }
    }
    showConfirmModal = false;
    selectedItemForDelete = null;
  }

  // --- Импорт / Экспорт ---
  async function handleExport() {
    try {
      const data = await heroCatalogStore.exportUserCards();
      downloadJson(data, `hero_catalog_export_${new Date().toISOString().slice(0, 10)}.json`);
      ui.notify(`Экспортировано ${data.items.length} карточек`, 'success');
    } catch (e: any) {
      ui.notify('Ошибка экспорта: ' + e.message, 'error');
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await heroCatalogStore.importUserCards(json);
      ui.notify(
        `Импортировано: ${result.added}, пропущено: ${result.skipped}`,
        result.added > 0 ? 'success' : 'info'
      );
    } catch (e: any) {
      ui.notify('Ошибка импорта: ' + e.message, 'error');
    }
  }

  function downloadJson(obj: any, filename: string) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Скролл и получение данных ---
  function handleScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    const threshold = 200;
    const runtime = c.runtime?.[c.step];

    if (!runtime || runtime.isLoading || !runtime.hasMore) return;

    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      heroCatalogStore.loadMore(c.step);
    }
  }

  function getFilteredItems() {
    return c.runtime?.[c.step]?.items || [];
  }

  function getLetters() {
    return heroCatalogStore.getLettersForStep(c.step as any);
  }

  function getTags() {
    return heroCatalogStore.getTagsForStep(c.step as any);
  }

  function hasCustom() {
    return heroCatalogStore.hasCustomForStep(c.step as any);
  }

  function getFilters() {
    return heroCatalogStore.getFilters(c.step as any);
  }
</script>

<div class="catalog-root">
  <h2 class="catalog-title">
    <i class="fas fa-gamepad"></i> Игра за героя
  </h2>

  <ProgressBar
    total={3}
    current={c.step}
    selected={c.selections}
    onPick={(step) => heroCatalogStore.setStep(step as any)}
  />

  {#each [1, 2, 3] as stepNum}
    {#if c.step === stepNum}
      {@const cfg = getStepConfig(stepNum)}
      {@const filters = getFilters()}
      {@const items = getFilteredItems()}
      {@const isLoading = c.runtime?.[stepNum]?.isLoading}
      {@const hasMore = c.runtime?.[stepNum]?.hasMore}

      <div class="catalog-step" data-step={stepNum}>
        <h3 class="step-title">
          <i class="fas {cfg.icon}"></i> {cfg.title}
        </h3>

        <SearchBar
          value={filters?.search ?? ''}
          placeholder="Поиск..."
          onSearch={handleSearch}
          onClear={handleClearSearch}
          countText={`Найдено: ${items.length}`}
        />

        <TagsBar
          allTags={getTags()}
          selectedTags={filters?.selectedTags ?? []}
          sortByDate={filters?.sortByDate ?? false}
          onlyCustom={filters?.onlyCustom ?? false}
          hasCustom={hasCustom()}
          onAll={handleAllTags}
          onNew={handleNewTags}
          onCustom={handleCustomTags}
          onToggleTag={handleTagToggle}
        />

        {#if !filters?.sortByDate}
          <AlphabetBar
            letters={getLetters()}
            active={filters?.activeLetter ?? null}
            onPick={handleLetterPick}
          />
        {/if}

        <div
          class="catalog-scroll"
          bind:this={scroller}
          onscroll={handleScroll}
        >
          <div class="catalog-results">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="create-card" onclick={handleCreateClick}>
              <div class="create-card-icon">➕</div>
              <div class="create-card-text">
                {cfg.type === 'character' ? 'Создать персонажа' :
                 cfg.type === 'role' ? 'Создать роль' : 'Создать сцену'}
              </div>
            </div>

            <ImportExportBar onExport={handleExport} onImport={handleImport} />

            {#if items.length === 0 && !isLoading}
              <div class="no-results">
                <i class="fas fa-search"></i>
                <p>Ничего не найдено</p>
                <button class="reset-filters-btn" type="button" onclick={handleClearSearch}>
                  Сбросить фильтры
                </button>
              </div>
            {:else}
              {#each items as item (item.id)}
                {@const firstLetter = (item.name || '#')[0].toUpperCase()}
                <div data-first-letter={firstLetter}>
                  <CatalogCard
                    item={item}
                    selected={c.selections?.[stepNum]?.id === item.id}
                    hasAvatar={cfg.hasAvatar}
                    onselect={() => selectItem(stepNum, item)}
                    oninfo={() => handleInfoClick(item)}
                    ondel={() => handleDeleteClick(item)}
                  />
                </div>
              {/each}

              {#if isLoading}
                <div class="loading-spinner">
                  <i class="fas fa-spinner fa-spin"></i> Загрузка...
                </div>
              {/if}

              {#if !hasMore && items.length > 0}
                <div class="end-of-list">
                  <i class="fas fa-check-circle"></i> Все карточки загружены
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <StepButtons
          step={stepNum}
          total={3}
          canProceed={!!c.selections?.[stepNum]}
          onBack={handleBack}
          onNext={handleNext}
          onStart={handleStart}
        />
      </div>
    {/if}
  {/each}
</div>

<!-- Модалки -->
{#if showCreateModal}
  <CreateItemModal
    type={createModalType}
    onClose={() => showCreateModal = false}
    onsubmitItem={handleCreateSubmit}
    onnotify={(data) => ui.notify(data.message, data.type)}
  />
{/if}

{#if showInfoModal && selectedItemForInfo}
  <InfoModal
    item={selectedItemForInfo}
    onClose={() => { showInfoModal = false; selectedItemForInfo = null; }}
    onEdit={handleEditClick}  
  />
{/if}

{#if showEditModal && selectedItemForEdit}
  <EditItemModal
    item={selectedItemForEdit}
    onClose={() => { showEditModal = false; selectedItemForEdit = null; }}
    onSave={handleEditSubmit}
    onnotify={(data) => ui.notify(data.message, data.type)}
  />
{/if}

{#if showConfirmModal && selectedItemForDelete}
  <ConfirmModal
    title={`Удалить «${selectedItemForDelete.name}»?`}
    message="Это действие нельзя отменить."
    confirmText="Удалить"
    onCancel={() => { showConfirmModal = false; selectedItemForDelete = null; }}
    onConfirm={confirmDelete}
  />
{/if}

<style>
  .loading-spinner {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-4);
    color: var(--txt-muted);
    font-size: var(--font-size-sm);
  }

  .loading-spinner i {
    margin-right: var(--space-2);
    color: var(--txt-gold);
  }

  .end-of-list {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-4);
    color: var(--txt-muted);
    font-size: var(--font-size-sm);
    opacity: 0.7;
  }

  .end-of-list i {
    margin-right: var(--space-2);
    color: var(--state-success);
  }
</style>