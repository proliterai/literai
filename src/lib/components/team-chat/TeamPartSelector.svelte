<script lang="ts">
  import type { ChatPart } from '$lib/domain/chat/chat.types';

  interface Props {
    parts: ChatPart[];
    currentIndex: number;
    onSwitch: (index: number) => void;
    onDelete: (index: number) => void;
  }

  let { parts, currentIndex, onSwitch, onDelete }: Props = $props();
</script>

<div class="part-selector">
  {#each parts as part, index (part.id)}
    <div class="part-btn-wrapper">
      <button
        class="part-btn {index === currentIndex ? 'active' : ''}"
        onclick={() => onSwitch(index)}
      >
        {part.name}
      </button>

      {#if index === currentIndex && parts.length > 1}
        <button
          class="delete-part-btn"
          onclick={(e) => { e.stopPropagation(); onDelete(index); }}
          title="Удалить часть"
        >
          <i class="fas fa-trash"></i>
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .part-selector {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
  }

  .part-btn-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .part-btn {
    padding: var(--space-2) var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--txt-primary);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .part-btn:hover {
    background: var(--bg-hover);
  }

  .part-btn.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
  }

  .delete-part-btn {
    position: absolute;
    right: -8px;
    top: -8px;
    width: 20px;
    height: 20px;
    padding: 0;
    background: var(--state-error);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>