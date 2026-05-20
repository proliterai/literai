<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { ui } from '$lib/ui/ui.store';
  import type { SessionRow } from '$lib/db/types';

  let loading = $state(true);
  let sessions = $state<SessionRow[]>([]);
  let searchQuery = $state('');

  let filteredSessions = $derived(
    sessions.filter(s => 
      (s.title || 'Без названия').toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
  );

  async function load() {
    loading = true;
    try {
      const all = await sessionsRepo.getRecent(500);
      sessions = all.filter(s => s.mode === 'search');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function openSearch(session: SessionRow) {
    ui.closeAll();
    await goto(`/search/${session.id}`);
  }

  async function deleteSession(session: SessionRow) {
    const isConfirmed = await ui.confirm('Удаление', `Удалить запрос "${session.title || 'Без названия'}"?`);
    if (!isConfirmed) return;
    
    await sessionsRepo.remove(session.id);
    ui.notify('Запрос удалён', 'success');
    await load();
  }
</script>

<div class="panel-section my-chats-panel">
  <h4 class="panel-title"><i class="fas fa-history"></i> Мои запросы</h4>

  {#if !loading && sessions.length > 0}
    <div class="search-wrap" style="margin-bottom: var(--space-4);">
      <i class="fas fa-search search-icon"></i>
      <input 
        type="text" 
        class="search-input" 
        placeholder="Фильтр по истории..." 
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => searchQuery = ''}>
          <i class="fas fa-times"></i>
        </button>
      {/if}
    </div>
  {/if}

  <div class="chats-list">
    {#if loading}
      <p class="panel-placeholder">Загрузка...</p>
    {:else if sessions.length === 0}
      <p class="panel-placeholder">История поисков пуста.</p>
    {:else if filteredSessions.length === 0}
      <p class="panel-placeholder">По вашему фильтру ничего не найдено.</p>
    {:else}
      {#each filteredSessions as s (s.id)}
        <div class="chat-item">
          <div class="chat-item-info">
            <span class="chat-item-title">
              <i class="fas fa-search"></i>
              {s.title || 'Без названия'}
            </span>
            <span class="chat-item-date">
              {new Date(s.updatedAt).toLocaleDateString('ru-RU', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <div class="chat-item-actions">
            <button class="btn-icon" type="button" title="Открыть" onclick={() => openSearch(s)}>
              <i class="fas fa-external-link-alt"></i>
            </button>
            <button class="btn-icon danger-hover" type="button" title="Удалить" onclick={() => deleteSession(s)}>
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      {/each}

      <button class="btn-secondary" type="button" style="width:100%; margin-top:8px" onclick={load}>
        <i class="fas fa-sync-alt"></i> Обновить список
      </button>
    {/if}
  </div>
</div>

<style>
  .chat-item-title i {
    margin-right: 0.5rem;
    color: var(--txt-gold);
    width: 1.2rem;
    text-align: center;
  }
  
  .danger-hover:hover {
    color: var(--state-error);
    background: var(--state-error-bg);
  }
</style>