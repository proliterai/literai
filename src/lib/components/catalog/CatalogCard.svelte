<script lang="ts">
  import type { CatalogItemRow } from '$lib/db/types';
  import { lazyImage } from '$lib/ui/lazyImage';
  import { safeUrl } from '$lib/utils/url';

  type Props = {
    item: CatalogItemRow;
    selected?: boolean;
    hasAvatar?: boolean;
    onselect?: (item: CatalogItemRow) => void;
    oninfo?: (item: CatalogItemRow) => void;
    ondel?: (item: CatalogItemRow) => void;
  };

  let {
    item,
    selected = false,
    hasAvatar = false,
    onselect,
    oninfo,
    ondel
  }: Props = $props();

  let isCustom = $derived(item.meta?.author === 'user');
  
  // Используем общую утилиту вместо дублирования кода
  let avatar = $derived(safeUrl(item.avatar));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
  class="catalog-card {hasAvatar ? 'card-with-avatar' : 'card-text-only'} {selected ? 'selected' : ''}"
  onclick={() => onselect?.(item)}
>
  <button
    class="card-info-btn"
    type="button"
    title="Подробнее"
    onclick={(e) => { e.stopPropagation(); oninfo?.(item); }}
  >
    <i class="fas fa-info"></i>
  </button>

  {#if hasAvatar && avatar}
    <!-- Прозрачный pixel spacer в src, реальная картинка грузится через lazyImage -->
    <img 
      class="card-avatar" 
      src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
      alt={item.name} 
      use:lazyImage={{ src: avatar }} 
    />
  {:else if hasAvatar}
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