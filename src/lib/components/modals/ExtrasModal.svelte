<script lang="ts">
import { get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import { catalogStore } from '$lib/domain/catalog/catalog.store';
import { chatStore } from '$lib/domain/chat/chat.store';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { buildSessionRow } from '$lib/domain/chat/chat.sessionRow';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';

let exporting = $state(false);
let importing = $state(false);
let importFile = $state<File | null>(null);
let importStatus = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
let exportType = $state<'full' | 'catalog' | 'chat'>('full');

// Поддержка нового и старого путей для обратной совместимости
const isChatRoute = $derived(
	$page.url.pathname.startsWith('/roleplay/chat/') || 
	$page.url.pathname.startsWith('/chat/')
);

async function exportData() {
	exporting = true;
	importStatus = null;
	
	try {
		let data: any;
		let filename: string;
		const dateStr = new Date().toISOString().slice(0, 10);
		
		switch (exportType) {
			case 'chat':
				if (!isChatRoute) throw new Error('Откройте чат для экспорта');
				const chatData = buildSessionRow();
				data = { 
					type: 'chat_export', 
					version: '2.0', 
					exportedAt: new Date().toISOString(),
					session: chatData
				};
				filename = `chat_export_${dateStr}.json`;
				break;
				
			case 'catalog':
				data = await catalogStore.exportUserCards();
				data.type = 'catalog_export';
				filename = `catalog_export_${dateStr}.json`;
				break;
				
			case 'full':
			default:
				data = {
					type: 'full_export',
					version: '2.0',
					exportedAt: new Date().toISOString(),
					catalog: await catalogStore.exportUserCards(),
					settings: get(settingsStore).values,
					systemPrompts: systemPromptStore.exportData(),
					cheatmode: cheatmodeStore.exportData(),
					lorebook: lorebookStore.exportData()
				};
				filename = `literai_full_backup_${dateStr}.json`;
				break;
		}
		
		downloadJson(data, filename);
		importStatus = { type: 'success', message: 'Экспорт успешно завершён!' };
	} catch (e: any) {
		importStatus = { type: 'error', message: e.message || 'Ошибка экспорта' };
	} finally {
		exporting = false;
	}
}

async function importData() {
	if (!importFile) return;
	
	importing = true;
	importStatus = null;
	
	try {
		const text = await importFile.text();
		const json = JSON.parse(text);
		
		if (!json.type) throw new Error('Неверный формат файла');
		
		let imported = 0;
		
		switch (json.type) {
			case 'catalog_export':
			case 'full_export':
				const catalogData = json.catalog || json;
				if (catalogData.items || catalogData.catalog?.items) {
					const items = catalogData.items || catalogData.catalog?.items;
					const result = await catalogStore.importUserCards({ items });
					imported += result.added;
				}
				
				if (json.type === 'full_export') {
					if (json.settings) await settingsStore.setMany(json.settings);
					if (json.systemPrompts) systemPromptStore.importData(json.systemPrompts);
					if (json.cheatmode) cheatmodeStore.importData(json.cheatmode);
					if (json.lorebook) lorebookStore.importData(json.lorebook);
					imported += 4;
				}
				break;
				
			case 'chat_export':
				if (json.session) {
					const session = json.session;
					
					if (session.systemPromptData) systemPromptStore.importData(session.systemPromptData);
					if (session.cheatmodeData) cheatmodeStore.importData(session.cheatmodeData);
					if (session.lorebookData) lorebookStore.importData(session.lorebookData);
					
					const now = new Date().toISOString();
					
					// Нормализация режима: если не указан, считаем roleplay
					const mode = session.mode === 'hero' ? 'hero' : session.mode === 'team' ? 'team' : 'roleplay';

					const sessionRow = {
						id: session.id || `imported_${Date.now()}`,
						mode: mode, // Явно сохраняем нормализованный mode
						title: session.title || 'Импортированный чат',
						selectedItems: session.selectedItems,
						generatedScript: session.generatedScript,
						chatTree: session.chatTree,
						chatParts: session.chatParts,
						currentPartIndex: session.currentPartIndex ?? 0,
						analyticsData: session.analyticsData,
						systemPromptData: session.systemPromptData,
						cheatmodeData: session.cheatmodeData,
						lorebookData: session.lorebookData,
						createdAt: session.createdAt || now,
						updatedAt: now
					};
					
					await sessionsRepo.save(sessionRow);
					imported = 1;
					importStatus = { type: 'success', message: `Чат "${sessionRow.title}" импортирован! Переходим...` };
					
					setTimeout(async () => {
						ui.closeModal();
						// Перенаправляем в правильный роут в зависимости от mode
						const basePath = mode === 'hero' ? '/hero' : mode === 'team' ? '/team' : '/roleplay';
						await goto(`${basePath}/chat/${sessionRow.id}`);
					}, 1000);
					
					importing = false;
					return;
				}
				break;
				
			default:
				if (json.items || json.characters || json.jobs || json.scenes) {
					const result = await catalogStore.importUserCards(json);
					imported = result.added;
				}
				break;
		}
		
		importStatus = { type: 'success', message: `Импортировано: ${imported} элементов` };
		
		setTimeout(() => {
			ui.notify('Данные импортированы', 'success');
			ui.closeModal();
		}, 1000);
		
	} catch (e: any) {
		importStatus = { type: 'error', message: e.message || 'Ошибка импорта' };
	} finally {
		importing = false;
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

function handleFileSelect(e: Event) {
	const target = e.currentTarget as HTMLInputElement;
	const file = target.files?.[0];
	if (file) {
		importFile = file;
		importStatus = null;
	}
}
</script>

<div class="modal-panel export-modal">
	<div class="modal-header">
		<h3><i class="fas fa-file-export"></i> Экспорт / Импорт</h3>
		<button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
			<i class="fas fa-times"></i>
		</button>
	</div>
	
	<div class="tab-content-area">
		<!-- Экспорт -->
		<div class="export-section">
			<h4 class="section-title"><i class="fas fa-download"></i> Экспорт данных</h4>
			
			<div class="export-options">
				<label class="radio-option">
					<input type="radio" name="exportType" bind:group={exportType} value="full" />
					<span>Полный бэкап (все данные)</span>
				</label>
				<label class="radio-option">
					<input type="radio" name="exportType" bind:group={exportType} value="catalog" />
					<span>Только каталог</span>
				</label>
				<label class="radio-option">
					<input type="radio" name="exportType" bind:group={exportType} value="chat" disabled={!isChatRoute} />
					<span>Текущий чат (включая скрипт, читмод, лорбук) {!isChatRoute ? '(откройте чат)' : ''}</span>
				</label>
			</div>
			
			<button 
				class="btn-primary export-btn" 
				onclick={exportData}
				disabled={exporting}
			>
				{#if exporting}
					<i class="fas fa-spinner fa-spin"></i> Экспорт...
				{:else}
					<i class="fas fa-file-export"></i> Экспортировать
				{/if}
			</button>
		</div>
		
		<!-- Импорт -->
		<div class="import-section">
			<h4 class="section-title"><i class="fas fa-upload"></i> Импорт данных</h4>
			
			<div class="import-controls">
				<input 
					type="file" 
					accept=".json"
					onchange={handleFileSelect}
					id="import-file"
					class="hidden"
				/>
				<label for="import-file" class="btn-secondary">
					<i class="fas fa-folder-open"></i> Выбрать файл
				</label>
				
				{#if importFile}
					<div class="file-info">
						<i class="fas fa-file"></i>
						<span>{importFile.name}</span>
					</div>
				{/if}
				
				<button 
					class="btn-primary import-btn"
					onclick={importData}
					disabled={!importFile || importing}
				>
					{#if importing}
						<i class="fas fa-spinner fa-spin"></i> Импорт...
					{:else}
						<i class="fas fa-file-import"></i> Импортировать
					{/if}
				</button>
			</div>
		</div>
		
		<!-- Статус -->
		{#if importStatus}
			<div class="import-status {importStatus.type}">
				<i class="fas fa-{importStatus.type === 'success' ? 'check-circle' : importStatus.type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
				<span>{importStatus.message}</span>
			</div>
		{/if}
		
		<!-- Подсказка -->
		<div class="export-hint">
			<i class="fas fa-info-circle"></i>
			<p>При экспорте API-ключи провайдеров не сохраняются в целях безопасности. Экспорт чата включает настройки системного промпта, читмода и лорбука.</p>
		</div>
	</div>
</div>