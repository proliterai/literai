<script lang="ts">
  let {
    allTags = [],
    selectedTags = [],
    sortByDate = false,
    onlyCustom = false,
    hasCustom = false,
    onAll,
    onNew,
    onCustom,
    onToggleTag
  }: {
    allTags?: string[];
    selectedTags?: string[];
    sortByDate?: boolean;
    onlyCustom?: boolean;
    hasCustom?: boolean;
    onAll?: () => void;
    onNew?: () => void;
    onCustom?: () => void;
    onToggleTag?: (tag: string) => void;
  } = $props();

  let isAllActive = $derived(selectedTags.length === 0 && !sortByDate && !onlyCustom);
</script>

<div class="tags-panel">
  <div class="tags-scroll">
    <button class="tag-btn tag-all {isAllActive ? 'active' : ''}" type="button" onclick={onAll}>Все</button>
    <button class="tag-btn tag-new {sortByDate ? 'active' : ''}" type="button" onclick={onNew}>🔥 Новые</button>

    {#if hasCustom}
      <button class="tag-btn tag-custom {onlyCustom ? 'active' : ''}" type="button" onclick={onCustom}>⭐ Мои</button>
    {/if}

    {#each allTags as tag (tag)}
      <button class="tag-btn {selectedTags.includes(tag) ? 'active' : ''}" type="button" onclick={() => onToggleTag?.(tag)}>
        {tag}
      </button>
    {/each}
  </div>
</div>