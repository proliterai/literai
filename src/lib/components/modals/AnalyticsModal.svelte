<!-- ================================================================================
ФАЙЛ: src/lib/components/modals/AnalyticsModal.svelte
Описание: Расширенное модальное окно AI-аналитики чата
================================================================================ -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/ui/ui.store';
	import { chatStore } from '$lib/domain/chat/chat.store';
	import { page } from '$app/stores';
	import { analyticsService } from '$lib/domain/analytics/analytics.service';
	import type { AnalyticsData, AnalyticsUIState } from '$lib/domain/analytics/analytics.types';

	// Состояние компонента
	let analyzing = $state(false);
	let analyticsData = $state<AnalyticsData | null>(null);
	let lastAnalysisTime = $state<number | null>(null);
	let loadingStage = $state('');

	// UI состояние
	let uiState = $state<AnalyticsUIState>({
		activeTab: 'overview',
		expandedSections: new Set(['meta', 'characters', 'predictions']),
		revealedSpoilers: new Set(),
		selectedCharacter: null
	});

	// Derived состояния
	let isChatRoute = $derived($page.url.pathname.startsWith('/roleplay/chat/'));

	// Загружаем кэшированные данные при монтировании
	onMount(() => {
		const cached = analyticsService.getCachedData();
		if (cached) {
			analyticsData = cached;
			lastAnalysisTime = analyticsService.getLastAnalysisTime();
		}
	});

	// Этапы загрузки
	const loadingStages = [
		'Сканирование событий...',
		'Анализ персонажей...',
		'Оценка отношений...',
		'Исследование локации...',
		'Анализ сюжетных линий...',
		'Генерация предсказаний...',
		'Формирование советов...',
		'Финализация отчёта...'
	];

	// Запуск анализа
	async function runAnalysis(forceUpdate: boolean = false): Promise<void> {
		if (!isChatRoute) {
			ui.notify('Откройте чат для анализа', 'warning');
			return;
		}

		analyzing = true;
		let stageIndex = 0;

		const stageInterval = setInterval(() => {
			stageIndex = (stageIndex + 1) % loadingStages.length;
			loadingStage = loadingStages[stageIndex];
		}, 1500);

		if (forceUpdate) {
			analyticsData = null;
			analyticsService.clearCache();
		}

		try {
			const result = await analyticsService.runAnalysis(forceUpdate);
			analyticsData = result;
			lastAnalysisTime = analyticsService.getLastAnalysisTime();
			ui.notify('Анализ завершён', 'success');
		} catch (e: unknown) {
			console.error('[AnalyticsModal] Ошибка анализа:', e);
			const errorMessage = e instanceof Error ? e.message : 'Неизвестная ошибка';
			ui.notify(`Ошибка: ${errorMessage}`, 'error');

			if (forceUpdate) {
				const cached = analyticsService.getCachedData();
				if (cached) {
					analyticsData = cached;
					lastAnalysisTime = analyticsService.getLastAnalysisTime();
				}
			}
		} finally {
			clearInterval(stageInterval);
			analyzing = false;
			loadingStage = '';
		}
	}

	// Форматирование времени
	function formatLastUpdateTime(time: number | null): string {
		if (!time) return '—';
		return new Date(time).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Экспорт данных
	function exportJSON(): void {
		if (!analyticsData) {
			ui.notify('Нет данных для экспорта', 'warning');
			return;
		}
		const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `analytics_${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		ui.notify('JSON экспортирован', 'success');
	}

	// Копирование сводки
	function copySummary(): void {
		if (!analyticsData?.meta?.chapterSummary) {
			ui.notify('Нет сводки для копирования', 'warning');
			return;
		}
		navigator.clipboard
			.writeText(analyticsData.meta.chapterSummary)
			.then(() => ui.notify('Сводка скопирована', 'success'))
			.catch(() => ui.notify('Не удалось скопировать', 'error'));
	}

	// Переключение секции
	function toggleSection(sectionId: string): void {
		const newSet = new Set(uiState.expandedSections);
		if (newSet.has(sectionId)) {
			newSet.delete(sectionId);
		} else {
			newSet.add(sectionId);
		}
		uiState = { ...uiState, expandedSections: newSet };
	}

	// Переключение спойлера
	function toggleSpoiler(spoilerId: string): void {
		const newSet = new Set(uiState.revealedSpoilers);
		if (newSet.has(spoilerId)) {
			newSet.delete(spoilerId);
		} else {
			newSet.add(spoilerId);
		}
		uiState = { ...uiState, revealedSpoilers: newSet };
	}

	// Вставка действия в чат
	function insertAction(text: string): void {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				ui.notify('Действие скопировано в буфер', 'success');
			})
			.catch(() => {
				ui.notify('Не удалось скопировать', 'error');
			});
	}

	// Обработчики событий
	function handleClose(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		ui.closeModal();
	}

	function handleRunAnalysis(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		runAnalysis(false);
	}

	function handleRefresh(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		runAnalysis(true);
	}

	// Вспомогательные функции
	function getPhaseIcon(phase: string): string {
		const icons: Record<string, string> = {
			начало: '🌅',
			завязка: '⚡',
			развитие: '📈',
			кульминация: '🔥',
			развязка: '🏁'
		};
		return icons[phase] || '📖';
	}

	function getTimeIcon(period: string): string {
		const icons: Record<string, string> = {
			рассвет: '🌅',
			утро: '☀️',
			день: '🌞',
			вечер: '🌆',
			закат: '🌇',
			ночь: '🌙',
			полночь: '🌑'
		};
		return icons[period] || '🕐';
	}

	function getLocationIcon(type: string): string {
		const icons: Record<string, string> = {
			город: '🏰',
			лес: '🌲',
			подземелье: '🕳️',
			здание: '🏠',
			дорога: '🛤️',
			пещера: '🕳️',
			гора: '⛰️',
			море: '🌊',
			пустыня: '🏜️',
			болото: '🌿',
			храм: '⛩️',
			руины: '🏚️',
			таверна: '🍺',
			замок: '🏰',
			деревня: '🏘️'
		};
		return icons[type?.toLowerCase()] || '📍';
	}

	function getDangerLevel(value: number): { text: string; class: string; icon: string } {
		if (value < 30) return { text: 'Низкая', class: 'low', icon: '✅' };
		if (value < 60) return { text: 'Средняя', class: 'medium', icon: '⚠️' };
		return { text: 'Высокая', class: 'high', icon: '☠️' };
	}

	function getTrendIcon(trend: string): string {
		if (trend === 'up') return '↑';
		if (trend === 'down') return '↓';
		return '→';
	}

	function getRelationshipIcon(type: string): string {
		const icons: Record<string, string> = {
			романтика: '💕',
			симпатия: '💛',
			дружба: '🤝',
			уважение: '🎓',
			нейтралитет: '😐',
			неприязнь: '😒',
			вражда: '😠',
			соперничество: '⚔️',
			страх: '😨',
			зависимость: '🔗',
			наставничество: '📚',
			преданность: '💎'
		};
		return icons[type] || '━━━▶';
	}

	function getRarityClass(rarity: string): string {
		return `rarity-${rarity || 'common'}`;
	}

	function getMoodClass(mood: string): string {
		if (!mood) return '';
		const moodLower = mood.toLowerCase();
		if (
			['счастье', 'радость', 'восторг', 'веселье', 'довольство'].some((m) =>
				moodLower.includes(m)
			)
		)
			return 'happy';
		if (['грусть', 'печаль', 'тоска', 'уныние', 'меланхолия'].some((m) => moodLower.includes(m)))
			return 'sad';
		if (
			['злость', 'гнев', 'ярость', 'раздражение', 'бешенство'].some((m) => moodLower.includes(m))
		)
			return 'angry';
		if (['страх', 'ужас', 'тревога', 'паника'].some((m) => moodLower.includes(m))) return 'fear';
		return '';
	}
</script>

<div class="modal-panel analytics-modal">
	<div class="modal-header">
		<div class="analytics-header-content">
			<span class="analytics-header-icon">🎲</span>
			<div class="analytics-header-text">
				<h3>Панель аналитики</h3>
				{#if analyticsData?.meta}
					<span class="analytics-header-subtitle">
						{getPhaseIcon(analyticsData.meta.storyPhase)}
						{analyticsData.meta.storyPhase} • День {analyticsData.meta.gameDay}
					</span>
				{/if}
			</div>
		</div>
		<div class="analytics-header-actions">
			{#if analyticsData}
				<button
					type="button"
					class="analytics-header-btn"
					onclick={handleRefresh}
					disabled={analyzing}
					title="Обновить анализ"
				>
					<i class="fas fa-sync-alt" class:fa-spin={analyzing}></i>
				</button>
			{/if}
			<button type="button" class="modal-close-btn" aria-label="Закрыть" onclick={handleClose}>
				<i class="fas fa-times"></i>
			</button>
		</div>
	</div>

	<div class="modal-body">
		{#if !isChatRoute}
			<div class="analytics-placeholder">
				<i class="fas fa-exclamation-triangle"></i>
				<p>Откройте чат для просмотра аналитики</p>
			</div>
		{:else if analyzing}
			<div class="analytics-loading">
				<div class="analytics-loading-rings">
					<div class="analytics-loading-ring"></div>
					<div class="analytics-loading-ring"></div>
					<div class="analytics-loading-ring"></div>
				</div>
				<p class="analytics-loading-text">Анализирую историю...</p>
				<p class="analytics-loading-stage">{loadingStage || 'Подготовка...'}</p>
				<div class="analytics-loading-progress">
					<div class="analytics-loading-progress-bar"></div>
				</div>
			</div>
		{:else if analyticsData}
			<div class="analytics-results">
				<!-- Сводная панель -->
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
							<span class="summary-label">Напряжение</span>
							<div class="tension-bar">
								<div
									class="tension-fill"
									style="width: {analyticsData.meta?.overallTension || 0}%"
								></div>
							</div>
						</div>
						<span class="summary-value">{analyticsData.meta?.overallTension || 0}%</span>
					</div>

					{#if analyticsData.location?.timeOfDay}
						<div class="summary-item">
							<span class="summary-icon"
								>{getTimeIcon(analyticsData.location.timeOfDay.period)}</span
							>
							<div class="summary-content">
								<span class="summary-label">Время</span>
								<span class="summary-value">{analyticsData.location.timeOfDay.period}</span>
							</div>
						</div>
					{/if}

					{#if analyticsData.location?.weather}
						<div class="summary-item">
							<span class="summary-icon">{analyticsData.location.weather.icon || '☀️'}</span>
							<div class="summary-content">
								<span class="summary-label">Погода</span>
								<span class="summary-value">{analyticsData.location.weather.type}</span>
							</div>
						</div>
					{/if}

					<div class="summary-item">
						<span class="summary-icon">📅</span>
						<div class="summary-content">
							<span class="summary-label">День</span>
							<span class="summary-value">{analyticsData.meta?.gameDay || 1}</span>
						</div>
					</div>

					{#if analyticsData.location?.atmosphere?.danger !== undefined}
						{@const danger = getDangerLevel(analyticsData.location.atmosphere.danger)}
						<div class="summary-item">
							<span class="summary-icon">{danger.icon}</span>
							<div class="summary-content">
								<span class="summary-label">Опасность</span>
								<span class="summary-value danger-{danger.class}">{danger.text}</span>
							</div>
						</div>
					{/if}
				</div>

				<!-- Вкладки навигации -->
				<div class="analytics-tabs">
					<button
						type="button"
						class="analytics-tab"
						class:active={uiState.activeTab === 'overview'}
						onclick={() => (uiState.activeTab = 'overview')}
					>
						<i class="fas fa-home"></i> Обзор
					</button>
					<button
						type="button"
						class="analytics-tab"
						class:active={uiState.activeTab === 'characters'}
						onclick={() => (uiState.activeTab = 'characters')}
					>
						<i class="fas fa-users"></i> Персонажи
					</button>
					<button
						type="button"
						class="analytics-tab"
						class:active={uiState.activeTab === 'world'}
						onclick={() => (uiState.activeTab = 'world')}
					>
						<i class="fas fa-globe"></i> Мир
					</button>
					<button
						type="button"
						class="analytics-tab"
						class:active={uiState.activeTab === 'story'}
						onclick={() => (uiState.activeTab = 'story')}
					>
						<i class="fas fa-book"></i> Сюжет
					</button>
					<button
						type="button"
						class="analytics-tab"
						class:active={uiState.activeTab === 'predictions'}
						onclick={() => (uiState.activeTab = 'predictions')}
					>
						<i class="fas fa-crystal-ball"></i> Советы
					</button>
				</div>

				<!-- Контент вкладок -->
				<div class="analytics-tab-content">
					<!-- ОБЗОР -->
					{#if uiState.activeTab === 'overview'}
						<!-- Текущая ситуация -->
						{#if analyticsData.meta?.chapterSummary}
							<section class="analytics-section">
								<button
									type="button"
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
											{#each analyticsData.meta.chapterSummary.split('\n').filter((p) => p.trim()) as paragraph}
												<p>{paragraph.trim()}</p>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						<!-- Статистика сессии -->
						{#if analyticsData.sessionStats}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('stats')}
								>
									<h4><i class="fas fa-chart-bar"></i> Статистика сессии</h4>
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
												<span class="stat-value"
													>{analyticsData.sessionStats.messagesCount || 0}</span
												>
												<span class="stat-label">сообщений</span>
											</div>
											<div class="stat-card">
												<span class="stat-icon">📝</span>
												<span class="stat-value"
													>{analyticsData.sessionStats.wordsWritten || 0}</span
												>
												<span class="stat-label">слов</span>
											</div>
											<div class="stat-card">
												<span class="stat-icon">⏱️</span>
												<span class="stat-value"
													>{analyticsData.sessionStats.duration || '—'}</span
												>
												<span class="stat-label">длительность</span>
											</div>
											<div class="stat-card">
												<span class="stat-icon">📊</span>
												<span class="stat-value"
													>{analyticsData.sessionStats.averageMessageLength || 0}</span
												>
												<span class="stat-label">слов/сообщение</span>
											</div>
										</div>

										{#if analyticsData.sessionStats.actionVsDialogue}
											<div class="content-distribution">
												<h5>Распределение контента</h5>
												<div class="distribution-bar">
													<div
														class="distribution-segment action"
														style="width: {analyticsData.sessionStats.actionVsDialogue
															.action}%"
														title="Действия: {analyticsData.sessionStats.actionVsDialogue
															.action}%"
													></div>
													<div
														class="distribution-segment dialogue"
														style="width: {analyticsData.sessionStats.actionVsDialogue
															.dialogue}%"
														title="Диалоги: {analyticsData.sessionStats.actionVsDialogue
															.dialogue}%"
													></div>
													<div
														class="distribution-segment description"
														style="width: {analyticsData.sessionStats.actionVsDialogue
															.description}%"
														title="Описания: {analyticsData.sessionStats.actionVsDialogue
															.description}%"
													></div>
												</div>
												<div class="distribution-legend">
													<span class="legend-item"
														><span class="legend-dot action"></span> Действия</span
													>
													<span class="legend-item"
														><span class="legend-dot dialogue"></span> Диалоги</span
													>
													<span class="legend-item"
														><span class="legend-dot description"></span> Описания</span
													>
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</section>
						{/if}

						<!-- Быстрые предупреждения -->
						{#if analyticsData.predictions?.warnings && analyticsData.predictions.warnings.length > 0}
							<section class="analytics-section warnings-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('warnings')}
								>
									<h4><i class="fas fa-exclamation-triangle"></i> Внимание</h4>
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
															<span class="warning-suggestion"
																>💡 {warning.suggestion}</span
															>
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

					<!-- ПЕРСОНАЖИ -->
					{#if uiState.activeTab === 'characters'}
						{#if analyticsData.characters && analyticsData.characters.length > 0}
							<div class="characters-grid">
								{#each analyticsData.characters as char, index (char.id || char.name || index)}
									{@const isCritical = (char.stats?.health?.value || 100) < 25}
									{@const moodClass = getMoodClass(char.mood?.primary || '')}
									<div class="character-card" class:critical={isCritical}>
										<div class="character-header">
											{#if char.avatar}
												<img
													class="character-avatar {moodClass}"
													src={char.avatar}
													alt={char.name}
													onerror={(e) => {
														if (e.currentTarget instanceof HTMLImageElement) {
															e.currentTarget.style.display = 'none';
														}
													}}
												/>
											{:else}
												<div class="character-avatar-placeholder {moodClass}">
													<i class="fas fa-user"></i>
												</div>
											{/if}
											<div class="character-info">
												<h5 class="character-name">{char.name}</h5>
												{#if char.role && char.role !== 'unknown'}
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
															{@const statIcons = {
																health: '❤️',
																energy: '⚡',
																hunger: '🍖',
																sanity: '🧠',
																mana: '✨'
															}}
															{@const statLabels = {
																health: 'Здоровье',
																energy: 'Энергия',
																hunger: 'Сытость',
																sanity: 'Рассудок',
																mana: 'Мана'
															}}
															<div class="stat-bar stat-{statName}">
																<div class="stat-header">
																	<span class="stat-label">
																		{statIcons[statName as keyof typeof statIcons] || '📊'}
																		{statLabels[statName as keyof typeof statLabels] ||
																			statName}
																	</span>
																	<span class="stat-value">
																		{statData.value}%
																		<span class="stat-trend trend-{statData.trend}"
																			>{getTrendIcon(statData.trend)}</span
																		>
																	</span>
																</div>
																<div class="stat-track">
																	<div class="stat-fill" style="width: {statData.value}%"
																	></div>
																</div>
															</div>
														{/if}
													{/each}
												</div>
											{/if}

											{#if char.statusEffects && char.statusEffects.length > 0}
												<div class="status-effects">
													{#each char.statusEffects as effect}
														<span
															class="status-tag"
															class:positive={effect.isPositive}
															class:negative={!effect.isPositive}
															title={effect.duration ? `Длительность: ${effect.duration}` : ''}
														>
															{effect.icon} {effect.name}
														</span>
													{/each}
												</div>
											{/if}

											{#if char.currentGoal}
												<div class="character-goal">
													<span class="goal-label">🎯 Цель</span>
													<span class="goal-text">{char.currentGoal}</span>
												</div>
											{/if}

											{#if char.characterArc}
												<div class="character-arc">
													<span class="arc-label">📈 Арка: {char.characterArc.name}</span>
													<span class="arc-stage stage-{char.characterArc.stage}"
														>{char.characterArc.stage}</span
													>
												</div>
											{/if}

											{#if char.secretThought}
												<button
													type="button"
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

							<!-- Отношения -->
							{#if analyticsData.relationships && analyticsData.relationships.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('relationships')}
									>
										<h4><i class="fas fa-heart"></i> Отношения</h4>
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
																<span class="relationship-arrow"
																	>{getRelationshipIcon(rel.type)}</span
																>
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
														<div class="relationship-change change-{rel.recentChange}">
															{getTrendIcon(rel.recentChange)}
															{rel.recentChange === 'up'
																? 'Улучшились'
																: rel.recentChange === 'down'
																	? 'Ухудшились'
																	: 'Стабильно'}
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}
						{:else}
							<div class="empty-state">
								<i class="fas fa-users"></i>
								<p>Персонажи не обнаружены</p>
							</div>
						{/if}
					{/if}

					<!-- МИР -->
					{#if uiState.activeTab === 'world'}
						<!-- Локация -->
						{#if analyticsData.location && analyticsData.location.name}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('location')}
								>
									<h4>
										<i class="fas fa-map-marker-alt"></i>
										{getLocationIcon(analyticsData.location.type)}
										{analyticsData.location.name}
									</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('location')}
									></i>
								</button>
								{#if uiState.expandedSections.has('location')}
									<div class="section-body">
										<div class="location-card">
											<div class="location-meta">
												<span class="meta-tag">📍 {analyticsData.location.type}</span>
												{#if analyticsData.location.timeOfDay}
													<span class="meta-tag">
														{analyticsData.location.timeOfDay.icon || '🌞'}
														{analyticsData.location.timeOfDay.period}
													</span>
												{/if}
												{#if analyticsData.location.weather}
													<span class="meta-tag">
														{analyticsData.location.weather.icon || '☀️'}
														{analyticsData.location.weather.type}
													</span>
													<span class="meta-tag"
														>🌡️ {analyticsData.location.weather.temperature}</span
													>
												{/if}
											</div>

											{#if analyticsData.location.description}
												<p class="location-description">{analyticsData.location.description}</p>
											{/if}

											{#if analyticsData.location.atmosphere}
												<div class="atmosphere-grid">
													{#each Object.entries(analyticsData.location.atmosphere) as [key, value]}
														{#if value !== null && value !== undefined}
															{@const atmLabels = {
																danger: { icon: '☠️', name: 'Опасность' },
																comfort: { icon: '🛋️', name: 'Комфорт' },
																mystery: { icon: '🔮', name: 'Тайна' },
																visibility: { icon: '👁️', name: 'Видимость' },
																magic: { icon: '✨', name: 'Магия' },
																hostility: { icon: '⚔️', name: 'Враждебность' }
															}}
															{@const label =
																atmLabels[key as keyof typeof atmLabels] || {
																	icon: '📊',
																	name: key
																}}
															<div class="atmosphere-item atm-{key}">
																<div class="atm-header">
																	<span class="atm-label">{label.icon} {label.name}</span>
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

											{#if analyticsData.location.pointsOfInterest && analyticsData.location.pointsOfInterest.length > 0}
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
																<span class="poi-status status-{poi.status}">
																	{poi.status === 'unexplored'
																		? 'Не исследовано'
																		: poi.status === 'explored'
																			? 'Исследовано'
																			: poi.status === 'blocked'
																				? 'Заблокировано'
																				: poi.status}
																</span>
															</div>
														{/each}
													</div>
												</div>
											{/if}

											{#if analyticsData.location.exits && analyticsData.location.exits.length > 0}
												<div class="exits-section">
													<h5>🧭 Направления</h5>
													<div class="exits-grid">
														{#each analyticsData.location.exits as exit}
															{@const dangerInfo = getDangerLevel(exit.danger)}
															<div class="exit-item">
																<span class="exit-direction">
																	{exit.direction}
																</span>
																<span class="exit-destination">
																	{exit.locked ? '🔒 ' : ''}{exit.destination}
																</span>
																<span class="exit-danger danger-{dangerInfo.class}">
																	{dangerInfo.icon}
																	{exit.danger}%
																</span>
															</div>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						<!-- Инвентарь -->
						{#if analyticsData.inventory}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('inventory')}
								>
									<h4><i class="fas fa-backpack"></i> Инвентарь</h4>
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
													<span class="resource-value"
														>{analyticsData.inventory.resources.gold || 0}</span
													>
													<span class="resource-label">золота</span>
												</div>
												<div class="resource-item">
													<span class="resource-icon">🍖</span>
													<span class="resource-value"
														>{analyticsData.inventory.resources.food || 0}</span
													>
													<span class="resource-label">рационов</span>
												</div>
												{#if analyticsData.inventory.resources.special}
													{#each analyticsData.inventory.resources.special as special}
														<div class="resource-item">
															<span class="resource-icon">{special.icon || '💎'}</span>
															<span class="resource-value">{special.amount}</span>
															<span class="resource-label">{special.name}</span>
														</div>
													{/each}
												{/if}
											</div>
										{/if}

										{#if analyticsData.inventory.items && analyticsData.inventory.items.length > 0}
											<div class="items-grid">
												{#each analyticsData.inventory.items as item}
													<div
														class="inventory-item {getRarityClass(item.rarity || 'common')}"
														class:quest-item={item.questRelated}
														title={item.description}
													>
														<span class="item-icon">{item.icon}</span>
														<span class="item-name">{item.name}</span>
														{#if item.quantity > 1}
															<span class="item-quantity">x{item.quantity}</span>
														{/if}
														<span class="item-owner"
															>[{item.owner === 'shared' ? 'Общее' : item.owner}]</span
														>
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

					<!-- СЮЖЕТ -->
					{#if uiState.activeTab === 'story'}
						<!-- Анализ сюжета -->
						{#if analyticsData.storyAnalytics}
							<!-- Текущая арка -->
							{#if analyticsData.storyAnalytics.currentArc}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('arc')}
									>
										<h4><i class="fas fa-theater-masks"></i> Текущая сюжетная арка</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('arc')}
										></i>
									</button>
									{#if uiState.expandedSections.has('arc')}
										<div class="section-body">
											<div class="arc-card">
												<h5>{analyticsData.storyAnalytics.currentArc.name}</h5>
												<p>{analyticsData.storyAnalytics.currentArc.description}</p>
												<div class="arc-progress">
													<span class="progress-label">Прогресс арки</span>
													<div class="progress-bar">
														<div
															class="progress-fill"
															style="width: {analyticsData.storyAnalytics.currentArc
																.progress}%"
														></div>
													</div>
													<span class="progress-value"
														>{analyticsData.storyAnalytics.currentArc.progress}%</span
													>
												</div>
											</div>
										</div>
									{/if}
								</section>
							{/if}

							<!-- Темп и тон -->
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('pacing')}
								>
									<h4><i class="fas fa-tachometer-alt"></i> Темп и тон</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('pacing')}
									></i>
								</button>
								{#if uiState.expandedSections.has('pacing')}
									<div class="section-body">
										<div class="pacing-info">
											{#if analyticsData.storyAnalytics.pacing}
												<div class="info-row">
													<span class="info-label">⏱️ Темп:</span>
													<span class="info-value"
														>{analyticsData.storyAnalytics.pacing.current}</span
													>
												</div>
												{#if analyticsData.storyAnalytics.pacing.recommendation}
													<div class="recommendation">
														💡 {analyticsData.storyAnalytics.pacing.recommendation}
													</div>
												{/if}
											{/if}
											{#if analyticsData.storyAnalytics.tone}
												<div class="info-row">
													<span class="info-label">🎭 Основной тон:</span>
													<span class="info-value"
														>{analyticsData.storyAnalytics.tone.primary}</span
													>
												</div>
												{#if analyticsData.storyAnalytics.tone.secondary}
													<div class="info-row">
														<span class="info-label">🎭 Вторичный тон:</span>
														<span class="info-value"
															>{analyticsData.storyAnalytics.tone.secondary}</span
														>
													</div>
												{/if}
											{/if}
										</div>
									</div>
								{/if}
							</section>

							<!-- Темы -->
							{#if analyticsData.storyAnalytics.themes && analyticsData.storyAnalytics.themes.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('themes')}
									>
										<h4><i class="fas fa-palette"></i> Темы истории</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('themes')}
										></i>
									</button>
									{#if uiState.expandedSections.has('themes')}
										<div class="section-body">
											<div class="themes-list">
												{#each analyticsData.storyAnalytics.themes as theme}
													<div class="theme-item">
														<div class="theme-header">
															<span class="theme-icon">{theme.icon}</span>
															<span class="theme-name">{theme.name}</span>
															<span class="theme-prominence">{theme.prominence}%</span>
														</div>
														<div class="theme-bar">
															<div
																class="theme-fill"
																style="width: {theme.prominence}%"
															></div>
														</div>
														{#if theme.examples && theme.examples.length > 0}
															<div class="theme-examples">
																{#each theme.examples as example}
																	<span class="example-tag">{example}</span>
																{/each}
															</div>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}

							<!-- Нерешённые вопросы -->
							{#if analyticsData.storyAnalytics.unresolved && analyticsData.storyAnalytics.unresolved.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('unresolved')}
									>
										<h4><i class="fas fa-question-circle"></i> Открытые вопросы</h4>
										<span class="count-badge"
											>{analyticsData.storyAnalytics.unresolved.length}</span
										>
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
															<div class="unresolved-suggestion">
																💡 {item.suggestedResolution}
															</div>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}
						{/if}

						<!-- Квесты -->
						{#if analyticsData.quests}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('quests')}
								>
									<h4><i class="fas fa-scroll"></i> Квесты</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('quests')}
									></i>
								</button>
								{#if uiState.expandedSections.has('quests')}
									<div class="section-body">
										{#if analyticsData.quests.main}
											<div class="main-quest">
												<div class="quest-header">
													<span class="quest-icon">👑</span>
													<span class="quest-title">{analyticsData.quests.main.name}</span>
												</div>
												<p class="quest-description">
													{analyticsData.quests.main.description}
												</p>
												{#if analyticsData.quests.main.currentObjective}
													<div class="quest-objective">
														📌 {analyticsData.quests.main.currentObjective}
													</div>
												{/if}
												<div class="quest-progress">
													<div class="progress-bar">
														<div
															class="progress-fill"
															style="width: {analyticsData.quests.main.progress}%"
														></div>
													</div>
													<span class="progress-value"
														>{analyticsData.quests.main.progress}%</span
													>
												</div>
												{#if analyticsData.quests.main.stages && analyticsData.quests.main.stages.length > 0}
													<div class="quest-stages">
														{#each analyticsData.quests.main.stages as stage}
															<div class="stage-item stage-{stage.status}">
																<span class="stage-icon">
																	{stage.status === 'completed'
																		? '✅'
																		: stage.status === 'current'
																			? '⏳'
																			: '☐'}
																</span>
																<span class="stage-name">{stage.name}</span>
															</div>
														{/each}
													</div>
												{/if}
											</div>
										{/if}

										{#if analyticsData.quests.side && analyticsData.quests.side.length > 0}
											<div class="side-quests">
												<h5>📋 Побочные квесты</h5>
												{#each analyticsData.quests.side as quest}
													<div class="side-quest-item status-{quest.status}">
														<span class="quest-status-icon">
															{quest.status === 'completed'
																? '✅'
																: quest.status === 'failed'
																	? '❌'
																	: '☐'}
														</span>
														<div class="quest-info">
															<span class="quest-name">{quest.name}</span>
															<span class="quest-desc">{quest.description}</span>
														</div>
														<div class="quest-progress-mini">
															<div class="progress-bar-mini">
																<div
																	class="progress-fill"
																	style="width: {quest.progress}%"
																></div>
															</div>
															<span>{quest.progress}%</span>
														</div>
													</div>
												{/each}
											</div>
										{/if}

										{#if analyticsData.quests.hints && analyticsData.quests.hints.length > 0}
											<div class="quest-hints">
												<h5>💡 Подсказки</h5>
												<ul>
													{#each analyticsData.quests.hints as hint}
														<li>{hint}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								{/if}
							</section>
						{/if}
					{/if}

					<!-- СОВЕТЫ -->
					{#if uiState.activeTab === 'predictions'}
						<!-- Немедленные действия -->
						{#if analyticsData.predictions?.immediateOptions && analyticsData.predictions.immediateOptions.length > 0}
							<section class="analytics-section">
								<button
									type="button"
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
													type="button"
													class="action-card"
													onclick={() => insertAction(action.insertText || action.action)}
												>
													<div class="action-header">
														<span class="action-category">{action.category || 'other'}</span>
														<span class="action-risk risk-{action.risk}">
															{action.risk === 'low'
																? '🟢 Низкий'
																: action.risk === 'medium'
																	? '🟡 Средний'
																	: '🔴 Высокий'}
														</span>
													</div>
													<p class="action-text">"{action.action}"</p>
													<div class="action-reward">{action.potentialReward}</div>
													{#if action.successChance}
														<div class="action-chance">
															Шанс успеха: {action.successChance}%
														</div>
													{/if}
													<div class="action-insert">
														<i class="fas fa-copy"></i> Нажмите чтобы скопировать
													</div>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						<!-- Моменты персонажей -->
						{#if analyticsData.predictions?.characterMoments && analyticsData.predictions.characterMoments.length > 0}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('moments')}
								>
									<h4><i class="fas fa-star"></i> Моменты для персонажей</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('moments')}
									></i>
								</button>
								{#if uiState.expandedSections.has('moments')}
									<div class="section-body">
										<div class="moments-list">
											{#each analyticsData.predictions.characterMoments as moment}
												<div class="moment-item type-{moment.type}">
													<span class="moment-character">{moment.character}</span>
													<span class="moment-type">{moment.type}</span>
													<p class="moment-opportunity">{moment.opportunity}</p>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						<!-- Сюжетные зацепки -->
						{#if analyticsData.predictions?.plotHooks && analyticsData.predictions.plotHooks.length > 0}
							<section class="analytics-section">
								<button
									type="button"
									class="section-header"
									onclick={() => toggleSection('hooks')}
								>
									<h4><i class="fas fa-link"></i> Сюжетные зацепки</h4>
									<i
										class="fas fa-chevron-down section-toggle"
										class:rotated={!uiState.expandedSections.has('hooks')}
									></i>
								</button>
								{#if uiState.expandedSections.has('hooks')}
									<div class="section-body">
										<div class="hooks-list">
											{#each analyticsData.predictions.plotHooks as hook}
												<div class="hook-item">🔗 {hook}</div>
											{/each}
										</div>
									</div>
								{/if}
							</section>
						{/if}

						<!-- Советы по написанию -->
						{#if analyticsData.storyAdvice}
							{#if analyticsData.storyAdvice.writingTips && analyticsData.storyAdvice.writingTips.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('tips')}
									>
										<h4><i class="fas fa-lightbulb"></i> Советы по написанию</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('tips')}
										></i>
									</button>
									{#if uiState.expandedSections.has('tips')}
										<div class="section-body">
											<div class="tips-list">
												{#each analyticsData.storyAdvice.writingTips as tip}
													<div class="tip-item category-{tip.category}">
														<span class="tip-category">{tip.category}</span>
														<p class="tip-text">{tip.tip}</p>
														{#if tip.example}
															<div class="tip-example">Пример: {tip.example}</div>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}

							{#if analyticsData.storyAdvice.plotSuggestions && analyticsData.storyAdvice.plotSuggestions.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('suggestions')}
									>
										<h4><i class="fas fa-magic"></i> Идеи для сюжета</h4>
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
														{#if suggestion.insertText}
															<button
																type="button"
																class="suggestion-insert"
																onclick={() => insertAction(suggestion.insertText || '')}
															>
																<i class="fas fa-copy"></i> Скопировать
															</button>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</section>
							{/if}

							{#if analyticsData.storyAdvice.atmosphereEnhancement && analyticsData.storyAdvice.atmosphereEnhancement.length > 0}
								<section class="analytics-section">
									<button
										type="button"
										class="section-header"
										onclick={() => toggleSection('atmosphere')}
									>
										<h4><i class="fas fa-cloud-moon"></i> Улучшение атмосферы</h4>
										<i
											class="fas fa-chevron-down section-toggle"
											class:rotated={!uiState.expandedSections.has('atmosphere')}
										></i>
									</button>
									{#if uiState.expandedSections.has('atmosphere')}
										<div class="section-body">
											<ul class="atmosphere-tips">
												{#each analyticsData.storyAdvice.atmosphereEnhancement as tip}
													<li>{tip}</li>
												{/each}
											</ul>
										</div>
									{/if}
								</section>
							{/if}
						{/if}
					{/if}
				</div>
			</div>
		{:else}
			<!-- Пустое состояние -->
			<div class="analytics-empty">
				<i class="fas fa-chart-line"></i>
				<h4>Аналитика истории</h4>
				<p>
					Получите детальный анализ вашей ролевой истории: персонажи, локации, отношения, квесты,
					сюжетные арки и рекомендации по развитию сюжета.
				</p>
				<button type="button" class="btn-primary" onclick={handleRunAnalysis} disabled={analyzing}>
					<i class="fas fa-play"></i> Запустить анализ
				</button>
			</div>
		{/if}
	</div>

	<!-- Футер -->
	{#if analyticsData}
		<div class="modal-footer">
			<div class="footer-info">
				Обновлено: {formatLastUpdateTime(lastAnalysisTime)}
			</div>
			<div class="footer-actions">
				<button type="button" class="btn-secondary" onclick={handleRefresh} disabled={analyzing}>
					<i class="fas fa-sync-alt"></i> Обновить
				</button>
				<button type="button" class="btn-secondary" onclick={exportJSON}>
					<i class="fas fa-download"></i> JSON
				</button>
				<button type="button" class="btn-secondary" onclick={copySummary}>
					<i class="fas fa-copy"></i> Сводка
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ===== ОСНОВНЫЕ СТИЛИ МОДАЛЬНОГО ОКНА ===== */
	.analytics-modal {
		max-width: 1100px;
		width: 95%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
	}

	.modal-body {
		padding: var(--space-4);
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	/* ===== ЗАГОЛОВОК ===== */
	.analytics-header-content {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.analytics-header-icon {
		font-size: 1.75rem;
	}

	.analytics-header-text h3 {
		margin: 0;
		font-size: var(--text-lg);
		color: var(--txt-primary);
	}

	.analytics-header-subtitle {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
	}

	.analytics-header-actions {
		display: flex;
		gap: var(--space-2);
	}

	.analytics-header-btn {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		color: var(--txt-secondary);
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.analytics-header-btn:hover:not(:disabled) {
		background: var(--accent-primary);
		color: var(--txt-on-accent);
		border-color: var(--accent-primary);
	}

	.analytics-header-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ===== ЗАГРУЗКА ===== */
	.analytics-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-12);
		gap: var(--space-4);
	}

	.analytics-loading-rings {
		position: relative;
		width: 80px;
		height: 80px;
	}

	.analytics-loading-ring {
		position: absolute;
		border: 3px solid transparent;
		border-radius: 50%;
	}

	.analytics-loading-ring:nth-child(1) {
		width: 80px;
		height: 80px;
		border-top-color: var(--accent-primary);
		animation: ringRotate 1.5s linear infinite;
	}

	.analytics-loading-ring:nth-child(2) {
		width: 60px;
		height: 60px;
		top: 10px;
		left: 10px;
		border-right-color: var(--accent-secondary);
		animation: ringRotate 1.2s linear infinite reverse;
	}

	.analytics-loading-ring:nth-child(3) {
		width: 40px;
		height: 40px;
		top: 20px;
		left: 20px;
		border-bottom-color: var(--p-gold-300);
		animation: ringRotate 0.9s linear infinite;
	}

	@keyframes ringRotate {
		100% {
			transform: rotate(360deg);
		}
	}

	.analytics-loading-text {
		font-size: var(--text-base);
		color: var(--txt-primary);
		font-weight: 600;
	}

	.analytics-loading-stage {
		font-size: var(--text-sm);
		color: var(--txt-muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	.analytics-loading-progress {
		width: 200px;
		height: 4px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.analytics-loading-progress-bar {
		height: 100%;
		background: var(--grad-burgundy);
		border-radius: var(--radius-full);
		animation: loadingProgress 2s ease-in-out infinite;
	}

	@keyframes loadingProgress {
		0% {
			width: 0%;
			margin-left: 0%;
		}
		50% {
			width: 50%;
			margin-left: 25%;
		}
		100% {
			width: 0%;
			margin-left: 100%;
		}
	}

	/* ===== ПУСТОЕ СОСТОЯНИЕ ===== */
	.analytics-empty,
	.analytics-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-12);
		gap: var(--space-4);
		text-align: center;
		color: var(--txt-muted);
	}

	.analytics-empty i,
	.analytics-placeholder i {
		font-size: 3rem;
		color: var(--txt-gold);
	}

	.analytics-empty h4 {
		color: var(--txt-primary);
		margin: 0;
	}

	.analytics-empty p {
		max-width: 400px;
		line-height: 1.6;
	}

	/* ===== СВОДНАЯ ПАНЕЛЬ ===== */
	.analytics-summary-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}

	.summary-item {
		flex: 1;
		min-width: 120px;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		transition: all 0.2s ease;
	}

	.summary-item:hover {
		background: var(--bg-surface-4);
		transform: translateY(-2px);
	}

	.summary-icon {
		font-size: 1.25rem;
	}

	.summary-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.summary-label {
		font-size: var(--text-xs);
		color: var(--txt-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.summary-value {
		font-size: var(--text-sm);
		color: var(--txt-primary);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tension-item {
		flex: 2;
		min-width: 180px;
	}

	.tension-bar {
		height: 8px;
		background: var(--bg-surface-2);
		border-radius: var(--radius-full);
		overflow: hidden;
		flex: 1;
		margin-top: var(--space-1);
	}

	.tension-fill {
		height: 100%;
		border-radius: var(--radius-full);
		background: linear-gradient(90deg, var(--state-success) 0%, var(--state-warning) 50%, var(--state-error) 100%);
		transition: width 0.3s ease;
	}

	.danger-low {
		color: var(--state-success);
	}
	.danger-medium {
		color: var(--state-warning);
	}
	.danger-high {
		color: var(--state-error);
	}

	/* ===== ВКЛАДКИ ===== */
	.analytics-tabs {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
		overflow-x: auto;
	}

	.analytics-tab {
		flex: 1;
		min-width: max-content;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--txt-secondary);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	.analytics-tab:hover {
		background: var(--bg-surface-3);
		color: var(--txt-primary);
	}

	.analytics-tab.active {
		background: var(--accent-primary);
		color: var(--txt-on-accent);
	}

	/* ===== СЕКЦИИ ===== */
	.analytics-section {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		background: var(--bg-surface-2);
		border: none;
		cursor: pointer;
		transition: background 0.2s ease;
		text-align: left;
	}

	.section-header:hover {
		background: var(--bg-surface-3);
	}

	.section-header h4 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--txt-primary);
		margin: 0;
	}

	.section-header h4 i {
		color: var(--txt-gold);
	}

	.section-toggle {
		color: var(--txt-muted);
		transition: transform 0.2s ease;
	}

	.section-toggle.rotated {
		transform: rotate(-90deg);
	}

	.section-body {
		padding: var(--space-4);
	}

	.count-badge,
	.warning-count {
		background: var(--state-warning);
		color: var(--txt-inverse);
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: var(--text-xs);
		font-weight: 600;
		margin-left: auto;
		margin-right: var(--space-2);
	}

	/* ===== ТЕКСТ СВОДКИ ===== */
	.summary-text {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		border-left: 4px solid var(--accent-primary);
	}

	.summary-text p {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		line-height: 1.7;
		margin: 0 0 var(--space-3) 0;
	}

	.summary-text p:last-child {
		margin-bottom: 0;
	}

	/* ===== СТАТИСТИКА ===== */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.stat-icon {
		font-size: 1.5rem;
		margin-bottom: var(--space-1);
	}

	.stat-card .stat-value {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--txt-primary);
	}

	.stat-card .stat-label {
		font-size: var(--text-xs);
		color: var(--txt-muted);
	}

	.content-distribution h5 {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin: 0 0 var(--space-2) 0;
	}

	.distribution-bar {
		display: flex;
		height: 24px;
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.distribution-segment {
		transition: width 0.3s ease;
	}

	.distribution-segment.action {
		background: var(--state-error);
	}
	.distribution-segment.dialogue {
		background: var(--accent-primary);
	}
	.distribution-segment.description {
		background: var(--state-success);
	}

	.distribution-legend {
		display: flex;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		color: var(--txt-muted);
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-xs);
	}

	.legend-dot.action {
		background: var(--state-error);
	}
	.legend-dot.dialogue {
		background: var(--accent-primary);
	}
	.legend-dot.description {
		background: var(--state-success);
	}

	/* ===== ПРЕДУПРЕЖДЕНИЯ ===== */
	.warnings-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.warning-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		border-left: 4px solid;
	}

	.warning-item.severity-low {
		background: var(--state-info-bg);
		border-color: var(--state-info);
	}

	.warning-item.severity-medium {
		background: var(--state-warning-bg);
		border-color: var(--state-warning);
	}

	.warning-item.severity-high {
		background: var(--state-error-bg);
		border-color: var(--state-error);
	}

	.warning-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.warning-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.warning-text {
		font-size: var(--text-sm);
		color: var(--txt-primary);
	}

	.warning-suggestion {
		font-size: var(--text-xs);
		color: var(--txt-secondary);
	}

	/* ===== ПЕРСОНАЖИ ===== */
	.characters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.character-card {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.character-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-md);
		border-color: var(--glass-border-hover);
	}

	.character-card.critical {
		border-color: var(--state-error);
		box-shadow: 0 0 0 1px var(--state-error);
	}

	.character-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-bottom: 1px solid var(--glass-border);
	}

	.character-avatar {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full);
		object-fit: cover;
		border: 3px solid var(--accent-primary);
		flex-shrink: 0;
	}

	.character-avatar.happy {
		border-color: var(--state-success);
	}
	.character-avatar.sad {
		border-color: var(--state-info);
	}
	.character-avatar.angry {
		border-color: var(--state-error);
	}
	.character-avatar.fear {
		border-color: #9b59b6;
	}

	.character-avatar-placeholder {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-3);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--txt-muted);
		font-size: 1.5rem;
		border: 3px solid var(--accent-primary);
		flex-shrink: 0;
	}

	.character-info {
		flex: 1;
		min-width: 0;
	}

	.character-name {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--txt-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.character-role {
		display: inline-block;
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		margin-top: var(--space-1);
	}

		.character-role.role-protagonist {
		background: var(--state-success-bg);
		color: var(--state-success);
	}

	.character-role.role-antagonist {
		background: var(--state-error-bg);
		color: var(--state-error);
	}

	.character-role.role-ally {
		background: var(--state-info-bg);
		color: var(--state-info);
	}

	.character-role.role-neutral {
		background: var(--bg-surface-3);
		color: var(--txt-muted);
	}

	.character-mood {
		display: block;
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin-top: var(--space-1);
	}

	.character-body {
		padding: var(--space-3);
	}

	/* Статы персонажа */
	.character-stats {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.stat-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.stat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stat-bar .stat-label {
		font-size: var(--text-xs);
		color: var(--txt-secondary);
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.stat-bar .stat-value {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--txt-primary);
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.stat-trend {
		font-size: var(--text-xs);
	}

	.stat-trend.trend-up {
		color: var(--state-success);
	}
	.stat-trend.trend-down {
		color: var(--state-error);
	}
	.stat-trend.trend-stable {
		color: var(--txt-muted);
	}

	.stat-track {
		height: 6px;
		background: var(--bg-surface-2);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.stat-fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.stat-health .stat-fill {
		background: var(--state-error);
	}
	.stat-energy .stat-fill {
		background: #f1c40f;
	}
	.stat-hunger .stat-fill {
		background: #e67e22;
	}
	.stat-sanity .stat-fill {
		background: #9b59b6;
	}
	.stat-mana .stat-fill {
		background: var(--accent-primary);
	}

	/* Статусные эффекты */
	.status-effects {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--glass-border);
	}

	.status-tag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px 8px;
		font-size: var(--text-xs);
		border-radius: var(--radius-sm);
		font-weight: 500;
	}

	.status-tag.positive {
		background: var(--state-success-bg);
		color: var(--state-success);
	}

	.status-tag.negative {
		background: var(--state-error-bg);
		color: var(--state-error);
	}

	/* Цель персонажа */
	.character-goal {
		padding: var(--space-2);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-2);
	}

	.goal-label {
		display: block;
		font-size: var(--text-xs);
		color: var(--txt-muted);
		margin-bottom: var(--space-1);
	}

	.goal-text {
		font-size: var(--text-sm);
		color: var(--txt-primary);
	}

	/* Арка персонажа */
	.character-arc {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-2);
	}

	.arc-label {
		font-size: var(--text-xs);
		color: var(--txt-secondary);
	}

	.arc-stage {
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-3);
		color: var(--txt-muted);
	}

	.arc-stage.stage-начало {
		background: var(--state-info-bg);
		color: var(--state-info);
	}
	.arc-stage.stage-развитие {
		background: var(--state-success-bg);
		color: var(--state-success);
	}
	.arc-stage.stage-кризис {
		background: var(--state-warning-bg);
		color: var(--state-warning);
	}
	.arc-stage.stage-трансформация {
		background: rgba(155, 89, 182, 0.15);
		color: #9b59b6;
	}
	.arc-stage.stage-завершение {
		background: var(--state-success-bg);
		color: var(--state-success);
	}

	/* Спойлер */
	.spoiler-toggle {
		width: 100%;
		padding: var(--space-2);
		background: rgba(155, 89, 182, 0.1);
		border: 1px dashed rgba(155, 89, 182, 0.3);
		border-radius: var(--radius-sm);
		color: #9b59b6;
		font-size: var(--text-xs);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.spoiler-toggle:hover {
		background: rgba(155, 89, 182, 0.15);
		border-color: #9b59b6;
	}

	.spoiler-toggle.revealed {
		border-style: solid;
	}

	.spoiler-content {
		margin-top: var(--space-2);
		padding: var(--space-2);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		font-style: italic;
	}

	/* ===== ОТНОШЕНИЯ ===== */
	.relationships-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.relationship-item {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		border: 1px solid var(--glass-border);
		transition: all 0.2s ease;
	}

	.relationship-item:hover {
		border-color: var(--glass-border-hover);
	}

	.relationship-item.tension {
		border-color: var(--state-warning);
		animation: tensionPulse 2.5s ease-in-out infinite;
	}

	@keyframes tensionPulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.3);
		}
		50% {
			box-shadow: 0 0 0 4px rgba(243, 156, 18, 0.1);
		}
	}

	.relationship-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-2);
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.relationship-names {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		color: var(--txt-primary);
	}

	.relationship-arrow {
		font-size: 1.2rem;
		color: var(--txt-muted);
	}

	.relationship-type {
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-3);
		color: var(--txt-secondary);
	}

	.relationship-bar {
		margin: var(--space-2) 0;
	}

	.relationship-track {
		height: 10px;
		background: linear-gradient(
			90deg,
			var(--state-error) 0%,
			var(--txt-muted) 50%,
			#e84393 100%
		);
		border-radius: var(--radius-sm);
		position: relative;
	}

	.relationship-indicator {
		position: absolute;
		top: -4px;
		width: 18px;
		height: 18px;
		background: var(--txt-primary);
		border-radius: var(--radius-full);
		border: 3px solid var(--accent-primary);
		transform: translateX(-50%);
		transition: left 0.3s ease;
		box-shadow: var(--shadow-sm);
	}

	.relationship-status {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		font-style: italic;
	}

	.relationship-change {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		margin-top: var(--space-1);
		font-weight: 500;
	}

	.relationship-change.change-up {
		color: var(--state-success);
	}
	.relationship-change.change-down {
		color: var(--state-error);
	}
	.relationship-change.change-stable {
		color: var(--txt-muted);
	}

	/* ===== ЛОКАЦИЯ ===== */
	.location-card {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.location-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--bg-surface-3);
		border-bottom: 1px solid var(--glass-border);
	}

	.meta-tag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		color: var(--txt-secondary);
	}

	.location-description {
		padding: var(--space-3);
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		line-height: 1.7;
		font-style: italic;
		border-bottom: 1px solid var(--glass-border);
		margin: 0;
	}

	/* Атмосфера */
	.atmosphere-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--space-3);
		padding: var(--space-3);
		border-bottom: 1px solid var(--glass-border);
	}

	.atmosphere-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.atm-header {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-xs);
	}

	.atm-label {
		color: var(--txt-secondary);
	}
	.atm-value {
		color: var(--txt-primary);
		font-weight: 600;
	}

	.atm-bar {
		height: 6px;
		background: var(--bg-surface-1);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.atm-fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.atm-danger .atm-fill {
		background: linear-gradient(90deg, var(--state-success), var(--state-warning) 50%, var(--state-error));
	}
	.atm-comfort .atm-fill {
		background: var(--state-success);
	}
	.atm-mystery .atm-fill {
		background: #9b59b6;
	}
	.atm-visibility .atm-fill {
		background: var(--accent-primary);
	}
	.atm-magic .atm-fill {
		background: #9b59b6;
	}
	.atm-hostility .atm-fill {
		background: var(--state-error);
	}

	/* Точки интереса */
	.poi-section,
	.exits-section {
		padding: var(--space-3);
		border-bottom: 1px solid var(--glass-border);
	}

	.poi-section:last-child,
	.exits-section:last-child {
		border-bottom: none;
	}

	.poi-section h5,
	.exits-section h5 {
		font-size: var(--text-sm);
		color: var(--txt-muted);
		margin: 0 0 var(--space-3) 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.poi-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.poi-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-1);
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
		flex-wrap: wrap;
	}

	.poi-item:hover {
		background: var(--bg-surface-3);
	}

	.poi-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.poi-content {
		flex: 1;
		min-width: 150px;
	}

	.poi-name {
		display: block;
		font-weight: 600;
		color: var(--txt-primary);
		font-size: var(--text-sm);
	}

	.poi-hint {
		display: block;
		font-size: var(--text-xs);
		color: var(--txt-muted);
		font-style: italic;
		margin-top: var(--space-1);
	}

	.poi-status {
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.poi-status.status-unexplored {
		background: rgba(155, 89, 182, 0.15);
		color: #9b59b6;
	}
	.poi-status.status-explored {
		background: var(--state-success-bg);
		color: var(--state-success);
	}
	.poi-status.status-blocked {
		background: var(--state-error-bg);
		color: var(--state-error);
	}
	.poi-status.status-dangerous {
		background: var(--state-warning-bg);
		color: var(--state-warning);
	}

	/* Выходы */
	.exits-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.exit-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-1);
		border-radius: var(--radius-sm);
	}

	.exit-direction {
		font-weight: 600;
		color: var(--txt-primary);
		min-width: 80px;
	}

	.exit-destination {
		flex: 1;
		color: var(--txt-secondary);
		font-size: var(--text-sm);
	}

	.exit-danger {
		font-size: var(--text-xs);
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* ===== ИНВЕНТАРЬ ===== */
	.resources-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}

	.resource-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
	}

	.resource-icon {
		font-size: 1.2rem;
	}

	.resource-value {
		font-weight: 700;
		color: var(--txt-primary);
	}

	.resource-label {
		font-size: var(--text-xs);
		color: var(--txt-muted);
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: var(--space-2);
	}

	.inventory-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		cursor: default;
		transition: all 0.2s ease;
		position: relative;
		text-align: center;
	}

	.inventory-item:hover {
		border-color: var(--glass-border-hover);
		transform: translateY(-2px);
	}

	.inventory-item.quest-item {
		border-color: var(--state-warning);
		background: rgba(243, 156, 18, 0.05);
	}

	.inventory-item.rarity-uncommon {
		border-color: var(--state-success);
	}
	.inventory-item.rarity-rare {
		border-color: var(--accent-primary);
	}
	.inventory-item.rarity-epic {
		border-color: #9b59b6;
	}
	.inventory-item.rarity-legendary {
		border-color: var(--txt-gold);
		box-shadow: 0 0 10px rgba(196, 163, 90, 0.3);
	}

	.item-icon {
		font-size: 1.75rem;
		margin-bottom: var(--space-1);
	}

	.item-name {
		font-size: var(--text-xs);
		color: var(--txt-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.item-quantity {
		position: absolute;
		top: 4px;
		right: 4px;
		font-size: var(--text-xs);
		background: var(--accent-primary);
		color: var(--txt-on-accent);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.item-owner {
		font-size: 0.65rem;
		color: var(--txt-muted);
		margin-top: var(--space-1);
	}

	.empty-text {
		color: var(--txt-muted);
		font-size: var(--text-sm);
		text-align: center;
		padding: var(--space-4);
	}

	/* ===== АРКА СЮЖЕТА ===== */
	.arc-card {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		border-left: 4px solid var(--accent-primary);
	}

	.arc-card h5 {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-base);
		color: var(--txt-primary);
	}

	.arc-card p {
		margin: 0 0 var(--space-3) 0;
		font-size: var(--text-sm);
		color: var(--txt-secondary);
	}

	.arc-progress {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.arc-progress .progress-label {
		font-size: var(--text-xs);
		color: var(--txt-muted);
		white-space: nowrap;
	}

	.progress-bar {
		flex: 1;
		height: 8px;
		background: var(--bg-surface-1);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--grad-burgundy);
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.progress-value {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--txt-primary);
		min-width: 40px;
		text-align: right;
	}

	/* ===== ТЕМП И ТОН ===== */
	.pacing-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.info-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.info-label {
		font-size: var(--text-sm);
		color: var(--txt-muted);
	}

	.info-value {
		font-size: var(--text-sm);
		color: var(--txt-primary);
		font-weight: 600;
	}

	.recommendation {
		padding: var(--space-3);
		background: var(--state-info-bg);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin-top: var(--space-2);
	}

	/* ===== ТЕМЫ ===== */
	.themes-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.theme-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
	}

	.theme-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.theme-icon {
		font-size: 1.25rem;
	}

	.theme-name {
		flex: 1;
		font-weight: 600;
		color: var(--txt-primary);
	}

	.theme-prominence {
		font-size: var(--text-sm);
		color: var(--txt-gold);
		font-weight: 600;
	}

	.theme-bar {
		height: 6px;
		background: var(--bg-surface-1);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-bottom: var(--space-2);
	}

	.theme-fill {
		height: 100%;
		background: var(--grad-burgundy);
		border-radius: var(--radius-full);
	}

	.theme-examples {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.example-tag {
		font-size: var(--text-xs);
		padding: 2px 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		color: var(--txt-muted);
	}

	/* ===== НЕРЕШЁННЫЕ ВОПРОСЫ ===== */
	.unresolved-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.unresolved-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border-left: 4px solid;
	}

	.unresolved-item.importance-low {
		border-color: var(--state-info);
	}
	.unresolved-item.importance-medium {
		border-color: var(--state-warning);
	}
	.unresolved-item.importance-high {
		border-color: var(--state-error);
	}

	.unresolved-type {
		display: inline-block;
		font-size: var(--text-xs);
		padding: 2px 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		color: var(--txt-muted);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
	}

	.unresolved-desc {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-sm);
		color: var(--txt-primary);
	}

	.unresolved-suggestion {
		font-size: var(--text-xs);
		color: var(--txt-secondary);
		padding: var(--space-2);
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
	}

	/* ===== КВЕСТЫ ===== */
	.main-quest {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		border-left: 4px solid var(--txt-gold);
		margin-bottom: var(--space-4);
	}

	.quest-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.quest-icon {
		font-size: 1.5rem;
	}

	.quest-title {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--txt-primary);
	}

	.quest-description {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin: 0 0 var(--space-3) 0;
	}

	.quest-objective {
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--txt-gold);
		margin-bottom: var(--space-3);
	}

	.quest-progress {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.quest-stages {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.stage-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--glass-border);
	}

	.stage-item:last-child {
		border-bottom: none;
	}

	.stage-icon {
		width: 20px;
		text-align: center;
	}

	.stage-item.stage-completed .stage-name {
		color: var(--txt-muted);
		text-decoration: line-through;
	}

	.stage-item.stage-current .stage-name {
		color: var(--txt-primary);
		font-weight: 600;
	}

	.stage-item.stage-pending .stage-name {
		color: var(--txt-secondary);
	}

	/* Побочные квесты */
	.side-quests {
		margin-bottom: var(--space-4);
	}

	.side-quests h5 {
		font-size: var(--text-sm);
		color: var(--txt-muted);
		margin: 0 0 var(--space-3) 0;
	}

	.side-quest-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-2);
	}

	.side-quest-item.status-completed {
		opacity: 0.7;
	}

	.side-quest-item.status-failed {
		opacity: 0.7;
		background: var(--state-error-bg);
	}

	.quest-status-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.quest-info {
		flex: 1;
		min-width: 0;
	}

	.quest-name {
		display: block;
		font-weight: 600;
		color: var(--txt-primary);
		font-size: var(--text-sm);
	}

	.side-quest-item.status-completed .quest-name,
	.side-quest-item.status-failed .quest-name {
		text-decoration: line-through;
	}

	.quest-desc {
		display: block;
		font-size: var(--text-xs);
		color: var(--txt-muted);
	}

	.quest-progress-mini {
		width: 80px;
		flex-shrink: 0;
		text-align: right;
	}

	.progress-bar-mini {
		height: 4px;
		background: var(--bg-surface-1);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-bottom: var(--space-1);
	}

	.quest-progress-mini span {
		font-size: var(--text-xs);
		color: var(--txt-muted);
	}

	/* Подсказки квестов */
	.quest-hints {
		padding: var(--space-3);
		background: rgba(241, 196, 15, 0.1);
		border: 1px dashed rgba(241, 196, 15, 0.3);
		border-radius: var(--radius-md);
	}

	.quest-hints h5 {
		font-size: var(--text-sm);
		color: var(--state-warning);
		margin: 0 0 var(--space-2) 0;
	}

	.quest-hints ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.quest-hints li {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		padding: var(--space-1) 0;
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.quest-hints li::before {
		content: '💡';
	}

	/* ===== ДЕЙСТВИЯ ===== */
	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-3);
	}

	.action-card {
		background: var(--bg-surface-2);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.action-card:hover {
		border-color: var(--accent-primary);
		transform: translateX(4px);
		background: var(--bg-surface-3);
	}

	.action-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.action-category {
		font-size: var(--text-xs);
		padding: 2px 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		color: var(--txt-muted);
		text-transform: uppercase;
	}

	.action-risk {
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.action-risk.risk-low {
		color: var(--state-success);
	}
	.action-risk.risk-medium {
		color: var(--state-warning);
	}
	.action-risk.risk-high {
		color: var(--state-error);
	}

	.action-text {
		font-size: var(--text-sm);
		color: var(--txt-primary);
		font-weight: 600;
		margin: 0 0 var(--space-2) 0;
	}

	.action-reward {
		font-size: var(--text-xs);
		color: var(--txt-muted);
		margin-bottom: var(--space-2);
	}

	.action-chance {
		font-size: var(--text-xs);
		color: var(--txt-secondary);
		margin-bottom: var(--space-2);
	}

	.action-insert {
		font-size: var(--text-xs);
		color: var(--accent-primary);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.action-card:hover .action-insert {
		opacity: 1;
	}

	/* ===== МОМЕНТЫ ПЕРСОНАЖЕЙ ===== */
	.moments-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.moment-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--accent-primary);
	}

	.moment-item.type-развитие {
		border-color: var(--state-success);
	}
	.moment-item.type-конфликт {
		border-color: var(--state-error);
	}
	.moment-item.type-откровение {
		border-color: #9b59b6;
	}
	.moment-item.type-выбор {
		border-color: var(--state-warning);
	}

	.moment-character {
		display: block;
		font-weight: 600;
		color: var(--txt-primary);
		margin-bottom: var(--space-1);
	}

	.moment-type {
		display: inline-block;
		font-size: var(--text-xs);
		padding: 2px 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		color: var(--txt-muted);
		margin-bottom: var(--space-2);
	}

	.moment-opportunity {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin: 0;
	}

	/* ===== ЗАЦЕПКИ ===== */
	.hooks-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.hook-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--txt-secondary);
	}

	/* ===== СОВЕТЫ ===== */
	.tips-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.tip-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--accent-primary);
	}

	.tip-item.category-pacing {
		border-color: var(--state-info);
	}
	.tip-item.category-character {
		border-color: var(--state-success);
	}
	.tip-item.category-dialogue {
		border-color: #9b59b6;
	}
	.tip-item.category-description {
		border-color: var(--txt-gold);
	}
	.tip-item.category-conflict {
		border-color: var(--state-error);
	}

	.tip-category {
		display: inline-block;
		font-size: var(--text-xs);
		padding: 2px 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
		color: var(--txt-muted);
		text-transform: uppercase;
		margin-bottom: var(--space-2);
	}

	.tip-text {
		font-size: var(--text-sm);
		color: var(--txt-primary);
		margin: 0 0 var(--space-2) 0;
	}

	.tip-example {
		font-size: var(--text-xs);
		color: var(--txt-muted);
		font-style: italic;
		padding: var(--space-2);
		background: var(--bg-surface-3);
		border-radius: var(--radius-sm);
	}

	/* ===== ПРЕДЛОЖЕНИЯ ===== */
	.suggestions-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.suggestion-item {
		padding: var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
	}

	.suggestion-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.suggestion-title {
		font-weight: 600;
		color: var(--txt-primary);
	}

	.suggestion-impact {
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
	}

	.suggestion-item.impact-minor .suggestion-impact {
		background: var(--state-info-bg);
		color: var(--state-info);
	}
	.suggestion-item.impact-moderate .suggestion-impact {
		background: var(--state-warning-bg);
		color: var(--state-warning);
	}
	.suggestion-item.impact-major .suggestion-impact {
		background: var(--state-error-bg);
		color: var(--state-error);
	}

	.suggestion-desc {
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		margin: 0 0 var(--space-2) 0;
	}

	.suggestion-insert {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--accent-primary);
		color: var(--txt-on-accent);
		border: none;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		cursor: pointer;
		transition: all 0.2s;
	}

	.suggestion-insert:hover {
		background: var(--accent-secondary);
	}

	/* ===== АТМОСФЕРА (СОВЕТЫ) ===== */
	.atmosphere-tips {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.atmosphere-tips li {
		padding: var(--space-2) var(--space-3);
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
		color: var(--txt-secondary);
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.atmosphere-tips li::before {
		content: '🌙';
	}

	/* ===== ФУТЕР ===== */
	.modal-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--glass-border);
		background: var(--bg-surface-2);
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.footer-info {
		font-size: var(--text-sm);
		color: var(--txt-muted);
	}

	.footer-actions {
		display: flex;
		gap: var(--space-2);
	}

	.footer-actions button {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* ===== ПУСТОЕ СОСТОЯНИЕ ===== */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
		color: var(--txt-muted);
		text-align: center;
	}

	.empty-state i {
		font-size: 2rem;
		margin-bottom: var(--space-2);
	}

	/* ===== АДАПТИВНОСТЬ ===== */
	@media (max-width: 768px) {
		.analytics-modal {
			max-width: 100%;
			width: 100%;
			height: 100vh;
			max-height: 100vh;
			border-radius: 0;
		}

		.modal-body {
			padding: var(--space-3);
		}

		.analytics-tabs {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.analytics-tab {
			padding: var(--space-2);
			font-size: var(--text-xs);
		}

		.analytics-summary-bar {
			flex-direction: column;
		}

		.characters-grid {
			grid-template-columns: 1fr;
		}

		.actions-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.atmosphere-grid {
			grid-template-columns: 1fr;
		}

		.modal-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.footer-actions {
			justify-content: center;
			flex-wrap: wrap;
		}
	}
</style>