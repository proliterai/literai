<!-- src/routes/search/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { searchStore } from '$lib/domain/search/search.store';
  import { ui } from '$lib/ui/ui.store';
  
  // ДОБАВЛЯЕМ ИМПОРТЫ ДЛЯ РАБОТЫ С БД
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { buildSearchSessionRow } from '$lib/domain/search/search.sessionRow';
  let query = $state('');
  async function handleSearch() {
    const q = query.trim();
    if (!q) {
      ui.notify('Введите поисковой запрос', 'warning');
      return;
    }
    
    // 1. Создаем сессию в сторе
    const sessionId = searchStore.startNewSession(q);
    
    // 2. ПРИНУДИТЕЛЬНО СОХРАНЯЕМ В БД ПЕРЕД ПЕРЕХОДОМ
    await sessionsRepo.save(buildSearchSessionRow());
    
    // 3. Теперь безопасно переходим
    await goto(`/search/${sessionId}`);
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }
</script>

<div class="search-landing">
  <div class="search-landing-icon">
    <i class="fas fa-globe"></i>
  </div>
  <h1>Нейропоиск</h1>
  <p>Задайте любой вопрос</p>

  <div class="search-big-input-wrapper">
    <input 
      type="text" 
      class="search-big-input" 
      placeholder="Ответы генерирует ИИ"
      bind:value={query}
      onkeydown={handleKeydown}
      autofocus
    />
    <button 
      class="search-big-btn" 
      onclick={handleSearch} 
      disabled={!query.trim()}
      title="Искать"
    >
      <i class="fas fa-search"></i>
    </button>
  </div>
</div>