<script lang="ts">
 import { onMount } from 'svelte';
 import { page } from '$app/stores';
 import { goto } from '$app/navigation';
 import { chatStore } from '$lib/domain/chat/chat.store';
 import { ensureFirstResponse } from '$lib/domain/chat/chat.actions';
 import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
 import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
 import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
 import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
 import ChatView from '$lib/components/chat/ChatView.svelte';

 let sessionId = $derived($page.params.sessionId);
 let loading = $state(true);
 let error = $state<string | null>(null);

 $effect(() => {
    if (sessionId) {
        loadChat(sessionId);
    }
 });

 async function loadChat(id: string) {
    loading = true;
    error = null;
    try {
        const session = await sessionsRepo.load(id);
        
        if (!session) {
            error = 'Сессия не найдена';
            loading = false;
            return;
        }

        // Загружаем сессию в chatStore
        chatStore.loadSession(session);

        // Восстанавливаем ВСЕ данные сессии
        if (session.systemPromptData) {
            systemPromptStore.importData(session.systemPromptData);
        }
        if (session.cheatmodeData) {
            cheatmodeStore.importData(session.cheatmodeData);
        }
        if (session.lorebookData) {
            lorebookStore.importData(session.lorebookData);
        }

        // Загружаем персонажей в читмод из selectedItems
        if (session.selectedItems) {
            cheatmodeStore.loadCharactersFromSelections(session.selectedItems);
        }

        loading = false;

        // Запускаем генерацию первого ответа если нужно
        setTimeout(() => {
            ensureFirstResponse();
        }, 100);

    } catch (e: any) {
        console.error(e);
        error = e.message || 'Ошибка загрузки чата';
        loading = false;
    }
 }
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
    <button class="btn-primary" onclick={() => goto('/')}>
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
    gap: 16px;
    color: var(--txt-muted);
 }
 .chat-loading i, .chat-error i { font-size: 3rem; }
 .chat-error p { font-size: 1.1rem; color: var(--txt-secondary); }
</style>