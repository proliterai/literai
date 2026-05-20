<!-- ================================================================================
ФАЙЛ: src/lib/components/team-chat/TeamMessageBubble.svelte
================================================================================ -->
<script lang="ts">
  import type { ChatMessage } from '$lib/domain/chat/chat.types';
  import { settingsStore } from '$lib/domain/settings/settings.store';
  import { ui } from '$lib/ui/ui.store';
  import { renderMarkdown } from '$lib/utils/markdown';

  // Путь к плейсхолдеру
  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  interface Props {
    message: ChatMessage;
    onReroll: () => void;
    onEdit: (text: string) => void;
    onDelete: () => void;
    onSwitchVersion: (dir: -1 | 1) => void;
  }

  let { message, onReroll, onEdit, onDelete, onSwitchVersion }: Props = $props();

  let isEditing = $state(false);
  let editText = $state('');

  // Подписка на настройки стиля аватарок
  let avatarStyle = $derived($settingsStore.values.avatar_style || 'small');

  let content = $derived(
    message.versions?.length
      ? message.versions[message.activeVersion ?? 0]?.content ?? message.content
      : message.content
  );

  let hasMultipleVersions = $derived((message.versions?.length ?? 0) > 1);
  let versionInfo = $derived(
    hasMultipleVersions
      ? `${(message.activeVersion ?? 0) + 1}/${message.versions!.length}`
      : ''
  );

  let isNarrator = $derived(message.role === 'assistant');
  let characterName = $derived((message as any).characterName || 'Персонаж');
  let characterAvatar = $derived((message as any).characterAvatar || AVATAR_PLACEHOLDER);

  function startEdit() {
    editText = content;
    isEditing = true;
  }

  function saveEdit() {
    if (editText.trim()) {
      onEdit(editText.trim());
    }
    isEditing = false;
  }

  function cancelEdit() {
    isEditing = false;
  }
</script>

<div class="message-bubble {isNarrator ? 'narrator' : 'character'}">
  <!-- Заголовок -->
  {#if avatarStyle === 'full' && !isNarrator && characterAvatar && characterAvatar !== AVATAR_PLACEHOLDER}
    <!-- Режим НА ВСЮ ШИРИНУ -->
    <div class="msg-hero-team">
      <img class="msg-hero-img" src={characterAvatar} alt={characterName} />
      <div class="msg-hero-gradient"></div>
      <button class="hero-zoom-btn" onclick={() => ui.openLightbox(characterAvatar)} title="Открыть полное фото">
        <i class="fas fa-search-plus"></i>
      </button>
      <div class="msg-hero-header">
        <span class="message-name" style="color:white;">{characterName}</span>
        {#if hasMultipleVersions}
          <div class="version-nav">
            <button onclick={() => onSwitchVersion(-1)} disabled={message.activeVersion === 0}>&lt;</button>
            <span style="color:white;">{versionInfo}</span>
            <button onclick={() => onSwitchVersion(1)} disabled={message.activeVersion === (message.versions?.length ?? 1) - 1}>&gt;</button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Режим МАЛЕНЬКАЯ или КРУПНАЯ -->
    <div class="message-header avatar-style-{avatarStyle}">
      {#if isNarrator}
        <i class="fas fa-book narrator-icon"></i>
        <span class="message-name">Рассказчик</span>
      {:else}
        <div class="avatar-container">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <img
            class="message-avatar"
            src={characterAvatar}
            alt={characterName}
            style:cursor={avatarStyle === 'small' && characterAvatar !== AVATAR_PLACEHOLDER ? 'zoom-in' : 'default'}
            onclick={() => (avatarStyle === 'small' && characterAvatar !== AVATAR_PLACEHOLDER) ? ui.openLightbox(characterAvatar) : null}
            onerror={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_PLACEHOLDER; }}
          />
          {#if avatarStyle === 'large' && characterAvatar !== AVATAR_PLACEHOLDER}
            <button class="large-zoom-btn" onclick={() => ui.openLightbox(characterAvatar)} title="Открыть полное фото">
              <i class="fas fa-search-plus"></i>
            </button>
          {/if}
        </div>
        <span class="message-name">{characterName}</span>
      {/if}

      {#if hasMultipleVersions}
        <div class="version-nav">
          <button onclick={() => onSwitchVersion(-1)} disabled={message.activeVersion === 0}>&lt;</button>
          <span>{versionInfo}</span>
          <button onclick={() => onSwitchVersion(1)} disabled={message.activeVersion === (message.versions?.length ?? 1) - 1}>&gt;</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Контент -->
  {#if isEditing}
    <div class="edit-container">
      <textarea bind:value={editText} rows="4"></textarea>
      <div class="edit-actions">
        <button class="btn-cancel" onclick={cancelEdit}>Отмена</button>
        <button class="btn-save" onclick={saveEdit}>Сохранить</button>
      </div>
    </div>
  {:else}
    <div class="message-content">
      {@html renderMarkdown(content)}
    </div>
  {/if}

  <!-- Действия -->
  {#if !isEditing}
    <div class="message-actions">
      <button class="branch-btn" onclick={onReroll} title="Перегенерировать">
        <i class="fas fa-dice"></i>
        <span class="msg-action-label">Реролл</span>
      </button>
      <button class="edit-btn" onclick={startEdit} title="Редактировать">
        <i class="fas fa-pen"></i>
        <span class="msg-action-label">Редактировать</span>
      </button>
      <button class="delete-msg-btn" onclick={onDelete} title="Удалить">
        <i class="fas fa-trash"></i>
        <span class="msg-action-label">Удалить</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .message-bubble {
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
  overflow: hidden;
  }

  .message-bubble.narrator {
    border-left: 3px solid var(--txt-gold);
  }

  .message-bubble.character {
    border-left: 3px solid var(--accent-primary);
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .narrator-icon {
    color: var(--txt-gold);
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .message-name {
    font-weight: 600;
    color: var(--txt-primary);
  }

  .version-nav {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
  }

  .version-nav button {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .version-nav button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message-content {
    color: var(--txt-primary);
    line-height: 1.6;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

.message-content :global(pre),
  .message-content :global(table) {
    max-width: 100%;
    overflow-x: auto;
  }

  .message-content :global(p) {
    margin: 0 0 var(--space-2);
  }

  .message-content :global(.think-block) {
    background: var(--bg-tertiary);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    font-style: italic;
    opacity: 0.8;
    margin: var(--space-2) 0;
  }

  .message-content :global(.dialogue) {
    display: block;
    padding-left: var(--space-2);
    border-left: 2px solid var(--accent-primary);
    margin: var(--space-1) 0;
  }

  .message-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-color);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .message-bubble:hover .message-actions {
    opacity: 1;
  }

  .edit-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .edit-container textarea {
    width: 100%;
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--txt-primary);
    resize: vertical;
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .btn-cancel,
  .btn-save {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .btn-cancel {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--txt-muted);
  }

  .btn-save {
    background: var(--accent-primary);
    border: none;
    color: white;
  }

  /* ============================
     Responsive
     ============================ */
  @media (max-width: 768px) {
    .message-actions {
      opacity: 1;
    }
  }
</style>