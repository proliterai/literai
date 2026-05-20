<!-- src/routes/roleplay/+page.svelte -->
<script lang="ts">
import { onMount } from 'svelte';
import { catalogStore, STEP_CONFIG } from '$lib/domain/catalog/catalog.store';
import { ui } from '$lib/ui/ui.store';
import { goto } from '$app/navigation';

import ProgressBar from '$lib/components/catalog/ProgressBar.svelte';
import SearchBar from '$lib/components/catalog/SearchBar.svelte';
import TagsBar from '$lib/components/catalog/TagsBar.svelte';
import AlphabetBar from '$lib/components/catalog/AlphabetBar.svelte';
import CatalogCard from '$lib/components/catalog/CatalogCard.svelte';
import StepButtons from '$lib/components/catalog/StepButtons.svelte';
import ImportExportBar from '$lib/components/catalog/ImportExportBar.svelte';
import CreateItemModal from '$lib/components/catalog/CreateItemModal.svelte';
import InfoModal from '$lib/components/catalog/InfoModal.svelte';
import EditItemModal from '$lib/components/catalog/EditItemModal.svelte';

// Импорты глобальных сторов для очистки
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store'; 
import { chatStore } from '$lib/domain/chat/chat.store'; // <-- ИМПОРТ ЧАТА

let c = $derived($catalogStore);
let showCreateModal = $state(false);
let showInfoModal = $state(false);
let showEditModal = $state(false);

let selectedItemForInfo = $state<any>(null);
let selectedItemForEdit = $state<any>(null);

let createModalType = $state<'character' | 'role' | 'scene'>('character');
let scroller = $state<HTMLDivElement | null>(null);

onMount(async () => {
	// 1. Очищаем глобальные настройки (пресеты) и оперативную память перед новой игрой
	systemPromptStore.importData(null);
	cheatmodeStore.importData(null);
	lorebookStore.importData(null);
	eyeStore.importData(null); 
    memoryBookStore.importData(null)
	chatStore.reset(); // <-- ЖЕСТКАЯ ОЧИСТКА ЧАТА В ОЗУ

	// 2. Сбрасываем выбранные ранее карточки в каталоге
	catalogStore.resetCatalog();

	// 3. Инициализируем каталог
	await catalogStore.init();
});

function getStepConfig(step: number) {
	return STEP_CONFIG[step as keyof typeof STEP_CONFIG];
}

function selectItem(step: number, item: any) {
	catalogStore.select(step as any, item);
}

function handleSearch(query: string) {
	catalogStore.setSearch(c.step, query);
}

function handleClearSearch() {
	catalogStore.clearFilters(c.step);
}

function handleTagToggle(tag: string) {
	catalogStore.toggleTag(c.step, tag);
}

function handleAllTags() {
	catalogStore.clearFilters(c.step);
}

function handleNewTags() {
	catalogStore.toggleNew(c.step);
}

function handleCustomTags() {
	catalogStore.toggleCustom(c.step);
}

async function handleLetterPick(letter: string) {
	await catalogStore.ensureLetterVisible(c.step, letter);
	if (scroller) {
		scroller.scrollTo({ top: 0, behavior: 'smooth' });
	}
}

function handleBack() {
	if (c.step > 1) catalogStore.setStep((c.step - 1) as any);
}

function handleNext() {
	if (c.step < 5 && c.selections[c.step]) catalogStore.setStep((c.step + 1) as any);
}

async function handleStart() {
	if (catalogStore.isAllSelected()) {
		try {
			const sessionId = await catalogStore.startSessionFromSelections();
			await goto(`/roleplay/chat/${sessionId}`);
		} catch (e: any) {
			ui.notify(e.message, 'error');
		}
	} else {
		ui.notify('Не все элементы выбраны', 'error');
	}
}

function handleCreateClick() {
	createModalType = getStepConfig(c.step).type as any;
	showCreateModal = true;
}

async function handleCreateSubmit(data: any) {
	try {
		await catalogStore.addItem(createModalType, data, c.step as any);
		showCreateModal = false;
	} catch (e: any) {
		ui.notify(e.message, 'error');
	}
}

function handleInfoClick(item: any) {
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
		await catalogStore.editItem(id, data);
		showEditModal = false;
		selectedItemForEdit = null;
	} catch (e: any) {
		ui.notify(e.message, 'error');
	}
}

async function handleDeleteClick(item: any) {
	const isConfirmed = await ui.confirm(
		'Удаление', 
		`Удалить «${item.name}»? Это действие нельзя отменить.`
	);
	
	if (isConfirmed) {
		try {
			await catalogStore.deleteItem(item.id);
		} catch (e: any) {
			ui.notify(e.message, 'error');
		}
	}
}

async function handleExport() {
	try {
		const data = await catalogStore.exportUserCards();
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
		const result = await catalogStore.importUserCards(json);
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
	const runtime = c.runtime?.[c.step];
	
	if (!runtime || runtime.isLoading || !runtime.hasMore) return;
	
	if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
		catalogStore.loadMore(c.step);
	}
}

function getFilteredItems() {
	return c.runtime?.[c.step]?.items || [];
}

function getLetters() {
	return catalogStore.getLettersForStep(c.step as any);
}

function getTags() {
	return catalogStore.getTagsForStep(c.step as any);
}

function hasCustom() {
	return catalogStore.hasCustomForStep(c.step as any);
}

function getFilters() {
	return catalogStore.getFilters(c.step as any);
}
</script>

<div class="catalog-root">
	<h2 class="catalog-title">
		<i class="fas fa-cogs"></i> Создайте свою ролевую историю
	</h2>
	
	<ProgressBar
		total={5}
		current={c.step}
		selected={c.selections}
		onPick={(step) => catalogStore.setStep(step as any)}
	/>
	
	{#each [1, 2, 3, 4, 5] as stepNum}
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
								<div>
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
					total={5}
					canProceed={!!c.selections?.[stepNum]}
					onBack={handleBack}
					onNext={handleNext}
					onStart={handleStart}
				/>
			</div>
		{/if}
	{/each}
</div>

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