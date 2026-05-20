<!-- ================================================================================
ФАЙЛ: src/lib/components/team-modals/TeamAnalyticsModal.svelte
Описание: Модальное окно аналитики для режима "Игра за команду"
ИСПРАВЛЕНИЯ:
1. Сводная панель перемещена в таб "Обзор"
2. Улучшена мобильная адаптация
3. Оптимизирована структура табов
4. Добавлено сохранение состояния раскрытых секций
5. Исправлен скролл на мобильных устройствах во всех табах и вложенных окнах
================================================================================ -->
<script lang="ts">
import { onMount } from 'svelte';
import { ui } from '$lib/ui/ui.store';
import { page } from '$app/stores';
import { teamAnalyticsService } from '$lib/domain/team-analytics/analytics.service';
import type {
	TeamAnalyticsData,
	TeamAnalyticsUIState
} from '$lib/domain/team-analytics/analytics.types';

let analyzing = $state(false);
let analyticsData = $state<TeamAnalyticsData | null>(null);
let lastAnalysisTime = $state<number | null>(null);
let loadingStage = $state('');
let error = $state<string | null>(null);

// Инициализация UI состояния с загрузкой из localStorage
let uiState = $state<TeamAnalyticsUIState>({
	activeTab: 'overview',
	expandedSections: new Set(['meta', 'characters', 'predictions', 'summary', 'stats']),
	revealedSpoilers: new Set(),
	selectedCharacter: null
});

// Загрузка сохранённого состояния UI
onMount(() => {
	try {
		const saved = localStorage.getItem('team_analytics_ui_state');
		if (saved) {
			const parsed = JSON.parse(saved);
			uiState = {
				...uiState,
				expandedSections: new Set(parsed.expandedSections || []),
				revealedSpoilers: new Set(parsed.revealedSpoilers || [])
			};
		}
	} catch (e) {
		console.warn('[TeamAnalyticsModal] Ошибка загрузки UI состояния:', e);
	}
});

// Сохранение состояния UI при изменениях
$effect(() => {
	try {
		localStorage.setItem('team_analytics_ui_state', JSON.stringify({
			expandedSections: Array.from(uiState.expandedSections),
			revealedSpoilers: Array.from(uiState.revealedSpoilers)
		}));
	} catch (e) {
		console.warn('[TeamAnalyticsModal] Ошибка сохранения UI состояния:', e);
	}
});

let isTeamChatRoute = $derived($page.url.pathname.startsWith('/team/chat/'));

onMount(() => {
	try {
		const cached = teamAnalyticsService.getCachedData();
		if (cached) {
			analyticsData = cached;
			lastAnalysisTime =
				teamAnalyticsService.getLastAnalysisTime() ?? cached.timestamp ?? null;
		}
	} catch (e) {
		console.warn('[TeamAnalyticsModal] Ошибка загрузки кэша при mount:', e);
	}
});

const loadingStages = [
	'Сбор логов основного чата...',
	'Чтение приватных переписок...',
	'Анализ мотивации персонажей...',
	'Построение графа отношений...',
	'Оценка атмосферы локации...',
	'Генерация предсказаний...',
	'Формирование отчёта...'
];

async function runAnalysis(forceUpdate: boolean = false): Promise<void> {
	if (!isTeamChatRoute) {
		ui.notify('Откройте командный чат для анализа', 'warning');
		return;
	}
	analyzing = true;
	error = null;
	let stageIndex = 0;
	loadingStage = loadingStages[0];
	const stageInterval = setInterval(() => {
		stageIndex = (stageIndex + 1) % loadingStages.length;
		loadingStage = loadingStages[stageIndex];
	}, 1500);
	if (forceUpdate) {
		analyticsData = null;
		teamAnalyticsService.clearCache();
	}
	try {
		const result = await teamAnalyticsService.runAnalysis(forceUpdate);
		analyticsData = result;
		lastAnalysisTime = result?.timestamp || Date.now();
		ui.notify('Анализ завершён', 'success');
	} catch (e: unknown) {
		console.error('[TeamAnalyticsModal] Ошибка анализа:', e);
		const errorMessage = e instanceof Error ? e.message : 'Неизвестная ошибка';
		error = errorMessage;
		ui.notify(`Ошибка: ${errorMessage}`, 'error');
		if (forceUpdate) {
			const cached = teamAnalyticsService.getCachedData();
			if (cached) {
				analyticsData = cached;
				lastAnalysisTime = cached.timestamp || null;
			}
		}
	} finally {
		clearInterval(stageInterval);
		analyzing = false;
		loadingStage = '';
	}
}

function formatLastUpdateTime(time: number | null): string {
	if (!time) return '—';
	return new Date(time).toLocaleString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function exportJSON(): void {
	if (!analyticsData) return;
	const blob = new Blob([JSON.stringify(analyticsData, null, 2)], {
		type: 'application/json'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `team_analytics_${Date.now()}.json`;
	a.click();
	URL.revokeObjectURL(url);
	ui.notify('JSON экспортирован', 'success');
}

function copySummary(): void {
	if (!analyticsData?.meta?.chapterSummary) return;
	navigator.clipboard
		.writeText(analyticsData.meta.chapterSummary)
		.then(() => ui.notify('Сводка скопирована', 'success'))
		.catch(() => ui.notify('Ошибка копирования', 'error'));
}

function toggleSection(sectionId: string): void {
	const newSet = new Set(uiState.expandedSections);
	if (newSet.has(sectionId)) newSet.delete(sectionId);
	else newSet.add(sectionId);
	uiState = { ...uiState, expandedSections: newSet };
}

function toggleSpoiler(spoilerId: string): void {
	const newSet = new Set(uiState.revealedSpoilers);
	if (newSet.has(spoilerId)) newSet.delete(spoilerId);
	else newSet.add(spoilerId);
	uiState = { ...uiState, revealedSpoilers: newSet };
}

function getPhaseIcon(phase: string): string {
	const icons: Record<string, string> = {
		начало: '🌅',
		завязка: '⚡',
		развитие: '📈',
		кульминация: '🔥',
		развязка: '🏁'
	};
	return icons[phase?.toLowerCase()] || '📖';
}

function getTrendIcon(trend: string): string {
	if (trend === 'up') return '↑';
	if (trend === 'down') return '↓';
	return '→';
}

function getMoodClass(mood: string): string {
	if (!mood) return '';
	const m = mood.toLowerCase();
	if (['счастье', 'радость'].some((x) => m.includes(x))) return 'happy';
	if (['грусть', 'печаль'].some((x) => m.includes(x))) return 'sad';
	if (['гнев', 'злость', 'ярость'].some((x) => m.includes(x))) return 'angry';
	if (['страх', 'ужас'].some((x) => m.includes(x))) return 'fear';
	return '';
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-panel analytics-modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
	<!-- ШАПКА -->
	<div class="modal-header">
		<div class="analytics-header-content">
			<span class="analytics-header-icon">🛡️</span>
			<div class="analytics-header-text">
				<h3 id="analytics-modal-title">Аналитика Команды</h3>
				{#if analyticsData?.meta}
					<span class="analytics-header-subtitle">
						{getPhaseIcon(analyticsData.meta.storyPhase)}
						{analyticsData.meta.storyPhase} • День {analyticsData.meta.gameDay}
					</span>
				{:else}
					<span class="analytics-header-subtitle">ИИ-анализ динамики чата и персонажей</span>
				{/if}
			</div>
		</div>
		<div class="analytics-header-actions">
			{#if analyticsData && !analyzing}
				<button
					class="analytics-header-btn"
					onclick={() => runAnalysis(true)}
					disabled={analyzing}
					title="Обновить анализ"
				>
					<i class="fas fa-sync-alt" class:fa-spin={analyzing}></i>
				</button>
			{/if}
			<button class="modal-close-btn" onclick={() => ui.closeModal()} title="Закрыть">
				<i class="fas fa-times"></i>
			</button>
		</div>
	</div>

	<!-- ТЕЛО МОДАЛКИ -->
	<div class="modal-body">
		<!-- СОСТОЯНИЕ: Не на маршруте командного чата -->
		{#if !isTeamChatRoute}
			<div class="state-container placeholder-state">
				<i class="fas fa-exclamation-triangle"></i>
				<h3>Командный чат не открыт</h3>
				<p>Откройте командный чат для просмотра и запуска аналитики</p>
			</div>
		<!-- СОСТОЯНИЕ: Идет загрузка -->
		{:else if analyzing}
			<div class="state-container loading-state">
				<div class="analytics-loading-rings">
					<div class="analytics-loading-ring"></div>
					<div class="analytics-loading-ring"></div>
					<div class="analytics-loading-ring"></div>
				</div>
				<h3>Анализируем команду...</h3>
				<p class="analytics-loading-stage">{loadingStage || 'Подготовка...'}</p>
				<div class="analytics-loading-progress">
					<div class="analytics-loading-progress-bar"></div>
				</div>
			</div>
		<!-- СОСТОЯНИЕ: Ошибка -->
		{:else if error}
			<div class="state-container error-state">
				<i class="fas fa-exclamation-triangle"></i>
				<h3>Произошла ошибка</h3>
				<p>{error}</p>
				<button class="btn-primary mt-3" onclick={() => runAnalysis(true)}>
					<i class="fas fa-redo"></i> Попробовать снова
				</button>
			</div>
		<!-- СОСТОЯНИЕ: Данных нет (Первый запуск) -->
		{:else if !analyticsData}
			<div class="state-container empty-state">
				<i class="fas fa-magic"></i>
				<h3>Аналитика пока не собрана</h3>
				<p>
					Запустите ИИ-анализ, чтобы узнать скрытые мотивы персонажей, уровень
					напряжения в группе и получить идеи для развития сюжета.
				</p>
				<button class="btn-primary mt-3" onclick={() => runAnalysis(false)}>
					<i class="fas fa-play"></i> Запустить аналитику
				</button>
			</div>
		<!-- СОСТОЯНИЕ: Данные есть (Отображение результатов) -->
		{:else}
			<div class="analytics-results">
				<!-- Вкладки -->
				<div class="analytics-tabs">
					<button
						class="analytics-tab"
						class:active={uiState.activeTab === 'overview'}
						onclick={() => (uiState.activeTab = 'overview')}
					>
						<i class="fas fa-home"></i> <span class="tab-label">Обзор</span>
					</button>
					<button
						class="analytics-tab"
						class:active={uiState.activeTab === 'characters'}
						onclick={() => (uiState.activeTab = 'characters')}
					>
						<i class="fas fa-users"></i>
						<span class="tab-label">Команда</span>
					</button>
					<button
						class="analytics-tab"
						class:active={uiState.activeTab === 'world'}
						onclick={() => (uiState.activeTab = 'world')}
					>
						<i class="fas fa-globe"></i> <span class="tab-label">Мир</span>
					</button>
					<button
						class="analytics-tab"
						class:active={uiState.activeTab === 'story'}
						onclick={() => (uiState.activeTab = 'story')}
					>
						<i class="fas fa-book"></i> <span class="tab-label">Сюжет</span>
					</button>
					<button
						class="analytics-tab"
						class:active={uiState.activeTab === 'predictions'}
						onclick={() => (uiState.activeTab = 'predictions')}
					>
						<i class="fas fa-lightbulb"></i>
						<span class="tab-label">Советы</span>
					</button>
				</div>

				<div class="analytics-tab-content">
					<!-- Вкладка ОБЗОР (теперь включает сводную панель) -->
					{#if uiState.activeTab === 'overview'}
						<!-- Сводная панель (перемещена из верха в таб) -->
						<div class="analytics-summary-bar">
							<div class="summary-item">
								<span class="summary-icon">{getPhaseIcon(analyticsData.meta?.storyPhase || '')}</span>
								<div class="summary-content">
									<span class="summary-label">Фаза</span>
									<span class="summary-value">{analyticsData.meta?.storyPhase || 'Неизвестно'}</span>
								</div>
							</div>
							<div class="summary-item tension-item">
								<span class="summary-icon">⚡</span>
								<div class="summary-content">
									<span class="summary-label">Напряжение в команде</span>
									<div class="tension-bar">
										<div
											class="tension-fill"
											style="width: {analyticsData.meta?.overallTension || 0}%"
										></div>
									</div>
								</div>
								<span class="summary-value">{analyticsData.meta?.overallTension || 0}%</span>
							</div>
							<div class="summary-item">
								<span class="summary-icon">📅</span>
								<div class="summary-content">
									<span class="summary-label">День</span>
									<span class="summary-value">{analyticsData.meta?.gameDay || 1}</span>
								</div>
							</div>
						</div>

						<section class="analytics-section">
							<button
								class="section-header"
								onclick={() => toggleSection('summary')}
							>
								<h4><i class="fas fa-book-open"></i> Текущая ситуация</h4>
								<i
									class="fas fa-chevron-down section-toggle"
									class:rotated={!uiState.expandedSections.has('summary')}
								></i>
							</button>
							{#if uiState.expandedSections.has('summary')}
								<div class="section-body">
									<div class="summary-text">
										{#each (analyticsData.meta?.chapterSummary || 'Сводка отсутствует').split('\n').filter((p) => p.trim()) as paragraph}
											<p>{paragraph.trim()}</p>
										{/each}
									</div>
								</div>
							{/if}
						</section>

						<section class="analytics-section">
							<button
								class="section-header"
								onclick={() => toggleSection('stats')}
							>
								<h4>
									<i class="fas fa-chart-bar"></i> Статистика сессии
								</h4>
								<i
									class="fas fa-chevron-down section-toggle"
									class:rotated={!uiState.expandedSections.has('stats')}
								></i>
							</button>
							{#if uiState.expandedSections.has('stats')}
								<div class="section-body">
									<div class="stats-grid">
										<div class="stat-card">
											<span class="stat-icon">💬</span>
											<span class="stat-value">{analyticsData.meta?.totalMessages || 0}</span>
											<span class="stat-label">сообщений</span>
										</div>
										<div class="stat-card">
											<span class="stat-icon">🔒</span>
											<span class="stat-value">{analyticsData.meta?.privateMessageCount || 0}</span>
											<span class="stat-label">приватных</span>
										</div>
										<div class="stat-card">
											<span class="stat-icon">📝</span>
											<span class="stat-value">{analyticsData.meta?.wordCount || 0}</span>
											<span class="stat-label">слов</span>
										</div>
										<div class="stat-card">
											<span class="stat-icon">⏱️</span>
											<span class="stat-value">{analyticsData.meta?.sessionDuration || '—'}</span>
											<span class="stat-label">время</span>
										</div>
									</div>
								</div>
							{/if}
						</section>

						{#if analyticsData.predictions?.warnings && analyticsData.predictions.warnings.length > 0}
							<section class="analytics-section warnings-section">
								<button
									class="section-header"
									onclick={() => toggleSection('warnings')}
								>
									<h4>
										<i class="fas fa-exclamation-triangle"></i> Внимание
									</h4>
									<span class="warning-count">{analyticsData.predictions.warnings.length}</span>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('warnings')}
									></i>
								</button>
								{#if uiState.expandedSections.has('warnings')}
									<div class="section-body">
										<div class="warnings-list">
											{#each analyticsData.predictions.warnings as warning}
												<div class="warning-item severity-{warning.severity}">
													<span class="warning-icon">
														{warning.severity === 'high'
															? '🔴'
															: warning.severity === 'medium'
															? '🟡'
															: '🔵'}
													</span>
													<div class="warning-content">
														<span class="warning-text">{warning.text}</span>
														{#if warning.suggestion}
															<span class="warning-suggestion">💡 {warning.suggestion}</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}
					{/if}

					<!-- Вкладка КОМАНДА -->
					{#if uiState.activeTab === 'characters'}
						{#if analyticsData.characters && analyticsData.characters.length > 0}
							<div class="characters-grid">
								{#each analyticsData.characters as char, index (char.id || char.name || index)}
									{@const moodClass = getMoodClass(char.mood?.primary || '')}
									<div class="character-card">
										<div class="character-header">
											{#if char.avatar}
												<img
													class="character-avatar {moodClass}"
													src={char.avatar}
													alt={char.name}
													onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
												/>
											{:else}
												<div class="character-avatar-placeholder {moodClass}">
													<i class="fas fa-user"></i>
												</div>
											{/if}
											<div class="character-info">
												<h5 class="character-name">{char.name}</h5>
												{#if char.role}
													<span class="character-role role-{char.role}">{char.role}</span>
												{/if}
												{#if char.mood}
													<span class="character-mood">
														{char.mood.emoji || '😐'}
														{char.mood.description || char.mood.primary}
													</span>
												{/if}
											</div>
										</div>
										<div class="character-body">
											{#if char.stats}
												<div class="character-stats">
													{#each Object.entries(char.stats) as [statName, statData]}
														{#if statData && statData.value !== null && statData.value !== undefined}
															<div class="stat-bar stat-{statName}">
																<div class="stat-header">
																	<span class="stat-label">{statName}</span>
																	<span class="stat-value-inline">
																		{statData.value}%
																		<span class="stat-trend trend-{statData.trend}">
																			{getTrendIcon(statData.trend)}
																		</span>
																	</span>
																</div>
																<div class="stat-track">
																	<div class="stat-fill" style="width: {statData.value}%"></div>
																</div>
															</div>
														{/if}
													{/each}
												</div>
											{/if}
											{#if char.currentGoal}
												<div class="character-goal">
													<span class="goal-label">🎯 Цель</span>
													<span class="goal-text">{char.currentGoal}</span>
												</div>
											{/if}
											{#if char.secretThought}
												<button
													class="spoiler-toggle"
													class:revealed={uiState.revealedSpoilers.has(`secret-${char.id}`)}
													onclick={() => toggleSpoiler(`secret-${char.id}`)}
												>
													<i class="fas fa-eye"></i> Скрытая мысль
												</button>
												{#if uiState.revealedSpoilers.has(`secret-${char.id}`)}
													<div class="spoiler-content">"{char.secretThought}"</div>
												{/if}
											{/if}
										</div>
									</div>
								{/each}
							</div>

							{#if analyticsData.relationships && analyticsData.relationships.length > 0}
								<section class="analytics-section">
									<button
										class="section-header"
										onclick={() => toggleSection('relationships')}
									>
										<h4><i class="fas fa-link"></i> Взаимоотношения</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('relationships')}
										></i>
									</button>
									{#if uiState.expandedSections.has('relationships')}
										<div class="section-body">
											<div class="relationships-list">
												{#each analyticsData.relationships as rel}
													{@const indicatorPos = ((rel.value + 100) / 200) * 100}
													<div class="relationship-item" class:tension={rel.hasTension}>
														<div class="relationship-header">
															<div class="relationship-names">
																<span>{rel.fromName}</span>
																<span class="relationship-arrow">➡</span>
																<span>{rel.toName}</span>
															</div>
															<span class="relationship-type">
																{rel.type} ({rel.value > 0 ? '+' : ''}{rel.value})
															</span>
														</div>
														<div class="relationship-bar">
															<div class="relationship-track">
																<div
																	class="relationship-indicator"
																	style="left: {indicatorPos}%"
																></div>
															</div>
														</div>
														<div class="relationship-status">"{rel.status}"</div>
														{#if rel.notes}
															<div class="relationship-notes">📝 {rel.notes}</div>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}
						{:else}
							<div class="empty-state-inline">
								<i class="fas fa-users"></i>
								<p>Нет данных о персонажах</p>
							</div>
						{/if}
					{/if}

					<!-- Вкладка МИР -->
					{#if uiState.activeTab === 'world'}
						{#if analyticsData.location && analyticsData.location.name}
							<section class="analytics-section">
								<button
									class="section-header"
									onclick={() => toggleSection('location')}
								>
									<h4>
										<i class="fas fa-map-marker-alt"></i>
										{analyticsData.location.name}
									</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('location')}
									></i>
								</button>
								{#if uiState.expandedSections.has('location')}
									<div class="section-body">
										<p class="location-description">{analyticsData.location.description}</p>
										{#if analyticsData.location.atmosphere}
											<div class="atmosphere-grid">
												{#each Object.entries(analyticsData.location.atmosphere) as [key, value]}
													{#if value !== null && value !== undefined}
														<div class="atmosphere-item atm-{key}">
															<div class="atm-header">
																<span class="atm-label">{key}</span>
																<span class="atm-value">{value}%</span>
															</div>
															<div class="atm-bar">
																<div class="atm-fill" style="width: {value}%"></div>
															</div>
														</div>
													{/if}
												{/each}
											</div>
										{/if}
										{#if analyticsData.location.pointsOfInterest?.length}
											<div class="poi-section">
												<h5>📍 Точки интереса</h5>
												<div class="poi-list">
													{#each analyticsData.location.pointsOfInterest as poi}
														<div class="poi-item">
															<span class="poi-icon">{poi.icon}</span>
															<div class="poi-content">
																<span class="poi-name">{poi.name}</span>
																{#if poi.hint}
																	<span class="poi-hint">"{poi.hint}"</span>
																{/if}
															</div>
															<span class="poi-status status-{poi.status}">{poi.status}</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</section>
						{:else}
							<div class="empty-state-inline">
								<i class="fas fa-globe"></i>
								<p>Нет данных о локации</p>
							</div>
						{/if}

						{#if analyticsData.inventory}
							<section class="analytics-section">
								<button
									class="section-header"
									onclick={() => toggleSection('inventory')}
								>
									<h4><i class="fas fa-backpack"></i> Инвентарь команды</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('inventory')}
									></i>
								</button>
								{#if uiState.expandedSections.has('inventory')}
									<div class="section-body">
										{#if analyticsData.inventory.resources}
											<div class="resources-bar">
												<div class="resource-item">
													<span class="resource-icon">💰</span>
													<span class="resource-value">{analyticsData.inventory.resources.gold || 0}</span>
													<span class="resource-label">золота</span>
												</div>
												<div class="resource-item">
													<span class="resource-icon">🍖</span>
													<span class="resource-value">{analyticsData.inventory.resources.food || 0}</span>
													<span class="resource-label">рационов</span>
												</div>
											</div>
										{/if}
										{#if analyticsData.inventory.items && analyticsData.inventory.items.length > 0}
											<div class="items-grid">
												{#each analyticsData.inventory.items as item}
													<div class="inventory-item" title={item.description}>
														<span class="item-icon">{item.icon}</span>
														<span class="item-name">{item.name}</span>
														{#if item.quantity > 1}
															<span class="item-quantity">x{item.quantity}</span>
														{/if}
														<span class="item-owner">[{item.owner}]</span>
													</div>
												{/each}
											</div>
										{:else}
											<p class="empty-text">Инвентарь пуст</p>
										{/if}
									</div>
								{/if}
							</section>
						{/if}
					{/if}

					<!-- Вкладка СЮЖЕТ -->
					{#if uiState.activeTab === 'story'}
						{#if analyticsData.storyAnalytics}
							{#if analyticsData.storyAnalytics.currentArc}
								<section class="analytics-section">
									<button
										class="section-header"
										onclick={() => toggleSection('arc')}
									>
										<h4>
											<i class="fas fa-theater-masks"></i> Арка: {analyticsData.storyAnalytics.currentArc.name}
										</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('arc')}
										></i>
									</button>
									{#if uiState.expandedSections.has('arc')}
										<div class="section-body">
											<div class="arc-card">
												<p>{analyticsData.storyAnalytics.currentArc.description}</p>
												<div class="arc-progress">
													<span class="progress-label">Прогресс</span>
													<div class="progress-bar">
														<div
															class="progress-fill"
															style="width: {analyticsData.storyAnalytics.currentArc.progress}%"
														></div>
													</div>
													<span class="progress-value">{analyticsData.storyAnalytics.currentArc.progress}%</span>
												</div>
											</div>
										</div>
									{/if}
								</section>
							{/if}

							{#if analyticsData.storyAnalytics.unresolved?.length}
								<section class="analytics-section">
									<button
										class="section-header"
										onclick={() => toggleSection('unresolved')}
									>
										<h4><i class="fas fa-question-circle"></i> Открытые вопросы</h4>
										<span class="count-badge">{analyticsData.storyAnalytics.unresolved.length}</span>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('unresolved')}
										></i>
									</button>
									{#if uiState.expandedSections.has('unresolved')}
										<div class="section-body">
											<div class="unresolved-list">
												{#each analyticsData.storyAnalytics.unresolved as item}
													<div class="unresolved-item importance-{item.importance}">
														<span class="unresolved-type">{item.type}</span>
														<p class="unresolved-desc">{item.description}</p>
														{#if item.suggestedResolution}
															<div class="unresolved-suggestion">💡 {item.suggestedResolution}</div>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}
						{:else}
							<div class="empty-state-inline">
								<i class="fas fa-book"></i>
								<p>Нет данных о сюжете</p>
							</div>
						{/if}
					{/if}

					<!-- Вкладка СОВЕТЫ -->
					{#if uiState.activeTab === 'predictions'}
						{#if analyticsData.predictions?.immediateOptions?.length}
							<section class="analytics-section">
								<button
									class="section-header"
									onclick={() => toggleSection('actions')}
								>
									<h4><i class="fas fa-hand-point-right"></i> Возможные действия</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('actions')}
									></i>
								</button>
								{#if uiState.expandedSections.has('actions')}
									<div class="section-body">
										<div class="actions-grid">
											{#each analyticsData.predictions.immediateOptions as action}
												<button
													class="action-card"
													onclick={() => navigator.clipboard.writeText(action.insertText)}
												>
													<div class="action-header">
														<span class="action-category">{action.category}</span>
														<span class="action-risk risk-{action.risk}">Риск: {action.risk}</span>
													</div>
													<p class="action-text">"{action.action}"</p>
													<div class="action-reward">{action.potentialReward}</div>
													<div class="action-insert">
														<i class="fas fa-copy"></i> Копировать
													</div>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						{#if analyticsData.storyAdvice?.plotSuggestions?.length}
							<section class="analytics-section">
								<button
									class="section-header"
									onclick={() => toggleSection('suggestions')}
								>
									<h4><i class="fas fa-lightbulb"></i> Идеи для сюжета</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('suggestions')}
									></i>
								</button>
								{#if uiState.expandedSections.has('suggestions')}
									<div class="section-body">
										<div class="suggestions-list">
											{#each analyticsData.storyAdvice.plotSuggestions as suggestion}
												<div class="suggestion-item impact-{suggestion.impact}">
													<div class="suggestion-header">
														<span class="suggestion-title">{suggestion.title}</span>
														<span class="suggestion-impact">{suggestion.impact}</span>
													</div>
													<p class="suggestion-desc">{suggestion.description}</p>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						{#if !analyticsData.predictions?.immediateOptions?.length && !analyticsData.storyAdvice?.plotSuggestions?.length}
							<div class="empty-state-inline">
								<i class="fas fa-lightbulb"></i>
								<p>Нет советов для отображения</p>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- ПОДВАЛ -->
	<div class="analytics-footer">
		{#if analyticsData && !analyzing}
			<span class="analytics-timestamp">Последний анализ: {formatLastUpdateTime(lastAnalysisTime)}</span>
			<div class="analytics-footer-actions">
				<button class="btn-icon" onclick={copySummary} title="Скопировать сводку">
					<i class="fas fa-copy"></i> <span class="btn-label">Сводка</span>
				</button>
				<button class="btn-icon" onclick={exportJSON} title="Экспорт в JSON">
					<i class="fas fa-download"></i>
					<span class="btn-label">Экспорт</span>
				</button>
				<button class="btn-primary" onclick={() => runAnalysis(true)} disabled={analyzing}>
					<i class="fas fa-sync-alt" class:fa-spin={analyzing}></i>
					<span class="btn-label">{analyzing ? 'Анализ...' : 'Обновить'}</span>
				</button>
			</div>
		{:else if !analyzing}
			<span class="analytics-timestamp">Анализ не проводился</span>
			<div class="analytics-footer-actions">
				<button class="btn-secondary" onclick={() => ui.closeModal()}> Закрыть </button>
			</div>
		{:else}
			<span class="analytics-timestamp">Идёт анализ...</span>
			<div></div>
		{/if}
	</div>
</div>

<style>
/* ============================================
MODAL CONTAINER
============================================ */
.analytics-modal {
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 900px;
	max-height: 90vh;
	max-height: 90dvh;
	overflow: hidden;
}

/* ============================================
HEADER
============================================ */
.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1.25rem 1.5rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	flex-shrink: 0;
}

.analytics-header-content {
	display: flex;
	align-items: center;
	gap: 1rem;
	min-width: 0;
}

.analytics-header-icon {
	font-size: 2rem;
	flex-shrink: 0;
}

.analytics-header-text {
	min-width: 0;
}

.analytics-header-text h3 {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 600;
	color: var(--txt-primary, #e0e0e0);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.analytics-header-subtitle {
	font-size: 0.85rem;
	color: var(--txt-muted, #888);
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-top: 0.25rem;
}

.analytics-header-actions {
	display: flex;
	gap: 0.5rem;
	flex-shrink: 0;
}

.analytics-header-btn,
.modal-close-btn {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	color: var(--txt-secondary, #aaa);
	width: 36px;
	height: 36px;
	border-radius: 8px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s ease;
	flex-shrink: 0;
}

.analytics-header-btn:hover,
.modal-close-btn:hover {
	background: var(--bg-surface-4, rgba(70, 70, 90, 0.8));
	color: var(--txt-primary, #e0e0e0);
	transform: scale(1.05);
}

.modal-close-btn:hover {
	background: rgba(220, 50, 50, 0.2);
	border-color: rgba(220, 50, 50, 0.4);
	color: #f44;
}

/* ============================================
BODY — единственный скроллящийся контейнер
============================================ */
.modal-body {
	flex: 1 1 0%;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex;
	flex-direction: column;
	background: var(--bg-surface-1, rgba(15, 15, 25, 0.95));
	min-height: 0;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

/* ============================================
STATE CONTAINERS
============================================ */
.state-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 4rem 2rem;
	gap: 1rem;
	color: var(--txt-secondary, #aaa);
	flex: 1;
	min-height: 300px;
}

.state-container :global(i.fas) {
	font-size: 3rem;
	opacity: 0.6;
}

.state-container h3 {
	margin: 0;
	font-size: 1.4rem;
	color: var(--txt-primary, #e0e0e0);
}

.state-container p {
	margin: 0;
	max-width: 400px;
	color: var(--txt-muted, #888);
	line-height: 1.6;
}

.mt-3 {
	margin-top: 1.5rem;
}

/* Loading Animation */
.analytics-loading-rings {
	display: flex;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}

.analytics-loading-ring {
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: var(--accent-primary, #c49b5c);
	animation: pulse-ring 1.5s infinite ease-in-out both;
}

.analytics-loading-ring:nth-child(1) {
	animation-delay: -0.32s;
}

.analytics-loading-ring:nth-child(2) {
	animation-delay: -0.16s;
}

@keyframes pulse-ring {
	0%,
	80%,
	100% {
		transform: scale(0);
		opacity: 0;
	}
	40% {
		transform: scale(1);
		opacity: 1;
	}
}

.analytics-loading-stage {
	font-size: 0.9rem;
	color: var(--txt-muted, #888);
	margin-bottom: 1.5rem;
	min-height: 1.5em;
}

.analytics-loading-progress {
	width: 60%;
	max-width: 300px;
	height: 4px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-radius: 2px;
	overflow: hidden;
}

.analytics-loading-progress-bar {
	height: 100%;
	width: 30%;
	background: linear-gradient(90deg, #8b1a3a, #c49b5c);
	border-radius: 2px;
	animation: loading-bar 2s infinite linear;
	transform-origin: left;
}

@keyframes loading-bar {
	0% {
		transform: translateX(-100%) scaleX(0.5);
	}
	50% {
		transform: translateX(50%) scaleX(1);
	}
	100% {
		transform: translateX(300%) scaleX(0.5);
	}
}

/* ============================================
RESULTS CONTAINER
— НЕ скроллится сам, контент прокручивается через .modal-body
============================================ */
.analytics-results {
	display: flex;
	flex-direction: column;
	min-height: 0;
}

/* ============================================
SUMMARY BAR (перемещена в таб Обзор)
============================================ */
.analytics-summary-bar {
	display: flex;
	gap: 1rem;
	padding: 1.25rem 1.5rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
	flex-wrap: wrap;
}

.summary-item {
	flex: 1;
	min-width: 140px;
	display: flex;
	align-items: center;
	gap: 0.75rem;
	background: var(--glass-bg, rgba(255, 255, 255, 0.05));
	padding: 0.875rem 1rem;
	border-radius: 10px;
	border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

.summary-icon {
	font-size: 1.75rem;
	flex-shrink: 0;
}

.summary-content {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
}

.summary-label {
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--txt-muted, #888);
}

.summary-value {
	font-size: 1rem;
	font-weight: 600;
	color: var(--txt-primary, #e0e0e0);
	flex-shrink: 0;
}

.tension-item {
	flex: 2;
	min-width: 200px;
}

.tension-bar {
	width: 100%;
	height: 6px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-radius: 3px;
	margin-top: 0.4rem;
	overflow: hidden;
}

.tension-fill {
	height: 100%;
	background: linear-gradient(90deg, #4caf50, #ff9800, #f44336);
	transition: width 0.5s ease;
}

/* ============================================
TABS — sticky, чтобы при скролле оставались видны
============================================ */
.analytics-tabs {
	display: flex;
	padding: 0 1.5rem;
	gap: 0.25rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
	overflow-x: auto;
	flex-shrink: 0;
	-webkit-overflow-scrolling: touch;
	position: sticky;
	top: 0;
	z-index: 10;
}

.analytics-tabs::-webkit-scrollbar {
	height: 0;
	display: none;
}

.analytics-tab {
	background: none;
	border: none;
	padding: 0.875rem 1rem;
	color: var(--txt-muted, #888);
	font-weight: 500;
	font-size: 0.9rem;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	border-bottom: 2px solid transparent;
	transition: all 0.2s ease;
	white-space: nowrap;
	font-family: inherit;
	flex-shrink: 0;
}

.analytics-tab:hover {
	color: var(--txt-secondary, #aaa);
}

.analytics-tab.active {
	color: var(--txt-gold, #c49b5c);
	border-bottom-color: var(--accent-primary, #c49b5c);
}

.tab-label {
	display: inline;
}

/* ============================================
TAB CONTENT — прокручивается внутри .modal-body
============================================ */
.analytics-tab-content {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

/* ============================================
SECTIONS
============================================ */
.analytics-section {
	background: var(--glass-bg, rgba(255, 255, 255, 0.05));
	border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
	border-radius: 12px;
	overflow: hidden;
}

.section-header {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1rem 1.25rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border: none;
	color: var(--txt-primary, #e0e0e0);
	cursor: pointer;
	transition: background 0.2s ease;
	font-family: inherit;
}

.section-header:hover {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
}

.section-header h4 {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 0.75rem;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.section-header h4 :global(i) {
	color: var(--txt-gold, #c49b5c);
	flex-shrink: 0;
}

.count-badge,
.warning-count {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	color: var(--txt-secondary, #aaa);
	padding: 0.15rem 0.5rem;
	border-radius: 12px;
	font-size: 0.75rem;
	font-weight: bold;
	margin-left: 0.5rem;
	flex-shrink: 0;
}

.warning-count {
	background: rgba(244, 67, 54, 0.15);
	color: #f44;
}

.section-toggle {
	transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	color: var(--txt-muted, #888);
	flex-shrink: 0;
}

.section-toggle.rotated {
	transform: rotate(-90deg);
}

.section-body {
	padding: 1.25rem;
	border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

/* ============================================
SUMMARY TEXT
============================================ */
.summary-text p {
	margin: 0 0 0.75rem 0;
	line-height: 1.65;
	color: var(--txt-secondary, #aaa);
	font-size: 0.95rem;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.summary-text p:last-child {
	margin-bottom: 0;
}

/* ============================================
STATS GRID
============================================ */
.stats-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
	gap: 0.75rem;
}

.stat-card {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 1rem;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

.stat-card .stat-icon {
	font-size: 1.5rem;
	margin-bottom: 0.5rem;
	opacity: 0.85;
}

.stat-card .stat-value {
	font-size: 1.25rem;
	font-weight: bold;
	color: var(--txt-primary, #e0e0e0);
}

.stat-card .stat-label {
	font-size: 0.7rem;
	color: var(--txt-muted, #888);
	text-transform: uppercase;
	margin-top: 0.25rem;
	letter-spacing: 0.03em;
}

/* ============================================
WARNINGS
============================================ */
.warnings-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.warning-item {
	display: flex;
	gap: 1rem;
	padding: 1rem;
	border-radius: 8px;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-left: 4px solid transparent;
}

.warning-item.severity-high {
	border-left-color: #f44;
	background: rgba(244, 67, 54, 0.1);
}

.warning-item.severity-medium {
	border-left-color: #ff9800;
	background: rgba(255, 152, 0, 0.1);
}

.warning-item.severity-low {
	border-left-color: #2196f3;
	background: rgba(33, 150, 243, 0.1);
}

.warning-icon {
	font-size: 1.25rem;
	flex-shrink: 0;
}

.warning-content {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	min-width: 0;
}

.warning-text {
	font-weight: 500;
	color: var(--txt-primary, #e0e0e0);
	line-height: 1.4;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.warning-suggestion {
	font-size: 0.9rem;
	color: var(--txt-muted, #888);
	font-style: italic;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

/* ============================================
CHARACTERS GRID
============================================ */
.characters-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: 1rem;
}

.character-card {
	background: var(--glass-bg, rgba(255, 255, 255, 0.05));
	border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
	border-radius: 12px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.character-header {
	display: flex;
	align-items: center;
	gap: 0.875rem;
	padding: 1rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

.character-avatar,
.character-avatar-placeholder {
	width: 48px;
	height: 48px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid var(--border-color, rgba(255, 255, 255, 0.1));
	flex-shrink: 0;
}

.character-avatar-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	color: var(--txt-muted, #888);
	font-size: 1.25rem;
}

.character-avatar.happy,
.character-avatar-placeholder.happy {
	border-color: #4caf50;
	box-shadow: 0 0 10px rgba(76, 175, 80, 0.2);
}

.character-avatar.sad,
.character-avatar-placeholder.sad {
	border-color: #2196f3;
	box-shadow: 0 0 10px rgba(33, 150, 243, 0.2);
}

.character-avatar.angry,
.character-avatar-placeholder.angry {
	border-color: #f44336;
	box-shadow: 0 0 10px rgba(244, 67, 54, 0.2);
}

.character-avatar.fear,
.character-avatar-placeholder.fear {
	border-color: #9c27b0;
	box-shadow: 0 0 10px rgba(156, 39, 176, 0.2);
}

.character-info {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	overflow: hidden;
	min-width: 0;
}

.character-name {
	margin: 0;
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--txt-primary, #e0e0e0);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.character-role {
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding: 0.1rem 0.4rem;
	border-radius: 4px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	display: inline-block;
	width: fit-content;
	color: var(--txt-muted, #888);
}

.character-mood {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	margin-top: 0.15rem;
}

.character-body {
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.character-stats {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.stat-bar {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}

.stat-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.75rem;
	color: var(--txt-muted, #888);
}

.stat-value-inline {
	font-weight: bold;
	color: var(--txt-primary, #e0e0e0);
}

.stat-trend {
	font-size: 0.7rem;
}

.stat-trend.trend-up {
	color: #4caf50;
}

.stat-trend.trend-down {
	color: #f44336;
}

.stat-track {
	width: 100%;
	height: 5px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-radius: 3px;
	overflow: hidden;
}

.stat-fill {
	height: 100%;
	background: var(--accent-primary, #c49b5c);
	border-radius: 3px;
	transition: width 0.5s ease;
}

.character-goal {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.75rem;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}

.goal-label {
	font-size: 0.75rem;
	color: var(--txt-muted, #888);
}

.goal-text {
	font-size: 0.9rem;
	color: var(--txt-secondary, #aaa);
	line-height: 1.4;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.spoiler-toggle {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	padding: 0.5rem 0.75rem;
	border-radius: 6px;
	color: var(--txt-muted, #888);
	cursor: pointer;
	font-size: 0.8rem;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	transition: all 0.2s ease;
	font-family: inherit;
}

.spoiler-toggle:hover {
	background: var(--bg-surface-4, rgba(70, 70, 90, 0.8));
	color: var(--txt-secondary, #aaa);
}

.spoiler-toggle.revealed {
	background: rgba(255, 152, 0, 0.15);
	border-color: rgba(255, 152, 0, 0.3);
}

.spoiler-content {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.75rem;
	border-radius: 8px;
	font-style: italic;
	color: var(--txt-secondary, #aaa);
	font-size: 0.9rem;
	line-height: 1.4;
	border-left: 3px solid #ff9800;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

/* ============================================
RELATIONSHIPS
============================================ */
.relationships-list {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.relationship-item {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 1rem;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.relationship-item.tension {
	border-left: 3px solid #f44;
}

.relationship-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.relationship-names {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: 500;
	color: var(--txt-primary, #e0e0e0);
	min-width: 0;
	flex-wrap: wrap;
}

.relationship-arrow {
	color: var(--txt-muted, #888);
}

.relationship-type {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	flex-shrink: 0;
}

.relationship-bar {
	width: 100%;
}

.relationship-track {
	width: 100%;
	height: 6px;
	background: linear-gradient(
		90deg,
		#f44336,
		var(--bg-surface-4, rgba(70, 70, 90, 0.8)) 50%,
		#4caf50
	);
	border-radius: 3px;
	position: relative;
}

.relationship-indicator {
	position: absolute;
	top: -2px;
	width: 10px;
	height: 10px;
	background: var(--txt-primary, #e0e0e0);
	border-radius: 50%;
	transform: translateX(-50%);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.relationship-status {
	font-size: 0.85rem;
	color: var(--txt-secondary, #aaa);
	font-style: italic;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.relationship-notes {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

/* ============================================
EMPTY STATES INLINE
============================================ */
.empty-state-inline {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3rem 2rem;
	color: var(--txt-muted, #888);
	text-align: center;
	gap: 0.75rem;
}

.empty-state-inline :global(i) {
	font-size: 2.5rem;
	opacity: 0.5;
}

.empty-state-inline p {
	margin: 0;
}

/* ============================================
LOCATION & WORLD
============================================ */
.location-description {
	margin: 0 0 1rem 0;
	line-height: 1.6;
	color: var(--txt-secondary, #aaa);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.atmosphere-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 0.75rem;
	margin-bottom: 1rem;
}

.atmosphere-item {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.75rem;
	border-radius: 8px;
}

.atm-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.4rem;
}

.atm-label {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	text-transform: capitalize;
}

.atm-value {
	font-size: 0.85rem;
	font-weight: bold;
	color: var(--txt-primary, #e0e0e0);
}

.atm-bar {
	width: 100%;
	height: 4px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-radius: 2px;
	overflow: hidden;
}

.atm-fill {
	height: 100%;
	background: var(--accent-secondary, #6a8fc7);
	border-radius: 2px;
	transition: width 0.5s ease;
}

.poi-section h5 {
	margin: 0 0 0.75rem 0;
	font-size: 0.95rem;
	color: var(--txt-primary, #e0e0e0);
}

.poi-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.poi-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.75rem;
	border-radius: 8px;
}

.poi-icon {
	font-size: 1.25rem;
	flex-shrink: 0;
}

.poi-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	min-width: 0;
}

.poi-name {
	font-weight: 500;
	color: var(--txt-primary, #e0e0e0);
}

.poi-hint {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	font-style: italic;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.poi-status {
	font-size: 0.7rem;
	text-transform: uppercase;
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	color: var(--txt-muted, #888);
	flex-shrink: 0;
	white-space: nowrap;
}

/* ============================================
INVENTORY
============================================ */
.resources-bar {
	display: flex;
	gap: 1rem;
	margin-bottom: 1rem;
	flex-wrap: wrap;
}

.resource-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.75rem 1rem;
	border-radius: 8px;
}

.resource-icon {
	font-size: 1.25rem;
}

.resource-value {
	font-weight: bold;
	color: var(--txt-primary, #e0e0e0);
}

.resource-label {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
}

.items-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.inventory-item {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 0.5rem 0.75rem;
	border-radius: 6px;
	font-size: 0.85rem;
}

.item-icon {
	font-size: 1rem;
	flex-shrink: 0;
}

.item-name {
	color: var(--txt-primary, #e0e0e0);
}

.item-quantity {
	color: var(--txt-gold, #c49b5c);
	font-weight: bold;
	font-size: 0.8rem;
}

.item-owner {
	color: var(--txt-muted, #888);
	font-size: 0.75rem;
}

.empty-text {
	margin: 0;
	color: var(--txt-muted, #888);
	font-style: italic;
}

/* ============================================
STORY ARC
============================================ */
.arc-card {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.arc-card p {
	margin: 0;
	line-height: 1.6;
	color: var(--txt-secondary, #aaa);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.arc-progress {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.progress-label {
	font-size: 0.8rem;
	color: var(--txt-muted, #888);
	white-space: nowrap;
	flex-shrink: 0;
}

.progress-bar {
	flex: 1;
	height: 8px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-radius: 4px;
	overflow: hidden;
	min-width: 0;
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #8b1a3a, #c49b5c);
	border-radius: 4px;
	transition: width 0.5s ease;
}

.progress-value {
	font-size: 0.9rem;
	font-weight: bold;
	color: var(--txt-primary, #e0e0e0);
	white-space: nowrap;
	flex-shrink: 0;
}

/* ============================================
UNRESOLVED
============================================ */
.unresolved-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.unresolved-item {
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	padding: 1rem;
	border-radius: 8px;
	border-left: 4px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

.unresolved-item.importance-high {
	border-left-color: #f44;
}

.unresolved-item.importance-medium {
	border-left-color: #ff9800;
}

.unresolved-item.importance-low {
	border-left-color: #2196f3;
}

.unresolved-type {
	font-size: 0.7rem;
	text-transform: uppercase;
	color: var(--txt-muted, #888);
	letter-spacing: 0.05em;
	margin-bottom: 0.3rem;
	display: block;
}

.unresolved-desc {
	margin: 0 0 0.5rem 0;
	line-height: 1.5;
	color: var(--txt-primary, #e0e0e0);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.unresolved-suggestion {
	font-size: 0.85rem;
	color: var(--txt-muted, #888);
	font-style: italic;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

/* ============================================
ACTIONS GRID
============================================ */
.actions-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	gap: 1rem;
}

.action-card {
	background: var(--glass-bg, rgba(255, 255, 255, 0.05));
	border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	border-radius: 10px;
	padding: 1rem;
	cursor: pointer;
	transition: all 0.2s ease;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	text-align: left;
	font-family: inherit;
	color: inherit;
}

.action-card:hover {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.action-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.action-category {
	font-size: 0.7rem;
	text-transform: uppercase;
	color: var(--txt-gold, #c49b5c);
	letter-spacing: 0.05em;
}

.action-risk {
	font-size: 0.7rem;
	padding: 0.15rem 0.4rem;
	border-radius: 4px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	flex-shrink: 0;
}

.action-risk.risk-high {
	background: rgba(244, 67, 54, 0.15);
	color: #f44;
}

.action-risk.risk-medium {
	background: rgba(255, 152, 0, 0.15);
	color: #ff9800;
}

.action-risk.risk-low {
	background: rgba(76, 175, 80, 0.15);
	color: #4caf50;
}

.action-text {
	margin: 0;
	font-size: 0.95rem;
	line-height: 1.4;
	color: var(--txt-primary, #e0e0e0);
	font-style: italic;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.action-reward {
	font-size: 0.85rem;
	color: var(--txt-muted, #888);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.action-insert {
	font-size: 0.8rem;
	color: var(--txt-gold, #c49b5c);
	display: flex;
	align-items: center;
	gap: 0.4rem;
	margin-top: auto;
}

/* ============================================
SUGGESTIONS LIST
============================================ */
.suggestions-list {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.suggestion-item {
	background: var(--glass-bg, rgba(255, 255, 255, 0.05));
	border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
	border-radius: 10px;
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	border-left: 4px solid transparent;
}

.suggestion-item.impact-high {
	border-left-color: #9c27b0;
}

.suggestion-item.impact-medium {
	border-left-color: #2196f3;
}

.suggestion-item.impact-low {
	border-left-color: #4caf50;
}

.suggestion-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.suggestion-title {
	font-weight: 600;
	font-size: 1rem;
	color: var(--txt-primary, #e0e0e0);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.suggestion-impact {
	font-size: 0.65rem;
	text-transform: uppercase;
	padding: 0.25rem 0.6rem;
	border-radius: 12px;
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	color: var(--txt-muted, #888);
	letter-spacing: 0.05em;
	font-weight: bold;
	flex-shrink: 0;
}

.suggestion-desc {
	margin: 0;
	font-size: 0.95rem;
	line-height: 1.55;
	color: var(--txt-secondary, #aaa);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

/* ============================================
FOOTER
============================================ */
.analytics-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1rem 1.5rem;
	background: var(--bg-surface-2, rgba(30, 30, 45, 0.9));
	border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	flex-shrink: 0;
	gap: 1rem;
	flex-wrap: wrap;
}

.analytics-timestamp {
	font-size: 0.85rem;
	color: var(--txt-muted, #888);
}

.analytics-footer-actions {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
}

.btn-icon,
.btn-primary,
.btn-secondary {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.6rem 1rem;
	border-radius: 8px;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	border: 1px solid transparent;
	font-family: inherit;
}

.btn-icon {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-color: var(--border-color, rgba(255, 255, 255, 0.1));
	color: var(--txt-secondary, #aaa);
}

.btn-icon:hover {
	background: var(--bg-surface-4, rgba(70, 70, 90, 0.8));
	color: var(--txt-primary, #e0e0e0);
	transform: translateY(-1px);
}

.btn-secondary {
	background: var(--bg-surface-3, rgba(50, 50, 70, 0.8));
	border-color: var(--border-color, rgba(255, 255, 255, 0.1));
	color: var(--txt-secondary, #aaa);
}

.btn-secondary:hover {
	background: var(--bg-surface-4, rgba(70, 70, 90, 0.8));
	color: var(--txt-primary, #e0e0e0);
}

.btn-primary {
	background: linear-gradient(135deg, #8b1a3a, #c49b5c);
	color: #fff;
	border-color: transparent;
	box-shadow: 0 0 12px rgba(196, 155, 92, 0.15);
}

.btn-primary:hover:not(:disabled) {
	filter: brightness(1.1);
	transform: translateY(-1px);
	box-shadow: 0 0 20px rgba(196, 155, 92, 0.3);
}

.btn-primary:active:not(:disabled) {
	transform: translateY(1px);
}

.btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
	box-shadow: none;
}

.btn-label {
	display: inline;
}

/* ============================================
ANIMATIONS
============================================ */
.fa-spin {
	animation: fa-spin 2s infinite linear;
}

@keyframes fa-spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

/* ============================================
RESPONSIVE - TABLET
============================================ */
@media (max-width: 768px) {
	.analytics-modal {
		max-height: 95vh;
		max-height: 95dvh;
	}

	.modal-header {
		padding: 1rem;
	}

	.analytics-header-icon {
		font-size: 1.5rem;
	}

	.analytics-header-text h3 {
		font-size: 1.1rem;
	}

	.analytics-summary-bar {
		padding: 1rem;
		gap: 0.75rem;
	}

	.summary-item {
		min-width: 120px;
		padding: 0.75rem;
	}

	.tension-item {
		min-width: 100%;
		order: -1;
	}

	.analytics-tabs {
		padding: 0 1rem;
	}

	.analytics-tab {
		padding: 0.75rem 0.875rem;
		font-size: 0.85rem;
	}

	.tab-label {
		display: none;
	}

	.analytics-tab-content {
		padding: 1rem;
	}

	.characters-grid {
		grid-template-columns: 1fr;
	}

	.actions-grid {
		grid-template-columns: 1fr;
	}

	.analytics-footer {
		padding: 1rem;
		flex-direction: column;
		align-items: stretch;
	}

	.analytics-timestamp {
		text-align: center;
	}

	.analytics-footer-actions {
		justify-content: center;
	}
}

/* ============================================
RESPONSIVE - MOBILE
============================================ */
@media (max-width: 480px) {
	.analytics-modal {
		max-height: 100vh;
		max-height: 100dvh;
		height: 100dvh;
		border-radius: 0;
		max-width: 100%;
		width: 100%;
	}

	.modal-header {
		padding: 0.75rem 1rem;
	}

	.analytics-header-content {
		gap: 0.75rem;
	}

	.analytics-header-icon {
		font-size: 1.25rem;
	}

	.analytics-header-text h3 {
		font-size: 1rem;
	}

	.analytics-header-subtitle {
		font-size: 0.75rem;
	}

	.analytics-header-btn,
	.modal-close-btn {
		width: 32px;
		height: 32px;
	}

	.state-container {
		padding: 3rem 1.5rem;
		min-height: 200px;
	}

	.state-container :global(i.fas) {
		font-size: 2.5rem;
	}

	.state-container h3 {
		font-size: 1.2rem;
	}

	.analytics-summary-bar {
		flex-direction: column;
		padding: 0.875rem;
		gap: 0.5rem;
	}

	.summary-item {
		min-width: 0;
		width: 100%;
	}

	.tension-item {
		min-width: 0;
	}

	.summary-icon {
		font-size: 1.5rem;
	}

	.analytics-tabs {
		padding: 0 0.5rem;
		gap: 0;
	}

	.analytics-tab {
		padding: 0.75rem 0.5rem;
		flex: 1;
		justify-content: center;
		min-width: 0;
	}

	.analytics-tab :global(i) {
		font-size: 1rem;
	}

	.analytics-tab-content {
		padding: 0.875rem;
		gap: 1rem;
	}

	.section-header {
		padding: 0.875rem 1rem;
	}

	.section-header h4 {
		font-size: 0.9rem;
		gap: 0.5rem;
	}

	.section-body {
		padding: 0.875rem;
	}

	.stats-grid {
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.stat-card {
		padding: 0.75rem 0.5rem;
	}

	.stat-card .stat-value {
		font-size: 1.1rem;
	}

	.stat-card .stat-label {
		font-size: 0.65rem;
	}

	.character-header {
		padding: 0.875rem;
	}

	.character-avatar,
	.character-avatar-placeholder {
		width: 42px;
		height: 42px;
	}

	.character-body {
		padding: 0.875rem;
	}

	.warning-item {
		padding: 0.75rem;
		gap: 0.75rem;
	}

	.analytics-footer {
		padding: 0.75rem 1rem;
	}

	.analytics-footer-actions {
		width: 100%;
	}

	.btn-icon,
	.btn-primary,
	.btn-secondary {
		flex: 1;
		padding: 0.75rem 0.5rem;
	}

	.btn-label {
		display: none;
	}

	.atmosphere-grid {
		grid-template-columns: 1fr;
	}

	.relationships-list {
		gap: 0.5rem;
	}

	.relationship-item {
		padding: 0.75rem;
	}

	.relationship-names {
		font-size: 0.9rem;
	}

	.actions-grid {
		grid-template-columns: 1fr;
	}

	.action-card {
		padding: 0.75rem;
	}

	.suggestion-item {
		padding: 1rem;
	}

	.poi-item {
		padding: 0.625rem;
		gap: 0.5rem;
	}

	.empty-state-inline {
		padding: 2rem 1.5rem;
	}

	.empty-state-inline :global(i) {
		font-size: 2rem;
	}
}

/* ============================================
RESPONSIVE - VERY SMALL SCREENS
============================================ */
@media (max-width: 360px) {
	.analytics-modal {
		height: 100dvh;
	}

	.modal-header {
		padding: 0.625rem 0.75rem;
	}

	.analytics-header-icon {
		font-size: 1.1rem;
	}

	.analytics-header-text h3 {
		font-size: 0.9rem;
	}

	.analytics-header-subtitle {
		font-size: 0.7rem;
	}

	.analytics-tab-content {
		padding: 0.75rem;
		gap: 0.75rem;
	}

	.section-body {
		padding: 0.75rem;
	}

	.stats-grid {
		grid-template-columns: repeat(2, 1fr);
		gap: 0.4rem;
	}

	.stat-card {
		padding: 0.5rem 0.25rem;
	}

	.stat-card .stat-icon {
		font-size: 1.25rem;
	}

	.stat-card .stat-value {
		font-size: 1rem;
	}

	.analytics-footer {
		padding: 0.625rem 0.75rem;
	}

	.analytics-footer-actions {
		gap: 0.375rem;
	}

	.btn-icon,
	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 0.375rem;
		font-size: 0.8rem;
	}
}
</style>