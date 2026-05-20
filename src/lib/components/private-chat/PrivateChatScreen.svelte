<!-- ================================================================================
ФАЙЛ: src/lib/components/private-chat/PrivateChatScreen.svelte
Описание: Оверлей приватного чата
================================================================================ -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import PrivateChatMessage from './PrivateChatMessage.svelte';
  import type { PrivateMessage } from '$lib/domain/private-chat/privateChat.types';

  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  let privateState = $derived($privateChatStore);

  let messages = $derived((privateState.messages ?? []).filter(
    (m): m is PrivateMessage => m != null && typeof m.role === 'string'
  ));

  let input = $state('');
  let messagesContainer: HTMLDivElement | null = $state(null);

  // Состояния для умного скролла и плавающих кнопок
  let shouldStickToBottom = $state(true);
  let canScrollUp = $state(false);
  let canScrollDown = $state(false);

  // Автопрокрутка при новых сообщениях
  $effect(() => {
    messages; // Триггер эффекта при изменении массива
    if (shouldStickToBottom && messagesContainer) {
      tick().then(() => {
        messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
      });
    }
  });

  // Отслеживание скролла внутри контейнера
  function handleScroll() {
    if (!messagesContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    
    // Считаем, что мы внизу, если до конца меньше 100px
    shouldStickToBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Показываем кнопку "Вверх", если проскроллили больше 150px
    canScrollUp = scrollTop > 150;
    
    // Показываем кнопку "Вниз", если мы не в самом низу
    canScrollDown = !shouldStickToBottom;
  }

  function scrollToTop() {
    messagesContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  }

  onMount(() => {
    // Проверяем скролл при открытии
    handleScroll();
  });

  function close() {
    privateChatStore.setVisible(false);
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    input = '';
    privateChatStore.sendMessage(text);
    
    // Принудительно скроллим вниз при отправке сообщения
    shouldStickToBottom = true;
    scrollToBottom();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReroll(msgId: string) {
    privateChatStore.reroll(msgId);
    shouldStickToBottom = true;
  }

  function handleEdit(msgId: string, newContent: string) {
    privateChatStore.editMessage(msgId, newContent);
  }

  function handleDelete(msgId: string) {
    privateChatStore.deleteMessage(msgId);
  }

  function handleSwitchVersion(msgId: string, direction: -1 | 1) {
    privateChatStore.switchVersion(msgId, direction);
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="private-overlay" onclick={handleOverlayClick}>
  <div class="private-panel">
    <!-- Header -->
    <header class="private-header">
      <div class="header-title">
        <i class="fas fa-comments"></i>
        <span>Приватный чат</span>
      </div>
      <button class="close-btn" onclick={close} aria-label="Закрыть">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <!-- Messages -->
    <div 
      class="messages-area" 
      bind:this={messagesContainer}
      onscroll={handleScroll}
    >
      {#if messages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <i class="fas fa-comment-dots"></i>
          </div>
          <p class="empty-title">Нет сообщений</p>
          <p class="empty-subtitle">Начните диалог прямо сейчас</p>
        </div>
      {:else}
        <div class="messages-list">
          {#each messages as msg (msg.id)}
            <PrivateChatMessage
              message={msg}
              onReroll={handleReroll}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSwitchVersion={handleSwitchVersion}
            />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Плавающие кнопки скролла (позиционируются внутри private-panel) -->
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

    <!-- Input -->
    <footer class="input-footer">
      <div class="input-wrapper">
        <textarea
          class="message-input"
          bind:value={input}
          rows="1"
          placeholder="Введите сообщение..."
          onkeydown={handleKeydown}
        ></textarea>
        <button
          class="send-btn"
          onclick={handleSend}
          disabled={!input.trim()}
          aria-label="Отправить"
        >
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .private-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-bg);
    backdrop-filter: blur(var(--overlay-blur));
    padding: var(--space-4);
  }

  .private-panel {
    width: 100%;
    max-width: 560px;
    max-height: calc(100vh - var(--space-8));
    display: flex;
    flex-direction: column;
    background: var(--glass-bg-heavy);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl), var(--fx-glow-gold-subtle);
    overflow: hidden;
    position: relative; /* ВАЖНО: нужно для позиционирования кнопок скролла */
  }

  /* Header */
  .private-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background: var(--bg-surface-2);
    border-bottom: 1px solid var(--border-divider);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--txt-primary);
  }

  .header-title i {
    color: var(--txt-gold);
    font-size: 1.1em;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--bg-surface-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--bg-surface-4);
    color: var(--txt-primary);
    border-color: var(--border-hover);
  }

  /* Messages Area */
  .messages-area {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
    background: var(--bg-surface-1);
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    text-align: center;
    padding: var(--space-6);
  }

  .empty-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface-3);
    border-radius: 50%;
    margin-bottom: var(--space-4);
  }

  .empty-icon i {
    font-size: 2rem;
    color: var(--txt-muted);
    opacity: 0.6;
  }

  .empty-title {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--txt-secondary);
  }

  .empty-subtitle {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
  }

  /* ============================
     Плавающие кнопки скролла
     ============================ */
  .chat-floating-controls {
    position: absolute; /* Позиционируется относительно .private-panel */
    right: var(--space-4);
    bottom: 90px; /* Чуть выше поля ввода (footer) */
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    z-index: 50;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    transform: translateY(10px);
  }

  .chat-floating-controls.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .chat-floating-controls .scroll-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--glass-bg-heavy);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    color: var(--txt-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .chat-floating-controls .scroll-btn:hover {
    background: var(--bg-surface-3);
    border-color: var(--txt-gold);
    transform: scale(1.1);
    box-shadow: var(--fx-shadow-gold);
  }

  /* Input Footer */
  .input-footer {
    flex-shrink: 0;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--border-divider);
    position: relative;
    z-index: 2;
  }

  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    background: var(--bg-surface-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-2);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--txt-gold);
    box-shadow: var(--input-focus-shadow);
  }

  .message-input {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: var(--space-2);
    background: transparent;
    border: none;
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    line-height: var(--leading-normal);
    resize: none;
  }

  .message-input::placeholder {
    color: var(--txt-muted);
  }

  .message-input:focus {
    outline: none;
  }

  .send-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--grad-burgundy);
    border: none;
    border-radius: var(--radius-md);
    color: var(--txt-on-accent);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .send-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: var(--fx-glow-gold);
  }

  .send-btn:disabled {
    opacity: var(--interactive-disabled-opacity);
    cursor: not-allowed;
  }

  /* Scrollbar */
  .messages-area::-webkit-scrollbar {
    width: 6px;
  }

  .messages-area::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .messages-area::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--radius-full);
  }

  .messages-area::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Mobile */
  @media (max-width: 640px) {
    .private-overlay {
      padding: 0;
    }

    .private-panel {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .private-header {
      padding: var(--space-3);
    }

    .header-title {
      font-size: var(--font-size-md);
    }

    .messages-area {
      padding: var(--space-3);
    }

    .input-footer {
      padding: var(--space-3);
    }

    .chat-floating-controls {
      right: var(--space-3);
      bottom: 80px;
    }
    .chat-floating-controls .scroll-btn {
      width: 36px;
      height: 36px;
      font-size: 0.9rem;
    }
  }
</style>