<script lang="ts">
  import { onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { chatStore } from '$lib/domain/chat/chat.store';
  import { ensureFirstResponse } from '$lib/domain/chat/chat.actions';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
  import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import { eyeStore } from '$lib/domain/eye/eye.store';
  import { buildSessionRow } from '$lib/domain/chat/chat.sessionRow';
  import ChatView from '$lib/components/chat/ChatView.svelte';

  let sessionId = $derived($page.params.sessionId);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Массив для хранения отписок от сторов
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
      // 1. ЖЕСТКАЯ ОЧИСТКА RAM (предотвращает утечки старых чатов)
      chatStore.reset();
      eyeStore.reset();
      systemPromptStore.importData(null);
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

      if (session.mode && session.mode !== 'roleplay') {
        error = 'Это не сессия ролевого чата';
        loading = false;
        return;
      }

      // 3. ВОССТАНОВЛЕНИЕ ДАННЫХ
      chatStore.loadSession(session);
      systemPromptStore.importData(session.systemPromptData);
      cheatmodeStore.importData(session.cheatmodeData);
      lorebookStore.importData(session.lorebookData);
      eyeStore.importData(session.eyeData); // Восстанавливаем память Ока Мира

      if (session.selectedItems) {
        cheatmodeStore.loadCharactersFromSelections(session.selectedItems);
      }

      // 4. НАСТРОЙКА АВТОСОХРАНЕНИЯ (Включая Око Мира)
      const triggerSave = () => {
        try {
          const row = buildSessionRow();
          if (row.id) sessionsRepo.save(row);
        } catch (e) {
          console.error('[RoleplayChat] Autosave error:', e);
        }
      };

      // Очищаем старые подписки
      unsubs.forEach(unsub => unsub());
      unsubs = [
        chatStore.subscribe(triggerSave),
        eyeStore.subscribe(triggerSave),
        systemPromptStore.subscribe(triggerSave),
        cheatmodeStore.subscribe(triggerSave),
        lorebookStore.subscribe(triggerSave),
      memoryBookStore.subscribe(triggerSave)
      ];

      loading = false;

      // 5. ГЕНЕРАЦИЯ ПЕРВОГО ОТВЕТА (если нужно)
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
    chatStore.destroy();
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
    <button class="btn-primary" onclick={() => goto('/roleplay')}>
      <i class="fas fa-home"></i> Вернуться в каталог
    </button>
  </div>
{:else}
  <ChatView />
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