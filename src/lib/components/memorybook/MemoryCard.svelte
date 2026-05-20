<script lang="ts">
  import type { MemoryBlock } from '$lib/domain/memorybook/memorybook.types';
  import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';

  let { block }: { block: MemoryBlock } = $props();

  let isEditing = $state(false);
  let editTitle = $state(block.title);
  let editContent = $state(block.content);

  const icons: Record<string, string> = {
    characters: '🧍', locations: '🌍', quests: '⚔️', inventory: '🎒',
    relationships: '🤝', lore: '📜', timeline: '⏳', hooks: '⚠️'
  };

  const catNames: Record<string, string> = {
    characters: 'Персонаж', locations: 'Локация', quests: 'Квест/Сюжет', inventory: 'Инвентарь',
    relationships: 'Отношения', lore: 'Правило/Лор', timeline: 'Таймлайн', hooks: 'Крючок'
  };

  function save() {
    memoryBookStore.updateBlock(block.id, { title: editTitle, content: editContent });
    isEditing = false;
  }

  function toggleFreeze() {
    memoryBookStore.updateBlock(block.id, { isFrozen: !block.isFrozen });
  }

  function setImportance(val: number) {
    memoryBookStore.updateBlock(block.id, { importance: val });
  }
</script>

<article class="mb-card" data-frozen={block.isFrozen} data-new={block.isNew} data-changed={block.isChanged} data-inactive={!block.isActive}>
  <header class="mb-card__header">
    <div class="mb-card__header-left">
      <span class="mb-card__emoji">{icons[block.category] || '📌'}</span>
      <span class="mb-card__category">{catNames[block.category] || block.category}</span>
      
      {#if isEditing}
        <input class="mb-card__title-input" bind:value={editTitle} />
      {:else}
        <h3 class="mb-card__title" title={block.title}>{block.title}</h3>
      {/if}

      {#if block.isNew}<span class="mb-badge mb-badge--new">Новое</span>{/if}
      {#if block.isChanged}<span class="mb-badge mb-badge--changed">Изменено</span>{/if}
      {#if block.isFrozen}<span class="mb-badge mb-badge--frozen">🔒 Заморожен</span>{/if}
    </div>
    
    <div class="mb-card__header-right">
      {#if isEditing}
        <button class="mb-card__btn" style="color:var(--state-success)" onclick={save}><i class="fas fa-check"></i></button>
      {:else}
        <button class="mb-card__btn" title={block.isFrozen ? "Разморозить" : "Заморозить от ИИ"} onclick={toggleFreeze}>
          <i class="fas {block.isFrozen ? 'fa-lock' : 'fa-unlock'}"></i>
        </button>
        <button class="mb-card__btn" title="Редактировать" onclick={() => isEditing = true}><i class="fas fa-pen"></i></button>
        <button class="mb-card__btn mb-card__btn--danger" title="Удалить" onclick={() => memoryBookStore.deleteBlock(block.id)}><i class="fas fa-trash"></i></button>
      {/if}
    </div>
  </header>

  <div class="mb-card__body {isEditing ? 'editing' : ''}">
    <textarea 
      class="mb-card__textarea" 
      bind:value={editContent} 
      readonly={!isEditing}
      placeholder="Описание..."
    ></textarea>
  </div>

  <footer class="mb-card__footer">
    <div class="mb-card__params">
      <label class="mb-param">
        <span class="mb-param__label">Важность</span>
        <div class="mb-param__stars">
          {#each [1,2,3,4,5] as star}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span class="star {block.importance >= star ? 'active' : ''}" onclick={() => setImportance(star)}>★</span>
          {/each}
        </div>
      </label>

      <label class="mb-param">
        <span class="mb-param__label">Активен</span>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="mb-toggle {block.isActive ? 'active' : ''}" onclick={() => memoryBookStore.updateBlock(block.id, { isActive: !block.isActive })}></div>
      </label>
    </div>
  </footer>
</article>