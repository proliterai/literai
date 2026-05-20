<!-- src/routes/team/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { teamCatalogStore, STEP_CONFIG } from '$lib/domain/team-catalog/teamCatalog.store';
  import { ui } from '$lib/ui/ui.store';
  import { goto } from '$app/navigation';
  
  // Сторы для сброса состояния при входе в каталог
  import { teamSystemPromptStore } from '$lib/domain/team-system-prompt/teamSystemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import { eyeStore } from '$lib/domain/eye/eye.store'; 
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import { teamChatStore } from '$lib/domain/team-chat/teamChat.store'; // <-- ИМПОРТ ЧАТА

  // Компоненты UI
  import ProgressBar from '$lib/components/catalog/ProgressBar.svelte';
  import SearchBar from '$lib/components/catalog/SearchBar.svelte';
  import TagsBar from '$lib/components/catalog/TagsBar.svelte';
  import AlphabetBar from '$lib/components/catalog/AlphabetBar.svelte';
  import TeamCharacterCard from '$lib/components/catalog/TeamCharacterCard.svelte';
  import CatalogCard from '$lib/components/catalog/CatalogCard.svelte';
  import StepButtons from '$lib/components/catalog/StepButtons.svelte';
  import ImportExportBar from '$lib/components/catalog/ImportExportBar.svelte';
  import CreateItemModal from '$lib/components/catalog/CreateItemModal.svelte';
  import InfoModal from '$lib/components/catalog/InfoModal.svelte';
  import ConfirmModal from '$lib/components/catalog/ConfirmModal.svelte';
  import EditItemModal from '$lib/components/catalog/EditItemModal.svelte';

  let c = $derived($teamCatalogStore);
  
  // Состояния модалок
  let showCreateModal = $state(false);
  let showInfoModal = $state(false);
  let showConfirmModal = $state(false);
  let showEditModal = $state(false);
  
  // Выбранные элементы для модалок
  let selectedItemForInfo = $state<any>(null);
  let selectedItemForDelete = $state<any>(null);
  let selectedItemForEdit = $state<any>(null);
  
  let createModalType = $state<'character' | 'scene'>('character');
  let scroller = $state<HTMLDivElement | null>(null);

  onMount(async () => {
    // 1. Очищаем глобальные настройки (чтобы не тянулись из прошлой сессии) и ОЗУ чата
    teamSystemPromptStore.importData(null);
    cheatmodeStore.importData(null);
    lorebookStore.importData(null);
    privateChatStore.importData(null);
    eyeStore.importData(null); 
    memoryBookStore.importData(null);
    teamChatStore.reset(); // <-- ЖЕСТКАЯ ОЧИСТКА ЧАТА В ОЗУ

    // 2. Сбрасываем выбранные ранее карточки
    teamCatalogStore.resetCatalog();

    // 3. Инициализируем каталог
    await teamCatalogStore.init();
  });

  function getStepConfig(step: number) {
    return STEP_CONFIG[step as keyof typeof STEP_CONFIG];
  }

  // Реактивные переменные
  let selectedCount = $derived(c.selections[1]?.length ?? 0);
  let allSelected = $derived(selectedCount > 0 && !!c.selections[2]);

  let currentFilters = $derived(c.filters?.[c.step]);
  let currentItems = $derived(c.runtime?.[c.step]?.items ?? []);
  let currentLetters = $derived(c.runtime?.[c.step]?.allLetters ?? []);
  let currentTags = $derived(c.runtime?.[c.step]?.allTags ?? []);
  let currentIsLoading = $derived(c.runtime?.[c.step]?.isLoading ?? false);
  let currentHasMore = $derived(c.runtime?.[c.step]?.hasMore ?? true);

  function isSelected(step: number, item: any): boolean {
    if (step === 1) {
      return c.selections[1]?.some((char) => char.id === item.id) ?? false;
    }
    return c.selections[2]?.id === item.id;
  }

  // --- Действия ---

  function handleItemClick(step: number, item: any) {
    if (step === 1) {
      teamCatalogStore.toggleCharacter(item);
    } else {
      teamCatalogStore.select(step as any, item);
    }
  }

  function handleSearch(query: string) {
    teamCatalogStore.setSearch(c.step, query);
  }

  function handleClearSearch() {
    teamCatalogStore.clearFilters(c.step);
  }

  function handleTagToggle(tag: string) {
    teamCatalogStore.toggleTag(c.step, tag);
  }

  function handleAllTags() {
    teamCatalogStore.clearFilters(c.step);
  }

  function handleNewTags() {
    teamCatalogStore.toggleNew(c.step);
  }

  function handleCustomTags() {
    teamCatalogStore.toggleCustom(c.step);
  }

  async function handleLetterPick(letter: string) {
    await teamCatalogStore.ensureLetterVisible(c.step, letter);
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
    if (c.step > 1) teamCatalogStore.setStep((c.step - 1) as any);
  }

  function handleNext() {
    if (c.step === 1) {
      if (selectedCount > 0 && selectedCount <= 10) {
        teamCatalogStore.setStep(2);
      } else {
        ui.notify('Выберите от 1 до 10 персонажей', 'warning');
      }
    } else if (c.step === 2 && c.selections[2]) {
      teamCatalogStore.setStep(1);
    }
  }

  async function handleStart() {
    if (allSelected) {
      try {
        const sessionId = await teamCatalogStore.startSessionFromSelections();
        await goto(`/team/chat/${sessionId}`);
      } catch (e: any) {
        ui.notify(e.message, 'error');
      }
    } else {
      ui.notify('Выберите персонажей и сцену', 'error');
    }
  }

  // --- Создание ---
  function handleCreateClick() {
    createModalType = getStepConfig(c.step).type as any;
    showCreateModal = true;
  }

  async function handleCreateSubmit(data: any) {
    try {
      await teamCatalogStore.addItem(createModalType, data, c.step as any);
      showCreateModal = false;
    } catch (e: any) {
      ui.notify(e.message, 'error');
    }
  }

  // --- Редактирование ---
  function handleEditClick() {
    selectedItemForEdit = selectedItemForInfo;
    showInfoModal = false;
    showEditModal = true; 
  }

  async function handleEditSubmit(id: string, data: any) {
    try {
      await teamCatalogStore.editItem(id, data);
      showEditModal = false;
      selectedItemForEdit = null;
    } catch (e: any) {
      ui.notify(e.message, 'error');
    }
  }

  // --- Информация и Удаление ---
  function handleInfoClick(item: any) {
    selectedItemForInfo = item;
    showInfoModal = true;
  }

  function handleDeleteClick(item: any) {
    selectedItemForDelete = item;
    showConfirmModal = true;
  }

  async function confirmDelete() {
    if (selectedItemForDelete) {
      try {
        await teamCatalogStore.deleteItem(selectedItemForDelete.id);
      } catch (e: any) {
        ui.notify(e.message, 'error');
      }
    }
    showConfirmModal = false;
    selectedItemForDelete = null;
  }

  // --- Экспорт / Импорт ---
  async function handleExport() {
    try {
      const data = await teamCatalogStore.exportUserCards();
      downloadJson(data, `catalog_export_${new Date().toISOString().slice(0, 10)}.json`);
      ui.notify(`Экспортировано ${data.items.length} карточек`, 'success');
    } catch (e: any) {
      ui.notify('Ошибка экспорта: ' + e.message, 'error');
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await teamCatalogStore.importUserCards(json);
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

  function handleScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    const threshold = 200;

    if (currentIsLoading || !currentHasMore) return;

    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      teamCatalogStore.loadMore(c.step);
    }
  }
</script>

<div class="catalog-root">
  <h2 class="catalog-title">
    <i class="fas fa-users"></i> Игра за команду
  </h2>

  <ProgressBar
    total={2}
    current={c.step}
    selected={{
      1: selectedCount > 0 ? { id: 'dummy' } : null,
      2: c.selections[2]
    }}
    onPick={(step) => teamCatalogStore.setStep(step as any)}
  />

  {#each [1, 2] as stepNum}
    {#if c.step === stepNum}
      {@const cfg = getStepConfig(stepNum)}

      <div class="catalog-step" data-step={stepNum}>
        <h3 class="step-title">
          <i class="fas {cfg.icon}"></i> {cfg.title}
          {#if stepNum === 1}
            <span class="selected-count">Выбрано: {selectedCount}/10</span>
          {/if}
        </h3>

        <SearchBar
          value={currentFilters?.search ?? ''}
          placeholder="Поиск..."
          onSearch={handleSearch}
          onClear={handleClearSearch}
          countText={`Найдено: ${currentItems.length}`}
        />

        <TagsBar
          allTags={currentTags}
          selectedTags={currentFilters?.selectedTags ?? []}
          sortByDate={currentFilters?.sortByDate ?? false}
          onlyCustom={currentFilters?.onlyCustom ?? false}
          hasCustom={true}
          onAll={handleAllTags}
          onNew={handleNewTags}
          onCustom={handleCustomTags}
          onToggleTag={handleTagToggle}
        />

        {#if !currentFilters?.sortByDate}
          <AlphabetBar
            letters={currentLetters}
            active={currentFilters?.activeLetter ?? null}
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
                {cfg.type === 'character' ? 'Создать персонажа' : 'Создать сцену'}
              </div>
            </div>

            <ImportExportBar onExport={handleExport} onImport={handleImport} />

            {#if currentItems.length === 0 && !currentIsLoading}
              <div class="no-results">
                <i class="fas fa-search"></i>
                <p>Ничего не найдено</p>
                <button class="reset-filters-btn" type="button" onclick={handleClearSearch}>
                  Сбросить фильтры
                </button>
              </div>
            {:else}
              {#each currentItems as item (item.id)}
                {@const firstLetter = (item.name || '#')[0].toUpperCase()}
                <div data-first-letter={firstLetter}>
                  {#if stepNum === 1}
                    <TeamCharacterCard
                      {item}
                      selected={isSelected(stepNum, item)}
                      onselect={() => handleItemClick(stepNum, item)}
                      oninfo={() => handleInfoClick(item)}
                      ondel={() => handleDeleteClick(item)}
                    />
                  {:else}
                    <CatalogCard
                      {item}
                      selected={c.selections[2]?.id === item.id}
                      hasAvatar={false}
                      onselect={() => handleItemClick(stepNum, item)}
                      oninfo={() => handleInfoClick(item)}
                      ondel={() => handleDeleteClick(item)}
                    />
                  {/if}
                </div>
              {/each}

              {#if currentIsLoading}
                <div class="loading-spinner">
                  <i class="fas fa-spinner fa-spin"></i> Загрузка...
                </div>
              {/if}

              {#if !currentHasMore && currentItems.length > 0}
                <div class="end-of-list">
                  <i class="fas fa-check-circle"></i> Все карточки загружены
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <StepButtons
          step={stepNum}
          total={2}
          canProceed={stepNum === 1
            ? (selectedCount > 0 && selectedCount <= 10)
            : !!c.selections[2]}
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
  .selected-count {
    margin-left: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--accent-primary);
    font-weight: normal;
  }
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