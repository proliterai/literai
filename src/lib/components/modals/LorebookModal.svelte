<!-- ================================================================================
ФАЙЛ: src/lib/components/modals/LorebookModal.svelte
Описание: Модальное окно управления лорбуком с векторным поиском
================================================================================ -->
<script lang="ts">
	import { ui } from '$lib/ui/ui.store';
	import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
	
	// Импортируем наш новый компонент векторного поиска
	import VectorSettings from '$lib/components/lorebook/VectorSettings.svelte';

	let lbFile = $state<HTMLInputElement>();
	let lb = $derived($lorebookStore);

	async function handleFileUpload(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			try {
				await lorebookStore.loadFromFile(file);
				ui.notify(`Лорбук "${file.name}" загружен`, 'success');
			} catch (err: any) {
				ui.notify('Ошибка: ' + err.message, 'error');
			}
			target.value = '';
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
</script>

<div class="modal-panel lorebook-modal">
	<div class="modal-header">
		<h3><i class="fas fa-book-open"></i> Лорбук</h3>
		<button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
			<i class="fas fa-times"></i>
		</button>
	</div>
	
	<div class="tab-content-area">
		<div class="lorebook-header">
			<div class="lorebook-status">
				{#if lb.data?.entries?.length}
					<span class="status-ok">
						<i class="fas fa-check-circle"></i> 
						{lb.data.name} ({lb.data.entries.length} записей)
					</span>
				{:else}
					<span class="status-empty">
						<i class="fas fa-info-circle"></i> Нет активного лорбука
					</span>
				{/if}
			</div>
			<div class="lorebook-actions">
				{#if lb.data?.entries?.length}
					<button 
						class="btn-secondary btn-sm" 
						title="Очистить"
						onclick={() => confirm('Удалить загруженный лорбук?') && lorebookStore.clear()}
					>
						<i class="fas fa-trash"></i>
					</button>
					<button 
						class="btn-secondary btn-sm" 
						title="Экспорт"
						onclick={() => {
							const data = lorebookStore.exportData();
							if (data) downloadJson(data, `${(data.name || 'lorebook').replace(/\s+/g, '_')}_lorebook.json`);
						}}
					>
						<i class="fas fa-download"></i>
					</button>
				{/if}
				<button class="btn-primary btn-sm" title="Загрузить" onclick={() => lbFile?.click()}>
					<i class="fas fa-upload"></i> Загрузить
				</button>
				<input 
					bind:this={lbFile} 
					type="file" 
					accept=".json,.txt" 
					style="display:none" 
					onchange={handleFileUpload} 
				/>
			</div>
		</div>
		
		{#if lb.data}
			<div class="lorebook-stats">
				<span class="stat-item"><i class="fas fa-cog"></i> Глубина: {lb.data.scanDepth}</span>
				<span class="stat-item"><i class="fas fa-coins"></i> Бюджет: {lb.data.tokenBudget}</span>
				<span class="stat-item">
					<i class="fas fa-toggle-on"></i> 
					Активных: {lb.data.entries.filter((e) => e.enabled).length}
				</span>
			</div>
			
			<!-- ВСТАВЛЕННЫЙ БЛОК ВЕКТОРНОГО ПОИСКА -->
			        <VectorSettings 
          isVectorizing={lb.isVectorizing} 
          progress={lb.vectorizeProgress} 
          disabled={!lb.data?.entries.length} 
          onVectorize={() => lorebookStore.vectorizeAll()} 
        />
			
			<div class="lorebook-list">
				{#each lb.data.entries as e (e.uid)}
					<div class="lb-entry-card {!e.enabled ? 'disabled' : ''} {e.constant ? 'constant' : ''}">
						<div class="lb-entry-header">
							<span class="lb-keys">
								{e.keys.slice(0, 3).join(', ')}
								{e.keys.length > 3 ? ` +${e.keys.length - 3}` : ''}
							</span>
							<div class="lb-entry-badges">
								{#if e.constant}<span class="lb-badge">∞</span>{/if}
								{#if !e.enabled}<span class="lb-badge">off</span>{/if}
								<span class="lb-badge">P{e.priority}</span>
							</div>
						</div>
						<div class="lb-entry-content">
							{e.content.slice(0, 150)}{e.content.length > 150 ? '...' : ''}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="lorebook-placeholder">
				<i class="fas fa-book-open"></i>
				<p>Загрузите файл лорбука (.json или .txt)</p>
				<small>Форматы: SillyTavern Lorebook, простой текст (ключи | контент)</small>
			</div>
		{/if}
	</div>
</div>