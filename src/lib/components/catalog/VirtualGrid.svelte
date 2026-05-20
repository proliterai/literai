<!-- ================================================================================
ФАЙЛ: src/lib/components/catalog/VirtualGrid.svelte
Описание: Виртуальный скроллинг для каталога с тысячами карточек
Использование: Заменяет обычный {#each} при большом количестве элементов
================================================================================ -->
<script lang="ts">
import type { CatalogItemRow } from '$lib/db/types';
import CatalogCard from './CatalogCard.svelte';

type Props = {
    items: CatalogItemRow[];
    selectedId?: string | null;
    hasAvatar?: boolean;
    onselect?: (item: CatalogItemRow) => void;
    oninfo?: (item: CatalogItemRow) => void;
    ondel?: (item: CatalogItemRow) => void;
    itemHeight?: number;
    columns?: number;
    gap?: number;
};

let {
    items = [],
    selectedId = null,
    hasAvatar = false,
    onselect,
    oninfo,
    ondel,
    itemHeight = 220,
    columns = 4,
    gap = 16
}: Props = $props();

let container = $state<HTMLDivElement | null>(null);
let scrollTop = $state(0);
let containerHeight = $state(600);

// Вычисляем сколько элементов помещается в видимой области
let visibleCount = $derived(Math.ceil(containerHeight / itemHeight) * columns + 10);
let startIndex = $derived(Math.floor(scrollTop / itemHeight) * columns);
let endIndex = $derived(Math.min(startIndex + visibleCount, items.length));
let visibleItems = $derived(items.slice(startIndex, endIndex));

// Общая высота контента
let totalHeight = $derived(Math.ceil(items.length / columns) * itemHeight);

// Смещение для видимых элементов
let offsetY = $derived(Math.floor(startIndex / columns) * itemHeight);

function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLDivElement;
    scrollTop = target.scrollTop;
    containerHeight = target.clientHeight;
}

// Обновляем размеры при изменении контейнера
$effect(() => {
    if (container) {
        containerHeight = container.clientHeight;
    }
});
</script>

<div 
    class="virtual-grid-container" 
    bind:this={container}
    onscroll={handleScroll}
    style="height: 100%; overflow-y: auto; position: relative;"
>
    <div 
        class="virtual-grid-spacer" 
        style="height: {totalHeight}px; position: relative;"
    >
        <div 
            class="virtual-grid-content"
            style="position: absolute; top: {offsetY}px; left: 0; right: 0; display: grid; grid-template-columns: repeat({columns}, 1fr); gap: {gap}px; padding: {gap}px;"
        >
            {#each visibleItems as item (item.id)}
                <CatalogCard
                    item={item}
                    selected={selectedId === item.id}
                    hasAvatar={hasAvatar}
                    onselect={() => onselect?.(item)}
                    oninfo={() => oninfo?.(item)}
                    ondel={() => ondel?.(item)}
                />
            {/each}
        </div>
    </div>
</div>

<style>
    .virtual-grid-container {
        contain: strict;
        will-change: scroll-position;
    }
    
    .virtual-grid-spacer {
        width: 100%;
    }
    
    .virtual-grid-content {
        width: 100%;
        will-change: transform;
    }
</style>