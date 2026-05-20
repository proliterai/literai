<!-- ================================================================================
ФАЙЛ: src/lib/components/team-chat/TeamManualControls.svelte
================================================================================ -->
<script lang="ts">
  import type { CatalogItemRow } from '$lib/db/types';
  import { ui } from '$lib/ui/ui.store';
  import { autoplayStore } from '$lib/domain/autoplay/autoplay.store';

  // Путь к плейсхолдеру
  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  interface Props {
    characters: CatalogItemRow[];
    isGenerating: boolean;
    onNarratorClick: () => void;
    onCharacterClick: (characterId: string) => void;
  }

  let { characters, isGenerating, onNarratorClick, onCharacterClick }: Props = $props();

  function getAvatar(char: CatalogItemRow): string {
    return char.avatar || AVATAR_PLACEHOLDER;
  }
</script>

<div class="manual-controls-panel">
  <div class="manual-controls-header">Кто ходит следующим?</div>

  <div class="manual-buttons-grid">
    <!-- Кнопка Командной Автоигры -->
    <button
      class="manual-turn-btn autoplay-turn-btn {$autoplayStore.isRunning ? 'active' : ''}"
      onclick={() => ui.openModal('team-autoplay')}
    >
      <div class="manual-btn-icon" style={$autoplayStore.isRunning ? 'background: var(--state-success)' : ''}>
        <i class="fas fa-play"></i>
      </div>
      <div class="manual-btn-name">Автоигра</div>
    </button>

    <!-- Кнопка рассказчика -->
    <button
      class="manual-turn-btn narrator-turn-btn"
      onclick={onNarratorClick}
      disabled={isGenerating}
    >
      <div class="manual-btn-icon">
        <i class="fas fa-book"></i>
      </div>
      <div class="manual-btn-name">Рассказчик</div>
    </button>

    <!-- Кнопки персонажей -->
    {#each characters as char (char.id)}
      <button
        class="manual-turn-btn char-turn-btn"
        onclick={() => onCharacterClick(char.id)}
        disabled={isGenerating}
      >
        <div class="manual-btn-avatar">
          <img
            src={getAvatar(char)}
            alt={char.name}
            onerror={(e) => { (e.target as HTMLImageElement).src = AVATAR_PLACEHOLDER; }}
          />
        </div>
        <div class="manual-btn-name">{char.name}</div>
      </button>
    {/each}
  </div>
</div>

<style>
  .manual-controls-panel {
    padding: var(--space-3) var(--space-4);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .manual-controls-header {
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
    margin-bottom: var(--space-3);
  }

  .manual-buttons-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }

  .manual-turn-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
    min-width: 80px;
  }

  .manual-turn-btn:hover:not(:disabled) {
    border-color: var(--accent-primary);
    background: var(--bg-hover);
  }

  .manual-turn-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Стили кнопки Автоигры */
  .autoplay-turn-btn {
    border-color: var(--state-success);
  }

  .autoplay-turn-btn .manual-btn-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--state-success), #27ae60);
    border-radius: 50%;
    color: white;
    font-size: 1.2rem;
    transition: all 0.3s ease;
  }

  .autoplay-turn-btn.active {
    background: var(--state-success-bg);
    box-shadow: 0 0 10px var(--state-success);
  }

  /* Стили кнопки Рассказчика */
  .narrator-turn-btn {
    border-color: var(--txt-gold);
  }

  .narrator-turn-btn .manual-btn-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--txt-gold), #b8860b);
    border-radius: 50%;
    color: white;
    font-size: 1.2rem;
  }

  /* Стили кнопок персонажей */
  .manual-btn-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--border-color);
  }

  .manual-btn-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .manual-btn-name {
    margin-top: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--txt-primary);
    text-align: center;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>