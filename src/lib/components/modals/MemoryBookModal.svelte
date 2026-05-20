<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import MemoryCard from '$lib/components/memorybook/MemoryCard.svelte';
  
  // Импорт компонента векторизации
  import VectorSettings from '$lib/components/lorebook/VectorSettings.svelte';
  
  let s = $derived($memoryBookStore);
  let activeTab = $state<'ai' | 'user'>('ai');

  // Группируем блоки по категориям
  let groupedBlocks = $derived(s.blocks.reduce((acc, block) => {
    if (!acc[block.category]) acc[block.category] = [];
    acc[block.category].push(block);
    return acc;
  }, {} as Record<string, typeof s.blocks>));

  const categories = [
    { id: 'characters', name: 'Персонажи', icon: '🧍' },
    { id: 'locations', name: 'Мир и Локации', icon: '🌍' },
    { id: 'quests', name: 'Квесты и Сюжет', icon: '⚔️' },
    { id: 'inventory', name: 'Инвентарь', icon: '🎒' },
    { id: 'relationships', name: 'Отношения', icon: '🤝' },
    { id: 'lore', name: 'Правила мира', icon: '📜' },
    { id: 'timeline', name: 'Хронология', icon: '⏳' },
    { id: 'hooks', name: 'Незакрытые крючки', icon: '⚠️' }
  ];

  function addEmptyBlock(category: string) {
    memoryBookStore.addBlock({ category: category as any });
  }
</script>

<div class="modal-panel memory-modal">
  <header class="mb-header">
    <div class="mb-header__left">
      <span class="mb-header__icon">📚</span>
      <h1 class="mb-header__title">Memory Book</h1>
      {#if s.lastUpdated}
        <span class="mb-header__sync">Обновлено: {new Date(s.lastUpdated).toLocaleTimeString()}</span>
      {/if}
    </div>
    <button class="mb-header__close" onclick={() => ui.closeModal()}>✕</button>
  </header>

  <div class="mb-tabs custom-scrollbar">
    <button class="mb-tab {activeTab === 'ai' ? 'active' : ''}" onclick={() => activeTab = 'ai'}>
      <span class="tab-icon">🤖</span> <span class="tab-label">AI Memory</span>
    </button>
    <button class="mb-tab {activeTab === 'user' ? 'active' : ''}" onclick={() => activeTab = 'user'}>
      <span class="tab-icon">📝</span> <span class="tab-label">Мои заметки</span>
    </button>
  </div>

  <div class="tab-content-area custom-scrollbar" style="background: var(--bg-app); padding: var(--space-4);">
    
    <!-- === ПАНЕЛЬ ВЕКТОРНОГО ПОИСКА === -->
    <VectorSettings 
      isVectorizing={s.isVectorizing} 
      progress={s.vectorizeProgress} 
      disabled={s.blocks.length === 0} 
      onVectorize={() => memoryBookStore.vectorizeAll()} 
    />
    
    {#if activeTab === 'ai'}
      {#each categories as cat}
        <div class="mb-section">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="mb-section__header" onclick={(e) => e.currentTarget.parentElement?.classList.toggle('collapsed')}>
            <div class="mb-section__title">
              {cat.icon} {cat.name}
              <span class="mb-section__count">{(groupedBlocks[cat.id] || []).length}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="mb-section__add" onclick={(e) => { e.stopPropagation(); addEmptyBlock(cat.id); }}>+ Добавить</button>
              <i class="fas fa-chevron-down mb-section__chevron"></i>
            </div>
          </div>
          
          <div class="mb-section__body">
            {#if groupedBlocks[cat.id] && groupedBlocks[cat.id].length > 0}
              {#each groupedBlocks[cat.id] as block (block.id)}
                <MemoryCard {block} />
              {/each}
            {:else}
              <div class="mb-empty">
                <div class="mb-empty__icon">{cat.icon}</div>
                <p>Нет записей в этой категории</p>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}

    {#if activeTab === 'user'}
      <div style="margin-bottom: 16px;">
        <button class="btn-secondary" onclick={() => memoryBookStore.addUserNote()}>
          <i class="fas fa-plus"></i> Новая заметка
        </button>
        <p class="setting-hint" style="margin-top: 8px;">Эти заметки ИИ никогда не перезаписывает. Используйте для жестких правил ("Персонаж никогда не лжет").</p>
      </div>

      {#each s.userNotes as note (note.id)}
        <div class="mb-card" style="margin-bottom: 12px; padding: 12px;">
          <div style="display:flex; gap: 12px; margin-bottom: 8px;">
            <input class="panel-input" bind:value={note.label} placeholder="Ярлык (например: Правило)" onchange={() => memoryBookStore.updateUserNote(note.id, {label: note.label})} />
            <button class="btn-icon danger" onclick={() => memoryBookStore.deleteUserNote(note.id)}><i class="fas fa-trash"></i></button>
          </div>
          <textarea class="panel-textarea" bind:value={note.text} rows="3" placeholder="Текст заметки..." onchange={() => memoryBookStore.updateUserNote(note.id, {text: note.text})}></textarea>
          <div style="display:flex; gap: 16px; margin-top: 8px; align-items:center;">
             <label class="form-check">
               <input type="checkbox" bind:checked={note.alwaysInContext} onchange={() => memoryBookStore.updateUserNote(note.id, {alwaysInContext: note.alwaysInContext})}> Всегда в контексте
             </label>
          </div>
        </div>
      {/each}
    {/if}

  </div>

  <footer class="mb-footer">
    <button class="btn-update {s.isUpdating ? 'loading' : ''}" onclick={() => memoryBookStore.updateFromAI()} disabled={s.isUpdating}>
      {#if s.isUpdating}
        <span class="btn-spinner"></span> Анализ истории...
      {:else}
        <i class="fas fa-sync-alt"></i> Обновить из чата
      {/if}
    </button>
    
    <div style="display:flex; gap:8px;">
      <button class="btn-secondary" title="Экспорт" onclick={() => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(memoryBookStore.exportData(), null, 2)]));
        a.download = 'memory_book.json';
        a.click();
      }}><i class="fas fa-download"></i> <span class="btn-label">Экспорт</span></button>
    </div>
  </footer>
</div>