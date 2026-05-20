<!-- ================================================================================
ФАЙЛ: src/lib/components/team-chat/TeamChatView.svelte
================================================================================ -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';
  import * as teamActions from '$lib/domain/team-chat/teamChat.actions';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { buildTeamSessionRow } from '$lib/domain/team-chat/teamChat.sessionRow';
  import { ui } from '$lib/ui/ui.store';
  import TeamMessageBubble from './TeamMessageBubble.svelte';
  import TeamManualControls from './TeamManualControls.svelte';
  import TeamPartSelector from './TeamPartSelector.svelte';
  import TeamPrivateChatModal from '$lib/components/team-modals/TeamPrivateChatModal.svelte';

  // Путь к плейсхолдеру
  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  let chatState = $derived($teamChatStore);
  let activeBranch = $derived($teamChatStore.chatTree.branches[$teamChatStore.chatTree.activeBranchIndex]);
  let messages = $derived(activeBranch?.messages.filter(m => m.role !== 'system') ?? []);
  let characters = $derived(chatState.selectedItems?.teamCharacters ?? []);

  let messagesContainer: HTMLDivElement | null = $state(null);
  let privateVisible = $derived($privateChatStore.isVisible);

  // Состояния для умного скролла и плавающих кнопок
  let shouldStickToBottom = $state(true);
  let canScrollUp = $state(false);
  let canScrollDown = $state(false);

  // Скролл вниз при новых сообщениях
  $effect(() => {
    messages; // Триггер эффекта при изменении массива
    if (shouldStickToBottom) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  });

  // Универсальный обработчик скролла (срабатывает и от окна, и от контейнера)
  function handleScroll() {
    // Получаем данные скролла окна
    const winScrollTop = window.scrollY || document.documentElement.scrollTop;
    // Получаем данные скролла контейнера (если он есть)
    const divScrollTop = messagesContainer?.scrollTop || 0;

    let st, sh, ch;

    // Определяем, что именно скроллится: страница целиком или блок сообщений
    if (winScrollTop > 0 || (messagesContainer && messagesContainer.scrollHeight <= messagesContainer.clientHeight)) {
      st = winScrollTop;
      sh = document.documentElement.scrollHeight;
      ch = window.innerHeight;
    } else if (messagesContainer) {
      st = divScrollTop;
      sh = messagesContainer.scrollHeight;
      ch = messagesContainer.clientHeight;
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
    messagesContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    messagesContainer?.scrollTo({ top: messagesContainer?.scrollHeight, behavior: 'smooth' });
  }

  onMount(async () => {
    // Подключаем автосохранение
    teamChatStore.onAutoSave(async () => {
      try {
        const sessionRow = buildTeamSessionRow();
        if (sessionRow.id) {
          await sessionsRepo.save(sessionRow);
        }
      } catch (e) {
        console.error('[TeamChatView] Autosave failed:', e);
      }
    });

    // Инициализируем приватные чаты с исправленными аватарами
    if (characters.length > 0) {
      privateChatStore.init({
        characters: characters.map(c => ({
          id: c.id,
          name: c.name,
          avatar: c.avatar || AVATAR_PLACEHOLDER
        })),
        mainChatHistory: messages,
        generatedScript: chatState.generatedScript,
        itemDescriptions: chatState.itemDescriptions,
        currentPartIndex: chatState.currentPartIndex
      });
    }

    // Проверяем скролл при загрузке
    handleScroll();

    // Генерируем первый ответ рассказчика, если история пуста
    await teamActions.ensureFirstResponse();
  });

  onDestroy(() => {
    teamChatStore.destroy();
  });

  function handleNarratorClick() {
    teamActions.sendAsNarrator();
    shouldStickToBottom = true;
    scrollToBottom();
  }

  function handleCharacterClick(characterId: string) {
    teamActions.sendAsCharacter(characterId);
    shouldStickToBottom = true;
    scrollToBottom();
  }

  function handleReroll(messageId: string) {
    teamActions.reroll(messageId);
    shouldStickToBottom = true;
  }

  function handleEdit(messageId: string, newText: string) {
    teamChatStore.updateMessage(messageId, newText);
  }

  function handleDelete(messageId: string) {
    teamActions.deleteMessage(messageId);
  }

  function handleSwitchVersion(messageId: string, dir: -1 | 1) {
    teamActions.switchVersion(messageId, dir);
  }

  // Закрытие приватных чатов и обновление контекста
  function handlePrivateChatClose() {
    privateChatStore.setVisible(false);
    if (activeBranch) {
      privateChatStore.updateMainChatContext(
        activeBranch.messages,
        chatState.generatedScript,
        chatState.itemDescriptions
      );
    }
  }
</script>

<!-- Глобальный слушатель скролла страницы -->
<svelte:window onscroll={handleScroll} />

<div class="team-chat-view">
  <!-- Заголовок -->
  <div class="chat-header">
    <h2 class="chat-title">
      <i class="fas fa-users"></i>
     <span>{chatState.title}</span>
    </h2>
    <div class="header-actions">
      <!-- Кнопка приватных чатов удалена из шапки -->
    </div>
  </div>

  <!-- Селектор частей (если больше 1) -->
  {#if chatState.chatParts.length > 1}
    <TeamPartSelector
      parts={chatState.chatParts}
      currentIndex={chatState.currentPartIndex}
      onSwitch={teamActions.switchPart}
      onDelete={teamActions.deletePart}
    />
  {/if}

  <!-- Сообщения -->
  <div 
    class="chat-messages" 
    bind:this={messagesContainer}
    onscroll={handleScroll}
  >
    {#if messages.length === 0}
      <div class="empty-chat">
        <i class="fas fa-book-open"></i>
        <p>История начинается...</p>
      </div>
    {:else}
      {#each messages as msg (msg.id)}
        <TeamMessageBubble
          message={msg}
          onReroll={() => handleReroll(msg.id)}
          onEdit={(text) => handleEdit(msg.id, text)}
          onDelete={() => handleDelete(msg.id)}
          onSwitchVersion={(dir) => handleSwitchVersion(msg.id, dir)}
        />
      {/each}
    {/if}

    {#if chatState.isGenerating || chatState.isRerolling || chatState.isSummarizing}
    <div class="typing-indicator">
        <i class="fas fa-ellipsis-h"></i>
        {chatState.isSummarizing
            ? 'Суммаризация...'
            : chatState.isRerolling
                ? 'Реролл...'
                : 'Генерация...'}
    </div>
{/if}
  </div>

  <!-- Панель управления ходами -->
  <TeamManualControls
    {characters}
    isGenerating={chatState.isGenerating}
    onNarratorClick={handleNarratorClick}
    onCharacterClick={handleCharacterClick}
  />
</div>

<!-- Плавающие кнопки быстрого скролла (Вынесены из потока чата) -->
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

<!-- Модальное окно приватных чатов -->
{#if privateVisible}
  <TeamPrivateChatModal
    {characters}
    onClose={handlePrivateChatClose}
  />
{/if}

<style>
  .team-chat-view {
    display: flex;
    flex-direction: column;
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-4);
    min-height: 0;
    background: color-mix(in srgb, var(--bg-primary), transparent 10%);
    position: relative;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .chat-title {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--txt-primary);
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
  }

  .chat-title i {
    margin-right: var(--space-2);
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .chat-title span {
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1.3;
  }

  .header-actions {
    display: flex;
    gap: var(--space-2);
  }

  .btn-secondary {
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-primary);
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--txt-muted);
    text-align: center;
  }

  .empty-chat i {
    font-size: 3rem;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }

  .typing-indicator {
    padding: var(--space-3);
    color: var(--txt-muted);
    font-style: italic;
    text-align: center;
  }
</style>