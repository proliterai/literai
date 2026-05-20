<!-- ================================================================================
ФАЙЛ: src/lib/components/private-chat/PrivateChatMessage.svelte
Описание: Компонент сообщения в приватном чате
================================================================================ -->
<script lang="ts">
  import type { PrivateMessage } from '$lib/domain/private-chat/privateChat.types';
  import { settingsStore } from '$lib/domain/settings/settings.store';
  import { ui } from '$lib/ui/ui.store';
  import { renderMarkdown } from '$lib/utils/markdown';

  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  interface Props {
    message: PrivateMessage;
    characters?: any[];
    onReroll?: (msgId: string) => void;
    onEdit?: (msgId: string, newContent: string) => void;
    onDelete?: (msgId: string) => void;
    onSwitchVersion?: (msgId: string, direction: -1 | 1) => void;
  }

  let {
    message,
    characters = [],
    onReroll = () => {},
    onEdit = () => {},
    onDelete = () => {},
    onSwitchVersion = () => {}
  }: Props = $props();

  let isEditing = $state(false);
  let editText = $state('');
  let showActions = $state(false);

  // Подписка на стиль аватарок
  let avatarStyle = $derived($settingsStore.values.avatar_style || 'small');

  let isUser = $derived(message?.role === 'user');
  let displayName = $derived(isUser ? message?.senderName : message?.characterName);
  let avatarUrl = $derived(isUser ? message?.senderAvatar : message?.characterAvatar);

  let currentContent = $derived(
    message?.versions && message?.currentVersion !== undefined
      ? message.versions[message.currentVersion]?.content ?? message.content
      : message?.content ?? ''
  );

  let hasVersions = $derived(message?.versions && message.versions.length > 1);
  let versionCount = $derived(hasVersions ? message.versions!.length : 1);
  let currentVersionIndex = $derived(message?.currentVersion ?? 0);

  let renderedContent = $derived(renderMarkdown(currentContent));

  function handleReroll() {
    if (message?.id) onReroll(message.id);
  }

  function handleDelete() {
    if (message?.id && confirm('Удалить это сообщение?')) {
      onDelete(message.id);
    }
  }

  function startEdit() {
    editText = currentContent;
    isEditing = true;
  }

  function cancelEdit() {
    isEditing = false;
  }

  function saveEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== currentContent && message?.id) {
      onEdit(message.id, trimmed);
    }
    isEditing = false;
  }

  function switchVersion(direction: -1 | 1) {
    if (message?.id) onSwitchVersion(message.id, direction);
  }

  function handleAvatarError(e: Event) {
    (e.currentTarget as HTMLImageElement).src = AVATAR_PLACEHOLDER;
  }
</script>

{#if message}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="message-bubble"
    class:is-user={isUser}
    class:is-bot={!isUser}
    class:is-full-avatar={avatarStyle === 'full' && avatarUrl && avatarUrl !== AVATAR_PLACEHOLDER}
    data-msg-id={message.id}
    onmouseenter={() => showActions = true}
    onmouseleave={() => showActions = false}
  >
    <!-- Avatar / Cover Image -->
    {#if avatarStyle === 'full' && avatarUrl && avatarUrl !== AVATAR_PLACEHOLDER}
      <div class="msg-hero-team" style="margin: -12px -12px 12px -12px;">
        <img class="msg-hero-img" src={avatarUrl} alt={displayName} />
        <div class="msg-hero-gradient"></div>
        <button class="hero-zoom-btn" onclick={() => ui.openLightbox(avatarUrl)} title="Открыть полное фото">
          <i class="fas fa-search-plus"></i>
        </button>
        <div class="msg-hero-header">
          <span class="sender-name" style="color:white; font-size:var(--font-size-md);">{displayName || 'Персонаж'}</span>
          {#if hasVersions}
            <div class="version-badge" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);">
              <button class="version-btn" style="color:white;" disabled={currentVersionIndex === 0} onclick={() => switchVersion(-1)}><i class="fas fa-chevron-left"></i></button>
              <span class="version-text" style="color:white;">{currentVersionIndex + 1}/{versionCount}</span>
              <button class="version-btn" style="color:white;" disabled={currentVersionIndex === versionCount - 1} onclick={() => switchVersion(1)}><i class="fas fa-chevron-right"></i></button>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="message-avatar">
        {#if avatarUrl}
          <div class="avatar-container">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <img
              src={avatarUrl}
              alt={displayName}
              style:cursor={avatarStyle === 'small' && avatarUrl !== AVATAR_PLACEHOLDER ? 'zoom-in' : 'default'}
              onclick={() => (avatarStyle === 'small' && avatarUrl !== AVATAR_PLACEHOLDER) ? ui.openLightbox(avatarUrl) : null}
              onerror={handleAvatarError}
            />
            {#if avatarStyle === 'large' && avatarUrl !== AVATAR_PLACEHOLDER}
              <button class="large-zoom-btn" onclick={() => ui.openLightbox(avatarUrl)} title="Открыть полное фото">
                <i class="fas fa-search-plus"></i>
              </button>
            {/if}
          </div>
        {:else}
          <div class="avatar-placeholder">
            <i class="fas {isUser ? 'fa-user' : 'fa-robot'}"></i>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Content wrapper -->
    <div class="message-body" style={avatarStyle === 'full' && avatarUrl && avatarUrl !== AVATAR_PLACEHOLDER ? "padding-left: 0; padding-right: 0;" : ""}>
      <!-- Header -->
      {#if !(avatarStyle === 'full' && avatarUrl && avatarUrl !== AVATAR_PLACEHOLDER)}
        <div class="message-header">
          <span class="sender-name">{displayName || 'Персонаж'}</span>
          {#if hasVersions}
            <div class="version-badge">
              <button
                class="version-btn"
                disabled={currentVersionIndex === 0}
                onclick={() => switchVersion(-1)}
                aria-label="Предыдущая версия"
              >
                <i class="fas fa-chevron-left"></i>
              </button>
              <span class="version-text">{currentVersionIndex + 1}/{versionCount}</span>
              <button
                class="version-btn"
                disabled={currentVersionIndex === versionCount - 1}
                onclick={() => switchVersion(1)}
                aria-label="Следующая версия"
              >
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Content -->
      {#if isEditing}
        <div class="edit-mode">
          <textarea
            class="edit-textarea"
            bind:value={editText}
            rows="4"
          ></textarea>
          <div class="edit-actions">
            <button class="edit-btn cancel" onclick={cancelEdit}>
              <i class="fas fa-times"></i>
              <span>Отмена</span>
            </button>
            <button class="edit-btn save" onclick={saveEdit}>
              <i class="fas fa-check"></i>
              <span>Сохранить</span>
            </button>
          </div>
        </div>
      {:else}
        <div class="message-content">
          {@html renderedContent}
        </div>
      {/if}

      <!-- Actions -->
      {#if !isEditing}
        <div class="message-actions" class:visible={showActions}>
          <button class="action-btn" title="Перегенерировать" onclick={handleReroll}>
            <i class="fas fa-dice"></i>
          </button>
          <button class="action-btn" title="Редактировать" onclick={startEdit}>
            <i class="fas fa-pen"></i>
          </button>
          <button class="action-btn danger" title="Удалить" onclick={handleDelete}>
            <i class="fas fa-trash"></i>
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .message-bubble {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--bg-surface-2);
    border: 1px solid var(--border-subtle);
    transition: all 0.2s ease;
    width: fit-content;
    max-width: 85%;
  overflow: hidden;
  }

  .message-bubble.is-user {
    flex-direction: row-reverse;
    background: linear-gradient(135deg, var(--bg-surface-3), var(--bg-surface-2));
    border-color: var(--border-color);
    /* Прижимаем пользователя вправо */
    align-self: flex-end;
  }

  .message-bubble.is-bot {
    /* Прижимаем бота влево */
    align-self: flex-start;
  }

  /* Переопределение для режима Full (На всю ширину) */
  .message-bubble.is-full-avatar {
    flex-direction: column;
    gap: 0;
    width: 100%;
    /* Для больших обложек можно сделать карточку чуть шире, но не на весь экран */
    max-width: 420px;
  }
  .message-bubble.is-full-avatar .message-body {
    align-items: stretch;
  }

  .message-bubble:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-color);
  }

  .message-bubble.is-user:hover {
    border-color: var(--border-hover);
  }

  /* Avatar */
  .message-avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
  }

  .avatar-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .message-avatar img, .avatar-container img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-color);
    transition: border-color 0.2s ease;
  }

  .message-bubble:hover .message-avatar img,
  .message-bubble:hover .avatar-container img {
    border-color: var(--txt-gold);
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface-4);
    border-radius: 50%;
    border: 2px solid var(--border-color);
    color: var(--txt-muted);
    font-size: var(--font-size-sm);
  }

  /* Body */
  .message-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .is-user .message-body {
    align-items: flex-end;
  }

  /* Header */
  .message-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .is-user .message-header {
    flex-direction: row-reverse;
  }

  .sender-name {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--txt-primary);
  }

  .is-user .sender-name {
    color: var(--txt-gold);
  }

  /* Version Badge */
  .version-badge {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 4px;
    background: var(--bg-surface-4);
    border-radius: var(--radius-full);
  }

  .version-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--txt-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
  }

  .version-btn:hover:not(:disabled) {
    background: var(--bg-surface-5);
    color: var(--txt-gold);
  }

  .version-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .version-text {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    min-width: 32px;
    text-align: center;
  }

  /* Content */
  .message-content {
    font-size: var(--font-size-sm);
    line-height: var(--leading-relaxed);
    color: var(--txt-secondary);
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .is-user .message-content {
    text-align: right;
  }

  .message-bubble.is-full-avatar .message-content {
    text-align: left;
  }

  .message-content :global(p) {
    margin: 0 0 var(--space-2);
  }

  .message-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .message-content :global(strong) {
    color: var(--txt-primary);
    font-weight: 600;
  }

  .message-content :global(em) {
    color: var(--txt-secondary);
    font-style: italic;
  }

  .message-content :global(.dialogue-line) {
    display: block;
    padding-left: var(--space-3);
    border-left: 2px solid var(--txt-gold);
    margin: var(--space-2) 0;
    color: var(--txt-primary);
  }

  .is-user .message-content :global(.dialogue-line) {
    padding-left: 0;
    padding-right: var(--space-3);
    border-left: none;
    border-right: 2px solid var(--txt-gold);
    text-align: right;
  }

  .message-bubble.is-full-avatar.is-user .message-content :global(.dialogue-line) {
    padding-left: var(--space-3);
    padding-right: 0;
    border-right: none;
    border-left: 2px solid var(--txt-gold);
    text-align: left;
  }

  .message-content :global(.think-block) {
    background: var(--bg-surface-4);
    border-left: 3px solid var(--state-info);
    padding: var(--space-2) var(--space-3);
    margin: var(--space-2) 0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-style: italic;
    color: var(--txt-muted);
    font-size: var(--font-size-xs);
  }

  /* Actions */
  .message-actions {
    display: flex;
    gap: var(--space-1);
    opacity: 0;
    transform: translateY(-4px);
    transition: all 0.2s ease;
  }

  .message-actions.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .is-user .message-actions {
    justify-content: flex-end;
  }

  .message-bubble.is-full-avatar .message-actions {
    justify-content: flex-end;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--bg-surface-4);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--txt-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--bg-surface-5);
    border-color: var(--border-color);
    color: var(--txt-gold);
  }

  .action-btn.danger:hover {
    background: var(--state-error-bg);
    border-color: var(--state-error-border);
    color: var(--state-error);
  }

  /* Edit Mode */
  .edit-mode {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .edit-textarea {
    width: 100%;
    padding: var(--space-2);
    background: var(--bg-surface-4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    line-height: var(--leading-normal);
    resize: vertical;
    min-height: 80px;
  }

  .edit-textarea:focus {
    outline: none;
    border-color: var(--txt-gold);
    box-shadow: var(--input-focus-shadow);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .edit-btn.cancel {
    background: var(--bg-surface-4);
    border: 1px solid var(--border-color);
    color: var(--txt-muted);
  }

  .edit-btn.cancel:hover {
    background: var(--state-error-bg);
    border-color: var(--state-error-border);
    color: var(--state-error);
  }

  .edit-btn.save {
    background: var(--grad-burgundy);
    border: none;
    color: var(--txt-on-accent);
  }

  .edit-btn.save:hover {
    filter: brightness(1.1);
    box-shadow: var(--fx-glow-gold);
  }

  /* Mobile */
  @media (max-width: 640px) {
    .message-bubble {
      max-width: 95%; /* На мобильных можно занимать почти всю ширину */
      padding: var(--space-2);
      gap: var(--space-2);
    }

    .message-avatar {
      width: 32px;
      height: 32px;
    }

    .message-actions {
      opacity: 1;
      transform: translateY(0);
    }

    .sender-name {
      font-size: var(--font-size-xs);
    }

    .message-content {
      font-size: var(--font-size-xs);
    }
  }
</style>