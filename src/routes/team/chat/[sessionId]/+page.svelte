<script lang="ts">
  import { onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';
  import { ensureFirstResponse } from '$lib/domain/team-chat/teamChat.actions';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { teamSystemPromptStore } from '$lib/domain/team-system-prompt/teamSystemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
 import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import { eyeStore } from '$lib/domain/eye/eye.store';
  import { buildTeamSessionRow } from '$lib/domain/team-chat/teamChat.sessionRow';
  import TeamChatView from '$lib/components/team-chat/TeamChatView.svelte';
  import { get } from 'svelte/store';

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
      teamChatStore.reset();
      eyeStore.reset();
      privateChatStore.reset();
      teamSystemPromptStore.importData(null);
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

      if (session.mode !== 'team') {
        error = 'Это не сессия командного режима';
        loading = false;
        return;
      }

      // 3. ВОССТАНОВЛЕНИЕ ДАННЫХ
      teamChatStore.loadSession(session);
      teamSystemPromptStore.importData(session.systemPromptData);
      cheatmodeStore.importData(session.cheatmodeData);
      lorebookStore.importData(session.lorebookData);
      privateChatStore.importData(session.privateChatsData);
      eyeStore.importData(session.eyeData); // Восстанавливаем память Ока Мира

      // 4. НАСТРОЙКА АВТОСОХРАНЕНИЯ
      const triggerSave = () => {
        try {
          const row = buildTeamSessionRow();
          if (row.id) sessionsRepo.save(row);
        } catch (e) {
          console.error('[TeamChat] Autosave error:', e);
        }
      };

      unsubs.forEach(unsub => unsub());
      unsubs = [
        eyeStore.subscribe(triggerSave),
        teamSystemPromptStore.subscribe(triggerSave),
        cheatmodeStore.subscribe(triggerSave),
        lorebookStore.subscribe(triggerSave),
        privateChatStore.subscribe(triggerSave),
      memoryBookStore.subscribe(triggerSave)
      ];
      teamChatStore.onAutoSave(triggerSave);

      loading = false;

      // 5. ГЕНЕРАЦИЯ ПЕРВОГО ОТВЕТА
      const thisSessionId = id;
      setTimeout(async () => {
        if ($page.params.sessionId !== thisSessionId) return;
        const state = get(teamChatStore);
        const branch = state.chatTree.branches[state.chatTree.activeBranchIndex];
        if (!branch) return;

        const hasAssistant = branch.messages.some(m => m.role === 'assistant');
        const nonSystem = branch.messages.filter(m => m.role !== 'system');

        if (!hasAssistant && nonSystem.length === 0) {
          await ensureFirstResponse();
        }
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
    teamChatStore.destroy();
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
    <button class="btn-primary" onclick={() => goto('/team')}>
      <i class="fas fa-arrow-left"></i> Вернуться в каталог
    </button>
  </div>
{:else}
  <TeamChatView />
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
  .chat-error i { margin-bottom: var(--space-2); }
</style>