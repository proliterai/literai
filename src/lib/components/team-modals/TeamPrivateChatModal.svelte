<!-- ================================================================================
ФАЙЛ: src/lib/components/team-modals/TeamPrivateChatModal.svelte
Описание: Модальное окно приватных чатов (С ОГРАНИЧЕННОЙ ШИРИНОЙ НА ДЕСКТОПЕ)
================================================================================ -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import PrivateChatMessage from '$lib/components/private-chat/PrivateChatMessage.svelte';
  import type { CatalogItemRow } from '$lib/db/types';

  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  interface Props {
    characters: CatalogItemRow[];
    onClose: () => void;
  }

  let { characters, onClose }: Props = $props();

  let state = $derived($privateChatStore);
  let activeRecipient = $derived(
    state.activeRecipientId
      ? characters.find(c => c.id === state.activeRecipientId)
      : null
  );

  let currentPartChats = $derived(state.privateChats[state.currentPartIndex] ?? {});
  let activeChat = $derived(
    state.activeRecipientId ? currentPartChats[state.activeRecipientId] : null
  );
  let messages = $derived(activeChat?.messages ?? []);

  // Карусель отправителей
  let availableSenders = $derived(characters.filter(c => c.id !== state.activeRecipientId));

  // Локальный индекс отправителя для реактивности
  let localSenderIndex = $state(0);

  // Синхронизация с данными чата
  $effect(() => {
    if (activeChat?.senderCarouselIndex !== undefined) {
      localSenderIndex = activeChat.senderCarouselIndex;
    } else {
      localSenderIndex = 0;
    }
  });

  // Текущий отправитель
  let currentSender = $derived(
    availableSenders.length > 0
      ? availableSenders[Math.min(localSenderIndex, availableSenders.length - 1)]
      : null
  );

  let inputText = $state('');
  let isGenerating = $derived(state.isGenerating);
  let messagesContainer: HTMLDivElement | null = $state(null);
  let showMobileCharList = $state(false);

  // Автопрокрутка
  $effect(() => {
    if (messages.length && messagesContainer) {
      tick().then(() => {
        messagesContainer?.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  });

  function getAvatar(item: { avatar?: string } | null | undefined): string {
    return item?.avatar || AVATAR_PLACEHOLDER;
  }

  function openChat(recipientId: string) {
    privateChatStore.openChat(recipientId);
    showMobileCharList = false;
  }

  async function sendMessage() {
    if (!inputText.trim() || isGenerating) return;

    const text = inputText;
    inputText = '';

    await privateChatStore.sendMessage(text);
  }

  function prevSender() {
    if (!state.activeRecipientId || availableSenders.length <= 1) return;

    const newIndex = (localSenderIndex - 1 + availableSenders.length) % availableSenders.length;
    localSenderIndex = newIndex;

    updateSenderIndexInStore(newIndex);
  }

  function nextSender() {
    if (!state.activeRecipientId || availableSenders.length <= 1) return;

    const newIndex = (localSenderIndex + 1) % availableSenders.length;
    localSenderIndex = newIndex;

    updateSenderIndexInStore(newIndex);
  }

  function updateSenderIndexInStore(newIndex: number) {
    const recipientId = state.activeRecipientId;
    if (!recipientId) return;

    privateChatStore.update(s => {
      if (!s.privateChats[s.currentPartIndex]) {
        s.privateChats[s.currentPartIndex] = {};
      }

      if (!s.privateChats[s.currentPartIndex][recipientId]) {
        s.privateChats[s.currentPartIndex][recipientId] = {
          messages: [],
          senderCarouselIndex: 0
        };
      }

      s.privateChats[s.currentPartIndex][recipientId].senderCarouselIndex = newIndex;

      return { ...s };
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleAvatarError(e: Event) {
    (e.currentTarget as HTMLImageElement).src = AVATAR_PLACEHOLDER;
  }

  function getUnreadCount(charId: string): number {
    return currentPartChats[charId]?.messages?.length ?? 0;
  }

  // ===== Обработчики для сообщений =====
  function handleReroll(messageId: string) {
    privateChatStore.reroll(messageId);
  }

  function handleEdit(messageId: string, newContent: string) {
    privateChatStore.editMessage(messageId, newContent);
  }

  function handleDelete(messageId: string) {
    privateChatStore.deleteMessage(messageId);
  }

  function handleSwitchVersion(messageId: string, direction: -1 | 1) {
    privateChatStore.switchVersion(messageId, direction);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="private-modal-overlay" onclick={onClose}>
  
  <!-- Само окно с ограничением ширины. Остановка всплытия клика, чтобы не закрывалось при клике внутри -->
  <div class="private-modal-window" onclick={(e) => e.stopPropagation()}>
    
    <!-- Sidebar -->
    <aside class="sidebar" class:mobile-visible={showMobileCharList}>
      <div class="sidebar-header">
        <h2 class="sidebar-title">
          <i class="fas fa-comments"></i>
          <span>Приватные чаты</span>
        </h2>
        <span class="part-indicator">Часть {state.currentPartIndex + 1}</span>
      </div>

      <div class="characters-list">
        {#each characters as char (char.id)}
          {@const unreadCount = getUnreadCount(char.id)}
          <button
            class="char-item"
            class:active={state.activeRecipientId === char.id}
            onclick={() => openChat(char.id)}
          >
            <div class="char-avatar-wrapper">
              <img
                class="char-avatar"
                src={getAvatar(char)}
                alt={char.name}
                onerror={handleAvatarError}
              />
              {#if unreadCount > 0}
                <span class="unread-badge">{unreadCount}</span>
              {/if}
            </div>
            <div class="char-info">
              <span class="char-name">{char.name}</span>
              <span class="char-status">
                {#if state.activeRecipientId === char.id}
                  Активный чат
                {:else if unreadCount > 0}
                  {unreadCount} сообщ.
                {:else}
                  Нет сообщений
                {/if}
              </span>
            </div>
          </button>
        {/each}
      </div>

      <div class="sidebar-footer">
        <button class="back-btn" onclick={onClose}>
          <i class="fas fa-arrow-left"></i>
          <span>Вернуться к игре</span>
        </button>
      </div>
    </aside>

    <!-- Main Chat Area -->
    <main class="chat-area">
      {#if activeRecipient}
        <!-- Chat Header -->
        <header class="chat-header">
          <button
            class="mobile-menu-btn"
            onclick={() => showMobileCharList = !showMobileCharList}
          >
            <i class="fas fa-bars"></i>
          </button>

          <div class="recipient-info">
            <img
              class="recipient-avatar"
              src={getAvatar(activeRecipient)}
              alt={activeRecipient.name}
              onerror={handleAvatarError}
            />
            <div class="recipient-details">
              <span class="recipient-name">{activeRecipient.name}</span>
              <span class="recipient-status">
                {#if isGenerating}
                  <i class="fas fa-circle-notch fa-spin"></i> Печатает...
                {:else}
                  Приватный диалог
                {/if}
              </span>
            </div>
          </div>

          <button class="close-chat-btn" onclick={onClose} title="Закрыть приватный чат">
            <i class="fas fa-times"></i>
          </button>
        </header>

        <!-- Messages -->
        <div class="messages-container" bind:this={messagesContainer}>
          {#if messages.length === 0}
            <div class="empty-chat">
              <div class="empty-icon">
                <i class="fas fa-comment-dots"></i>
              </div>
              <h3 class="empty-title">Начните диалог</h3>
              <p class="empty-text">
                Напишите первое сообщение персонажу {activeRecipient.name}
              </p>
            </div>
          {:else}
            <div class="messages-list">
              {#each messages as msg (msg.id)}
                <PrivateChatMessage
                  message={msg}
                  {characters}
                  onReroll={handleReroll}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSwitchVersion={handleSwitchVersion}
                />
              {/each}
            </div>
          {/if}

          {#if isGenerating}
            <div class="typing-indicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          {/if}
        </div>

        <!-- Input Area -->
        <footer class="input-area">
          <!-- Sender Carousel -->
          {#if availableSenders.length > 0}
            <div class="sender-selector">
              <span class="sender-label">От имени:</span>
              <div class="sender-carousel">
                <button
                  type="button"
                  class="carousel-btn"
                  onclick={prevSender}
                  disabled={availableSenders.length <= 1}
                  aria-label="Предыдущий отправитель"
                >
                  <i class="fas fa-chevron-left"></i>
                </button>

                {#if currentSender}
                  <div class="current-sender">
                    <img
                      class="sender-avatar"
                      src={getAvatar(currentSender)}
                      alt={currentSender.name}
                      onerror={handleAvatarError}
                    />
                    <span class="sender-name">{currentSender.name}</span>
                  </div>
                {/if}

                <button
                  type="button"
                  class="carousel-btn"
                  onclick={nextSender}
                  disabled={availableSenders.length <= 1}
                  aria-label="Следующий отправитель"
                >
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>

              {#if availableSenders.length > 1}
                <span class="sender-counter">
                  {localSenderIndex + 1} / {availableSenders.length}
                </span>
              {/if}
            </div>
          {/if}

          <!-- Message Input -->
          <div class="input-row">
            <div class="input-wrapper">
              <textarea
                class="message-input"
                bind:value={inputText}
                placeholder="Введите сообщение..."
                rows="1"
                onkeydown={handleKeydown}
              ></textarea>
            </div>
            <button
              type="button"
              class="send-btn"
              onclick={sendMessage}
              disabled={isGenerating || !inputText.trim()}
            >
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </footer>
      {:else}
        <!-- Empty State -->
        <div class="no-chat-selected">
          <button
            type="button"
            class="mobile-menu-btn standalone"
            onclick={() => showMobileCharList = true}
          >
            <i class="fas fa-users"></i>
            <span>Выбрать персонажа</span>
          </button>

          <div class="empty-state">
            <div class="empty-icon large">
              <i class="fas fa-user-friends"></i>
            </div>
            <h2 class="empty-title">Выберите персонажа</h2>
            <p class="empty-text">
              Выберите персонажа из списка слева для начала приватного диалога
            </p>
          </div>
        </div>
      {/if}
    </main>

    <!-- Mobile Overlay for Sidebar -->
    {#if showMobileCharList}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="mobile-overlay" onclick={() => showMobileCharList = false}></div>
    {/if}
  </div>
</div>

<style>
  /* ======================== OVERLAY & WINDOW ======================== */
  .private-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-bg);
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    padding: var(--space-4);
  }

  .private-modal-window {
    display: flex;
    width: 100%;
    /* ОГРАНИЧЕНИЕ ШИРИНЫ НА ДЕСКТОПЕ */
    max-width: 1080px; 
    height: 85vh;
    max-height: 800px;
    background: var(--bg-surface-1);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl), var(--fx-shadow-gold);
    overflow: hidden;
    position: relative;
    animation: modalScaleUp 0.25s var(--ease-out);
  }

  @keyframes modalScaleUp {
    from { opacity: 0; transform: scale(0.97) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* ======================== SIDEBAR ======================== */
  .sidebar {
    flex-shrink: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface-2);
    border-right: 1px solid var(--border-divider);
  }

  .sidebar-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background: var(--bg-surface-3);
    border-bottom: 1px solid var(--border-divider);
  }

  .sidebar-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--txt-primary);
  }

  .sidebar-title i {
    color: var(--txt-gold);
  }

  .part-indicator {
    padding: var(--space-1) var(--space-2);
    background: var(--bg-surface-4);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--txt-gold);
  }

  .characters-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .char-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .char-item:hover {
    background: var(--state-hover);
    border-color: var(--border-subtle);
  }

  .char-item.active {
    background: var(--state-selected);
    border-color: var(--txt-gold);
  }

  .char-avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .char-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-color);
    transition: border-color 0.2s ease;
  }

  .char-item:hover .char-avatar,
  .char-item.active .char-avatar {
    border-color: var(--txt-gold);
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--txt-gold);
    color: var(--bg-app);
    font-size: 10px;
    font-weight: 700;
    border-radius: var(--radius-full);
    padding: 0 4px;
  }

  .char-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .char-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--txt-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .char-status {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
  }

  .char-item.active .char-status {
    color: var(--txt-gold);
  }

  .sidebar-footer {
    flex-shrink: 0;
    padding: var(--space-3);
    background: var(--bg-surface-3);
    border-top: 1px solid var(--border-divider);
  }

  .back-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-surface-4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: var(--bg-surface-5);
    border-color: var(--border-hover);
    color: var(--txt-primary);
  }

  /* ======================== CHAT AREA ======================== */
  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--bg-surface-1);
  }

  /* Chat Header */
  .chat-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface-2);
    border-bottom: 1px solid var(--border-divider);
  }

  .mobile-menu-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--bg-surface-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mobile-menu-btn:hover {
    background: var(--bg-surface-4);
    color: var(--txt-primary);
  }

  .mobile-menu-btn.standalone {
    display: none;
    gap: var(--space-2);
    width: auto;
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
  }

  .recipient-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .recipient-avatar {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--txt-gold);
    box-shadow: var(--fx-glow-gold-subtle);
  }

  .recipient-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .recipient-name {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--txt-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recipient-status {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
  }

  .recipient-status i {
    color: var(--txt-gold);
  }

  .close-chat-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--bg-surface-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-chat-btn:hover {
    background: var(--state-error-bg);
    border-color: var(--state-error-border);
    color: var(--state-error);
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Empty States */
  .empty-chat,
  .no-chat-selected {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    text-align: center;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface-3);
    border-radius: 50%;
    margin-bottom: var(--space-4);
  }

  .empty-icon.large {
    width: 100px;
    height: 100px;
  }

  .empty-icon i {
    font-size: 2rem;
    color: var(--txt-muted);
    opacity: 0.6;
  }

  .empty-icon.large i {
    font-size: 2.5rem;
  }

  .empty-title {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--txt-secondary);
  }

  .empty-text {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
    max-width: 300px;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: var(--space-3);
    align-self: flex-start;
  }

  .typing-dot {
    width: 8px;
    height: 8px;
    background: var(--txt-muted);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out both;
  }

  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes typing {
    0%, 80%, 100% {
      transform: scale(0.6);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Input Area */
  .input-area {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--border-divider);
  }

  /* Sender Selector */
  .sender-selector {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sender-label {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--txt-muted);
  }

  .sender-carousel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-surface-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }

  .carousel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--bg-surface-4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .carousel-btn:hover:not(:disabled) {
    background: var(--grad-burgundy);
    border-color: var(--txt-gold);
    color: var(--txt-on-accent);
    box-shadow: var(--fx-glow-gold-subtle);
  }

  .carousel-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .carousel-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .current-sender {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    min-width: 120px;
    justify-content: center;
  }

  .sender-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--txt-gold);
    flex-shrink: 0;
  }

  .sender-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--txt-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sender-counter {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-surface-4);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    font-weight: 500;
  }

  /* Input Row */
  .input-row {
    display: flex;
    gap: var(--space-3);
  }

  .input-wrapper {
    flex: 1;
    background: var(--bg-surface-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    transition: all 0.2s ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--txt-gold);
    box-shadow: var(--input-focus-shadow);
  }

  .message-input {
    width: 100%;
    min-height: 44px;
    max-height: 120px;
    padding: var(--space-3);
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
    width: 48px;
    height: 48px;
    background: var(--grad-burgundy);
    border: none;
    border-radius: var(--radius-lg);
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

  /* Mobile Overlay */
  .mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    z-index: 5;
  }

  /* Scrollbar */
  .messages-container::-webkit-scrollbar,
  .characters-list::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-track,
  .characters-list::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .messages-container::-webkit-scrollbar-thumb,
  .characters-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--radius-full);
  }

  .messages-container::-webkit-scrollbar-thumb:hover,
  .characters-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* ======================== MOBILE ======================== */
  @media (max-width: 768px) {
    .private-modal-overlay {
      padding: 0; /* На мобилке занимаем весь экран */
    }

    .private-modal-window {
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      border: none;
    }

    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 280px;
      transform: translateX(-100%);
      z-index: 10;
      transition: transform 0.3s ease;
    }

    .sidebar.mobile-visible {
      transform: translateX(0);
    }

    .mobile-overlay {
      display: block;
    }

    .mobile-menu-btn {
      display: flex;
    }

    .mobile-menu-btn.standalone {
      display: flex;
    }

    .chat-header {
      padding: var(--space-3);
    }

    .recipient-avatar {
      width: 40px;
      height: 40px;
    }

    .recipient-name {
      font-size: var(--font-size-sm);
    }

    .messages-container {
      padding: var(--space-3);
    }

    .input-area {
      padding: var(--space-3);
    }

    .sender-selector {
      flex-direction: column;
      align-items: stretch;
    }

    .sender-label {
      text-align: center;
    }

    .sender-counter {
      align-self: center;
    }
  }

  @media (max-width: 480px) {
    .sidebar {
      width: 100%;
    }
  }
</style>