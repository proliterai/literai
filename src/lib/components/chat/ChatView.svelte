<!-- ================================================================================
ФАЙЛ: src/lib/components/chat/ChatView.svelte
Описание: Основной компонент чата с сообщениями, редактированием и ветвлением
================================================================================ -->
<script lang="ts">
import { onMount } from 'svelte';
import { chatStore } from '$lib/domain/chat/chat.store';
import { parseBotResponse } from '$lib/domain/chat/parseBotResponse';
import { ui } from '$lib/ui/ui.store';
import { safeUrl } from '$lib/utils/url';
import { settingsStore } from '$lib/domain/settings/settings.store';
import {
	sendMessage,
	reroll,
	editUserAndRegenerate,
	branchUserAndRegenerate,
	summarize
} from '$lib/domain/chat/chat.actions';
import type { ChatMessage } from '$lib/domain/chat/chat.types';

// Состояния компонента
let input = $state('');
let scroller = $state<HTMLDivElement | null>(null);
let editingId = $state<string | null>(null);
let editingMode = $state<'edit' | 'branch'>('edit');
let editingText = $state('');

// Состояния для умного скролла и плавающих кнопок
let shouldStickToBottom = $state(true);
let canScrollUp = $state(false);
let canScrollDown = $state(false);

// Получаем стиль отображения аватарок из настроек
let avatarStyle = $derived($settingsStore.values.avatar_style || 'small');

// Подписка на store
let s = $derived($chatStore);

// Получаем текущую ветку и часть
let branch = $derived(s.chatTree.branches[s.chatTree.activeBranchIndex] ?? null);
let part = $derived(s.chatParts[s.currentPartIndex] ?? null);
let selected = $derived(s.selectedItems);

// Фильтруем сообщения (убираем системные)
let visibleMessages = $derived((branch?.messages ?? []).filter((m) => m.role !== 'system'));

// Находим последнее сообщение ассистента для парсинга вариантов ответа
let lastAssistant = $derived((() => {
	for (let i = visibleMessages.length - 1; i >= 0; i--) {
		if (visibleMessages[i].role === 'assistant') return visibleMessages[i];
	}
	return null;
})());

// Парсим варианты ответов из последнего сообщения бота
let choices = $derived(lastAssistant ? parseBotResponse(
	lastAssistant.versions?.length
		? (lastAssistant.versions[lastAssistant.activeVersion ?? 0]?.content ?? lastAssistant.content)
		: lastAssistant.content
).choices : []);

// Получаем ветки для текущей части
let partBranches = $derived((() => {
	const ids = new Set(part?.branchIds ?? []);
	return s.chatTree.branches
		.map((b, idx) => ({ b, idx }))
		.filter(({ b }) => ids.has(b.id));
})());

// Универсальный обработчик скролла (срабатывает и от окна, и от контейнера)
function handleScroll() {
	const winScrollTop = window.scrollY || document.documentElement.scrollTop;
	const divScrollTop = scroller?.scrollTop || 0;

	let st, sh, ch;

	// Определяем, что именно скроллится: страница целиком или блок сообщений
	if (winScrollTop > 0 || (scroller && scroller.scrollHeight <= scroller.clientHeight)) {
		st = winScrollTop;
		sh = document.documentElement.scrollHeight;
		ch = window.innerHeight;
	} else if (scroller) {
		st = divScrollTop;
		sh = scroller.scrollHeight;
		ch = scroller.clientHeight;
	} else {
		return;
	}

	// Логика отображения кнопок
	shouldStickToBottom = (sh - st - ch) < 150; // Мы внизу, если до конца менее 150px
	canScrollUp = st > 300; // Показываем "Вверх" после прокрутки на 300px
	canScrollDown = !shouldStickToBottom; // Показываем "Вниз", если мы не в самом низу
}

function scrollToTop() {
	window.scrollTo({ top: 0, behavior: 'smooth' });
	scroller?.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToBottom() {
	window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
	scroller?.scrollTo({ top: scroller?.scrollHeight, behavior: 'smooth' });
}

// Улучшенный скролл при добавлении новых сообщений
$effect(() => {
	visibleMessages; // Триггер эффекта при изменении массива
	if (shouldStickToBottom) {
		setTimeout(() => {
			scrollToBottom();
		}, 100);
	}
});

onMount(() => {
	// Проверяем скролл при загрузке компонента
	handleScroll();
});

// Получение сырого контента сообщения
function getRawContent(m: ChatMessage): string {
	return m.versions?.length
		? m.versions[m.activeVersion ?? 0].content
		: m.content;
}

// Начало редактирования сообщения
function startEdit(
	messageId: string,
	role: string,
	raw: string,
	mode: 'edit' | 'branch'
) {
	editingId = messageId;
	editingMode = mode;
	editingText = role === 'assistant'
		? parseBotResponse(raw).storyRawText
		: raw;
}

// Сохранение редактирования
async function saveEdit(m: ChatMessage) {
	try {
		const text = editingText.trim();
		if (!text) {
			ui.notify('Введите текст сообщения', 'warning');
			return;
		}

		const { id, role } = m;
		const mode = editingMode;

		// Сбрасываем режим редактирования
		editingId = null;
		editingText = '';

		if (role === 'user') {
			if (mode === 'edit') {
				await editUserAndRegenerate(id, text);
			} else {
				await branchUserAndRegenerate(id, text);
			}
			shouldStickToBottom = true;
			scrollToBottom();
			return;
		}

		// Редактирование сообщения ассистента
		if (mode === 'edit') {
			chatStore.updateMessage(id, text);
			ui.notify('Сообщение обновлено', 'success');
		} else {
			chatStore.createBranchFromEdit(id, text);
			ui.notify('Создана новая ветвь', 'success');
		}
	} catch (error: any) {
		console.error('[ChatView] saveEdit error:', error);
		ui.notify(error.message || 'Ошибка сохранения сообщения', 'error');
		editingId = m.id;
	}
}

// Отмена редактирования
function cancelEdit() {
	editingId = null;
	editingText = '';
}

// Отправка сообщения
function onSend() {
	const t = input.trim();
	if (!t) {
		ui.notify('Введите сообщение', 'warning');
		return;
	}
	input = '';
	sendMessage(t);
	shouldStickToBottom = true;
	scrollToBottom();
}

function handleChoiceClick(choiceText: string) {
	sendMessage(choiceText);
	shouldStickToBottom = true;
	scrollToBottom();
}

function handleReroll(messageId: string) {
	reroll(messageId);
	shouldStickToBottom = true;
}

// Обработка клавиш в поле ввода
function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		onSend();
	}
}

// Переключение версии сообщения
function switchVersion(messageId: string, dir: -1 | 1) {
	try {
		chatStore.switchVersion(messageId, dir);
	} catch (error: any) {
		console.error('[ChatView] switchVersion error:', error);
		ui.notify('Ошибка переключения версии', 'error');
	}
}

// Удаление сообщения
async function deleteMessage(messageId: string) {
	if (await ui.confirm('Удалить сообщение?', 'Вы уверены, что хотите удалить это сообщение?')) {
		try {
			chatStore.deleteMessageWithPairRule(messageId);
			ui.notify('Сообщение удалено', 'success');
		} catch (error: any) {
			console.error('[ChatView] deleteMessage error:', error);
			ui.notify('Ошибка удаления сообщения', 'error');
		}
	}
}

// Переключение ветки
function switchBranch(idx: number) {
	try {
		chatStore.switchBranch(idx);
	} catch (error: any) {
		console.error('[ChatView] switchBranch error:', error);
		ui.notify('Ошибка переключения ветки', 'error');
	}
}

// Удаление ветки
async function deleteBranch(idx: number) {
	const branchName = s.chatTree.branches[idx]?.name ?? 'Ветвь';
	if (await ui.confirm('Удалить ветку?', `Удалить ветвь "${branchName}"?`)) {
		try {
			chatStore.deleteBranch(idx);
			ui.notify('Ветвь удалена', 'success');
		} catch (error: any) {
			console.error('[ChatView] deleteBranch error:', error);
			ui.notify('Ошибка удаления ветви', 'error');
		}
	}
}

// Переключение части
function switchPart(idx: number) {
	try {
		chatStore.switchPart(idx);
	} catch (error: any) {
		console.error('[ChatView] switchPart error:', error);
		ui.notify('Ошибка переключения части', 'error');
	}
}

// Удаление части
async function deletePart(idx: number) {
	const partName = s.chatParts[idx]?.name ?? 'Часть';
	if (await ui.confirm('Удалить часть?', `Удалить часть "${partName}"? Все ветки этой части будут удалены.`)) {
		try {
			chatStore.deletePart(idx);
			ui.notify('Часть удалена', 'success');
		} catch (error: any) {
			console.error('[ChatView] deletePart error:', error);
			ui.notify('Ошибка удаления части', 'error');
		}
	}
}

// Обновление саммаризации предыдущей части
function updatePreviousPartSummary(value: string) {
	try {
		chatStore.updatePreviousPartSummary(value);
	} catch (error: any) {
		console.error('[ChatView] updatePreviousPartSummary error:', error);
	}
}
</script>

<!-- Глобальный слушатель скролла страницы -->
<svelte:window onscroll={handleScroll} />

<div class="chat-container">
	<!-- Header -->
	<div class="chat-header">
		<div class="chat-title">
			<i class="fas fa-comments"></i>
			<span>{s.title}</span>
		</div>
	</div>

	<!-- Editor для саммаризации предыдущей части -->
	{#if s.currentPartIndex > 0}
		{@const prevPart = s.chatParts[s.currentPartIndex - 1]}
		{#if prevPart?.summary}
			<div class="summary-editor-wrapper">
				<div class="summary-editor-header">
					<i class="fas fa-book"></i>
					Краткий пересказ: {prevPart.name}
				</div>
				<textarea
					class="summary-textarea"
					value={prevPart.summary}
					oninput={(e) => updatePreviousPartSummary(e.currentTarget.value)}
					rows="3"
					placeholder="Редактируйте краткий пересказ..."
				></textarea>
			</div>
		{/if}
	{/if}

	<!-- Область сообщений -->
	<div
		class="chat-messages"
		id="chat-messages"
		bind:this={scroller}
		onscroll={handleScroll}
	>
		{#each visibleMessages as m (m.id)}
			{@const isUser = m.role === 'user'}
			{@const raw = getRawContent(m)}
			{@const avatarUrl = safeUrl(isUser ? selected?.userCharacter?.avatar : selected?.systemCharacter?.avatar)}
			{@const characterName = isUser ? (selected?.userCharacter?.name ?? 'Персонаж') : (selected?.systemCharacter?.name ?? 'Персонаж')}

			<div
				class="message {isUser ? 'user-message' : 'bot-message'}"
				data-message-id={m.id}
			>
				<!-- Header сообщения -->
				{#if avatarStyle === 'full' && avatarUrl}
					<!-- Режим НА ВСЮ ШИРИНУ -->
					<div class="msg-hero">
						<img class="msg-hero-img" src={avatarUrl} alt={characterName} />
						<div class="msg-hero-gradient"></div>
						<button class="hero-zoom-btn" onclick={() => ui.openLightbox(avatarUrl)} title="Открыть полное фото">
							<i class="fas fa-search-plus"></i>
						</button>
						<div class="msg-hero-header">
							<span class="message-name">{characterName}</span>
							{#if !isUser}
								<div class="message-header-controls">
									<!-- Кнопки версий и реролла -->
									{#if (m.versions?.length ?? 0) > 1}
										<div class="version-nav">
											<button class="v-btn" disabled={(m.activeVersion ?? 0) === 0} onclick={() => switchVersion(m.id, -1)} title="Предыдущая версия">◀</button>
											<span>{(m.activeVersion ?? 0) + 1}/{m.versions!.length}</span>
											<button class="v-btn" disabled={(m.activeVersion ?? 0) === m.versions!.length - 1} onclick={() => switchVersion(m.id, 1)} title="Следующая версия">▶</button>
										</div>
									{/if}
									<button class="reroll-btn" title="Перегенерировать" disabled={s.isGenerating || s.isRerolling || s.isSummarizing} onclick={() => handleReroll(m.id)}>
										<i class="fas fa-sync-alt"></i>
									</button>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Режим МАЛЕНЬКАЯ или КРУПНАЯ -->
					<div class="message-header avatar-style-{avatarStyle}">
						{#if avatarUrl}
							<div class="avatar-container">
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<img
									class="message-avatar"
									src={avatarUrl}
									alt={characterName}
									style:cursor={avatarStyle === 'small' ? 'zoom-in' : 'default'}
									onclick={() => avatarStyle === 'small' ? ui.openLightbox(avatarUrl) : null}
									onerror={(e) => (e.currentTarget.style.display = 'none')}
								/>
								{#if avatarStyle === 'large'}
									<button class="large-zoom-btn" onclick={() => ui.openLightbox(avatarUrl)} title="Открыть полное фото">
										<i class="fas fa-search-plus"></i>
									</button>
								{/if}
							</div>
						{:else}
							<div class="message-avatar-placeholder">
								<i class="fas {isUser ? 'fa-user' : 'fa-robot'}"></i>
							</div>
						{/if}
						
						<span class="message-name">{characterName}</span>

						{#if !isUser}
							<div class="message-header-controls">
								{#if (m.versions?.length ?? 0) > 1}
									<div class="version-nav">
										<button class="v-btn" disabled={(m.activeVersion ?? 0) === 0} onclick={() => switchVersion(m.id, -1)} title="Предыдущая версия">◀</button>
										<span>{(m.activeVersion ?? 0) + 1}/{m.versions!.length}</span>
										<button class="v-btn" disabled={(m.activeVersion ?? 0) === m.versions!.length - 1} onclick={() => switchVersion(m.id, 1)} title="Следующая версия">▶</button>
									</div>
								{/if}
								<button class="reroll-btn" title="Перегенерировать" disabled={s.isGenerating || s.isRerolling || s.isSummarizing} onclick={() => handleReroll(m.id)}>
									<i class="fas fa-sync-alt"></i>
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Режим редактирования -->
				{#if editingId === m.id}
					<div class="edit-mode-container">
						<div class="edit-mode-header">
							{#if editingMode === 'branch'}
								<i class="fas fa-code-branch"></i>
								Новая ветвь
							{:else}
								<i class="fas fa-pen"></i>
								Редактирование
							{/if}
						</div>
						<textarea
							class="edit-textarea"
							bind:value={editingText}
							rows="5"
							placeholder="Введите текст сообщения..."
						></textarea>
						<div class="edit-mode-actions">
							<button class="btn-cancel" onclick={cancelEdit}>
								<i class="fas fa-times"></i>
								<span class="msg-action-label">Отмена</span>
							</button>
							<button class="btn-save" onclick={() => saveEdit(m)}>
								<i class="fas fa-{editingMode === 'branch' ? 'code-branch' : 'check'}"></i>
								<span class="msg-action-label">
									{editingMode === 'branch' ? 'Ветвить' : 'Сохранить'}
								</span>
							</button>
						</div>
					</div>
				{:else}
					<!-- Контент сообщения -->
					<div
						class="message-content {!isUser ? 'bot-message-content' : ''} {m.isError ? 'error' : ''}"
					>
						{#if isUser}
							{m.content}
						{:else}
							{@html parseBotResponse(raw).storyPartHtml}
						{/if}
					</div>

					<!-- Кнопки действий -->
					<div class="message-actions">
						<button
							class="branch-btn"
							title="Ветвление"
							onclick={() => startEdit(m.id, m.role, raw, 'branch')}
						>
							<i class="fas fa-code-branch"></i>
							<span class="msg-action-label">Ветвление</span>
						</button>
						<button
							class="edit-btn"
							title="Редактировать"
							onclick={() => startEdit(m.id, m.role, raw, 'edit')}
						>
							<i class="fas fa-pen"></i>
							<span class="msg-action-label">Редактировать</span>
						</button>
						<button
							class="delete-msg-btn"
							title="Удалить"
							onclick={() => deleteMessage(m.id)}
						>
							<i class="fas fa-trash"></i>
							<span class="msg-action-label">Удалить</span>
						</button>
					</div>
				{/if}
			</div>
		{/each}

		<!-- Индикатор печати -->
		{#if s.isGenerating || s.isSummarizing || s.isRerolling}
			<div class="typing-indicator">
				<i class="fas fa-ellipsis-h"></i>
				{s.isSummarizing
					? 'Суммаризация...'
					: s.isRerolling
						? 'Реролл...'
						: 'Персонаж печатает...'
				}
			</div>
		{/if}
	</div>

	<!-- Плавающие кнопки быстрого скролла -->
	<div class="chat-floating-controls" class:visible={canScrollUp || canScrollDown}>
		{#if canScrollUp}
			<button class="scroll-btn" onclick={scrollToTop} title="Наверх">
				<i class="fas fa-arrow-up"></i>
			</button>
		{/if}
		{#if canScrollDown}
			<button class="scroll-btn" onclick={scrollToBottom} title="Вниз к новым сообщениям">
				<i class="fas fa-arrow-down"></i>
			</button>
		{/if}
	</div>

	<!-- Кнопки выбора вариантов ответа -->
	{#if choices.length >= 2}
		<div class="choice-buttons">
			{#each choices as c, i (c)}
				<button class="choice-btn" onclick={() => handleChoiceClick(c)}>
					{i + 1}. {c}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Поле ввода -->
	<div class="chat-input-container">
		<textarea
			class="chat-input"
			bind:value={input}
			rows="2"
			placeholder="Введите сообщение... (Enter — отправить, Shift+Enter — перенос)"
			disabled={s.isGenerating || s.isSummarizing || s.isRerolling}
			onkeydown={onKeydown}
		></textarea>
		<button
			class="send-btn"
			onclick={onSend}
			disabled={s.isGenerating || s.isSummarizing || s.isRerolling || !input.trim()}
			title="Отправить сообщение"
		>
			<i class="fas fa-paper-plane"></i>
		</button>
	</div>

	<!-- Селектор веток -->
	{#if partBranches.length > 1}
		<div class="branch-selector">
			<span class="branch-selector-label">Ветви:</span>
			{#each partBranches as x (x.b.id)}
				<div class="branch-btn-container">
					<button
						class="branch-nav-btn {s.chatTree.activeBranchIndex === x.idx ? 'active' : ''}"
						onclick={() => switchBranch(x.idx)}
					>
						{x.b.name}
					</button>
					{#if x.idx > 0 && s.chatTree.activeBranchIndex === x.idx}
						<button
							class="delete-branch-btn"
							title="Удалить ветвь"
							onclick={() => deleteBranch(x.idx)}
						>
							<i class="fas fa-trash"></i>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Селектор частей -->
	{#if s.chatParts.length > 1}
		<div class="part-selector">
			<span class="part-selector-label">Части:</span>
			{#each s.chatParts as p, idx (p.id)}
				<div class="part-btn-container">
					<button
						class="part-nav-btn {idx === s.currentPartIndex ? 'active' : ''}"
						onclick={() => switchPart(idx)}
					>
						{p.name}
					</button>
					{#if idx > 0 && idx === s.currentPartIndex}
						<button
							class="delete-part-btn"
							title="Удалить часть"
							onclick={() => deletePart(idx)}
						>
							<i class="fas fa-trash"></i>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>