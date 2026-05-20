<script lang="ts">
  import { onDestroy } from 'svelte';

  type Props = {
    placeholder?: string;
    debounceMs?: number;
    countText?: string;
    value?: string;
    onSearch?: (q: string) => void;
    onClear?: () => void;
  };

  let {
    placeholder = 'Поиск...',
    debounceMs = 200,
    countText = '',
    value = $bindable(''),
    onSearch,
    onClear
  }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(v: string) {
    value = v;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onSearch?.(value), debounceMs);
  }

  function clear() {
    value = '';
    if (timer) clearTimeout(timer);
    timer = null;
    onClear?.();
  }

  onDestroy(() => { if (timer) clearTimeout(timer); });
</script>

<div class="catalog-controls">
  <div class="search-wrap">
    <i class="fas fa-search search-icon"></i>
    <input
      class="search-input"
      type="text"
      bind:value
      {placeholder}
      oninput={(e) => handleInput(e.currentTarget.value)}
    />
    {#if value}
      <button class="search-clear" type="button" onclick={clear}>
        <i class="fas fa-times"></i>
      </button>
    {/if}
  </div>
  {#if countText}
    <div class="results-count">{countText}</div>
  {/if}
</div>