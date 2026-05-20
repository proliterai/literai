<script lang="ts">
  import { onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store';
  import { ensureFirstResponse } from '$lib/domain/hero-chat/heroChat.actions';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { heroSystemPromptStore } from '$lib/domain/hero-chat/heroSystemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
 import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import { eyeStore } from '$lib/domain/eye/eye.store';
  import { buildHeroSessionRow } from '$lib/domain/hero-chat/heroChat.sessionRow';
  import HeroChatView from '$lib/components/hero-chat/HeroChatView.svelte';

  let sessionId = $derived($page.params.sessionId);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let unsubs: Array<() => void> = [];

  $effect(() => {
    if (sessionId) {
      loadChat(sessionId);
    }
  });

  async function loadChat(id: string) {
    loading = true;
    error = null;

    try {
      // 1. ЖЕСТКАЯ ОЧИСТКА RAM
      heroChatStore.reset();
      eyeStore.reset();
      heroSystemPromptStore.importData(null);
      cheatmodeStore.importData(null);
      lorebookStore.importData(null);
    memoryBookStore.importData(null);

      // 2. ЗАГРУЗКА ИЗ БАЗЫ
      const session = await sessionsRepo.load(id);

      if (!session) {
        error = 'Сессия не найдена';
        loading = false;
        return;
      }

      if (session.mode !== 'hero') {
        error = 'Это не сессия игры за героя';
        loading = false;
        return;
      }

      // 3. ВОССТАНОВЛЕНИЕ ДАННЫХ
      heroChatStore.loadSession(session);
      heroSystemPromptStore.importData(session.systemPromptData);
      cheatmodeStore.importData(session.cheatmodeData);
      lorebookStore.importData(session.lorebookData);
      eyeStore.importData(session.eyeData); // Восстанавливаем память Ока Мира

      if (session.selectedItems?.heroCharacter) {
        cheatmodeStore.loadCharactersFromSelections({
          heroCharacter: session.selectedItems.heroCharacter
        });
      }

      // 4. НАСТРОЙКА АВТОСОХРАНЕНИЯ
      const triggerSave = () => {
        try {
          const row = buildHeroSessionRow();
          if (row.id) sessionsRepo.save(row);
        } catch (e) {
          console.error('[HeroChat] Autosave error:', e);
        }
      };

      unsubs.forEach(unsub => unsub());
      unsubs = [
        heroChatStore.subscribe(triggerSave),
        eyeStore.subscribe(triggerSave),
        heroSystemPromptStore.subscribe(triggerSave),
        cheatmodeStore.subscribe(triggerSave),
        lorebookStore.subscribe(triggerSave),
      memoryBookStore.subscribe(triggerSave)
      ];

      loading = false;

      // 5. ГЕНЕРАЦИЯ ПЕРВОГО ОТВЕТА
      const thisSessionId = id;
      setTimeout(() => {
        if ($page.params.sessionId !== thisSessionId) return;
        ensureFirstResponse();
      }, 100);
    } catch (e: any) {
      console.error(e);
      error = e.message || 'Ошибка загрузки чата';
      loading = false;
    }
  }

  onDestroy(() => {
    unsubs.forEach(unsub => unsub());
    unsubs = [];
    heroChatStore.destroy();
  });
</script>

{#if loading}
  <div class="chat-loading">
    <i class="fas fa-spinner fa-spin"></i>
    <p>Загрузка чата...</p>
  </div>
{:else if error}
  <div class="chat-error">
    <i class="fas fa-exclamation-circle"></i>
    <p>{error}</p>
    <button class="btn-primary" onclick={() => goto('/hero')}>
      <i class="fas fa-arrow-left"></i> Вернуться в каталог
    </button>
  </div>
{:else}
  <HeroChatView />
{/if}

<style>
  .chat-loading, .chat-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: var(--space-4);
    color: var(--txt-muted);
  }
  .chat-error { color: var(--state-error); }
  .chat-loading i, .chat-error i { font-size: 3rem; }
</style>