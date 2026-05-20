<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { ui } from '$lib/ui/ui.store';
  import type { SessionRow } from '$lib/db/types';

  let loading = $state(true);
  let sessions = $state<SessionRow[]>([]);
  
  // Состояние для поиска
  let searchQuery = $state('');

  // Реактивная переменная, которая фильтрует чаты
  let filteredSessions = $derived(
    sessions.filter(s => 
      (s.title || 'Без названия').toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
  );

 async function load() {
    loading = true;
    try {
      const all = await sessionsRepo.getRecent(500);
      // Исключаем поисковые сессии из "Моих чатов"
      sessions = all.filter(s => s.mode !== 'search');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function getIconForMode(mode: SessionRow['mode']): string {
    switch (mode) {
      case 'hero': return 'fa-gamepad';
      case 'roleplay': return 'fa-comments';
      case 'team': return 'fa-people-roof';
      default: return 'fa-comment';
    }
  }

  function getRouteForSession(session: SessionRow): string {
    const mode = session.mode || 'roleplay'; // для обратной совместимости
    return `/${mode}/chat/${session.id}`;
  }

  async function openChat(session: SessionRow) {
    ui.closeAll();
    await goto(getRouteForSession(session));
  }

  async function deleteSession(session: SessionRow) {
    if (!confirm(`Удалить чат "${session.title || 'Без названия'}"?`)) return;
    await sessionsRepo.remove(session.id);
    ui.notify('Чат удалён', 'success');
    await load();
  }
</script>

<div class="panel-section my-chats-panel">
  <h4 class="panel-title"><i class="fas fa-comments"></i> Мои чаты</h4>

  <!-- Блок поиска -->
  {#if !loading && sessions.length > 0}
    <div class="search-wrap" style="margin-bottom: var(--space-4);">
      <i class="fas fa-search search-icon"></i>
      <input 
        type="text" 
        class="search-input" 
        placeholder="Поиск чатов..." 
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
      <p class="panel-placeholder">Нет сохранённых чатов.</p>
    {:else if filteredSessions.length === 0}
      <p class="panel-placeholder">По вашему запросу ничего не найдено.</p>
    {:else}
      {#each filteredSessions as s (s.id)}
        <div class="chat-item">
          <div class="chat-item-info">
            <span class="chat-item-title">
              <i class="fas {getIconForMode(s.mode || 'roleplay')}"></i>
              {s.title || 'Без названия'}
            </span>
            <span class="chat-item-date">
              {new Date(s.updatedAt).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div class="chat-item-actions">
            <button
              class="btn-icon"
              type="button"
              title="Открыть"
              onclick={() => openChat(s)}
            >
              <i class="fas fa-external-link-alt"></i>
            </button>
            <button
              class="btn-icon danger-hover"
              type="button"
              title="Удалить"
              onclick={() => deleteSession(s)}
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      {/each}

      <button
        class="btn-secondary"
        type="button"
        style="width:100%; margin-top:8px"
        onclick={load}
      >
        <i class="fas fa-sync-alt"></i> Обновить список
      </button>
    {/if}
  </div>
</div>

<style>
  .chat-item-title i {
    margin-right: 0.5rem;
    color: var(--accent-primary);
    width: 1.2rem;
    text-align: center;
  }
  
  .danger-hover:hover {
    color: var(--state-error);
    background: var(--state-error-bg);
  }
</style>