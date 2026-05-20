<script lang="ts">
  import type { CatalogItemRow } from '$lib/db/types';
  import { lazyImage } from '$lib/ui/lazyImage';
  import { safeUrl } from '$lib/utils/url';

  type Props = {
    item: CatalogItemRow;
    selected?: boolean;
    onselect?: (item: CatalogItemRow) => void;
    oninfo?: (item: CatalogItemRow) => void;
    ondel?: (item: CatalogItemRow) => void;
  };

  let {
    item,
    selected = false,
    onselect,
    oninfo,
    ondel
  }: Props = $props();

  let isCustom = $derived(item.meta?.author === 'user');

  // Используем общую утилиту
  let avatar = $derived(safeUrl(item.avatar));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
  class="team-character-card {selected ? 'selected' : ''}"
  onclick={() => onselect?.(item)}
>
  <!-- Чекбокс/галочка для множественного выбора -->
  <div class="card-checkbox">
    {#if selected}
      <i class="fas fa-check-circle"></i>
    {:else}
      <i class="far fa-circle"></i>
    {/if}
  </div>

  <button
    class="card-info-btn"
    type="button"
    title="Подробнее"
    onclick={(e) => { e.stopPropagation(); oninfo?.(item); }}
  >
    <i class="fas fa-info"></i>
  </button>

  <!-- Аватар -->
  {#if avatar}
    <img 
      class="card-avatar" 
      src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
      alt={item.name} 
      use:lazyImage={{ src: avatar }} 
    />
  {:else}
    <div class="card-avatar-placeholder"><i class="fas fa-user"></i></div>
  {/if}

  <div class="card-name">{item.name}</div>

  {#if item.tags?.length}
    <div class="card-tags">
      {#each item.tags as t (t)}
        <span class="card-tag">{t}</span>
      {/each}
    </div>
  {/if}

  {#if isCustom}
    <button
      class="card-delete-btn"
      type="button"
      title="Удалить"
      onclick={(e) => { e.stopPropagation(); ondel?.(item); }}
    >
      <i class="fas fa-times"></i>
    </button>
  {/if}
</article>

<style>
  .team-character-card {
    position: relative;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 180px;
  }

  .team-character-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-md);
  }

  .team-character-card.selected {
    border-color: var(--p-gold-700);
    background: linear-gradient(
      165deg,
      var(--card-selected-bg-from) 0%,
      var(--card-selected-bg-to) 100%
    );
    box-shadow:
      var(--shadow-md),
      0 0 24px var(--card-selected-glow),
      inset 0 0 20px var(--card-selected-inner);
  }

  /* Чекбокс в левом верхнем углу */
  .card-checkbox {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    color: var(--accent-primary);
    font-size: 1.2rem;
  }

  .card-checkbox i {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  /* Info button */
  .card-info-btn {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: var(--size-8);
    height: var(--size-8);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-info-bg);
    backdrop-filter: blur(var(--card-info-blur));
    -webkit-backdrop-filter: blur(var(--card-info-blur));
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    color: var(--txt-muted);
    font-size: var(--text-xs);
    z-index: 4;
    transition: all var(--transition-fast);
    opacity: 0;
    cursor: pointer;
  }

  /* появление при наведении на карточку */
  .team-character-card:hover .card-info-btn,
  .team-character-card:focus-within .card-info-btn {
    opacity: 1;
  }

  .card-info-btn:hover {
    color: var(--accent-primary);
    background: var(--bg-surface-4);
    border-color: var(--glass-border-hover);
  }

  .card-avatar,
  .card-avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin: var(--space-2) auto 0;
    border: 2px solid var(--glass-border);
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--txt-muted);
    font-size: 2rem;
  }

  .card-name {
    font-weight: 600;
    text-align: center;
    font-size: var(--font-size-md);
    color: var(--txt-primary);
    margin-top: var(--space-1);
    word-break: break-word;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    justify-content: center;
    margin-top: auto;
  }

  .card-tag {
    background: var(--bg-tertiary);
    color: var(--txt-muted);
    font-size: var(--font-size-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid var(--glass-border);
  }

  .card-delete-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--state-error);
    font-size: 0.9rem;
    padding: var(--space-1);
    cursor: pointer;
    border-radius: var(--radius-sm);
    z-index: 2;
    opacity: 0.7;
    transition: all 0.2s;
  }

  .card-delete-btn:hover {
    opacity: 1;
    background: var(--state-error-bg);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .card-grid,
    .catalog-results {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: var(--space-3);
    }

    .card-info-btn,
    .card-delete-btn {
      opacity: 1;
    }

    .card-avatar {
      width: var(--size-24);
      height: var(--size-24);
    }
  }

  @media (max-width: 480px) {
    .card-grid,
    .catalog-results {
      grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
      gap: var(--space-2);
    }

    .card-avatar {
      width: var(--size-18);
      height: var(--size-18);
    }

    .card-text-only {
      min-height: var(--size-20);
      padding: var(--space-3) var(--space-2);
    }

    .catalog-card {
      padding: var(--space-3);
      border-radius: var(--radius-md);
    }
  }

  /* Lazy loading shimmer */
  .lazy-img {
    background: linear-gradient(
      110deg,
      var(--bg-surface-3) 25%,
      var(--bg-surface-4) 37%,
      var(--bg-surface-3) 63%
    );
    background-size: 300% 100%;
    animation: shimmer 2s infinite ease-in-out;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>