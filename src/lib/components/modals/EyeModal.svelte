<script lang="ts">
  import { tick } from 'svelte';
  import { ui } from '$lib/ui/ui.store';
  import { eyeStore, EYE_PRESETS } from '$lib/domain/eye/eye.store';
  import { renderMarkdown } from '$lib/utils/markdown';

  let state = $derived($eyeStore);
  let inputText = $state('');
  let selectedPreset = $state('');
  let scroller: HTMLDivElement | null = $state(null);
  let editingId = $state<string | null>(null);
  let editText = $state('');

  // Автоскролл
  $effect(() => {
    if (state.messages.length && scroller) {
      tick().then(() => {
        scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      });
    }
  });

  function handlePresetChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    const preset = EYE_PRESETS.find(p => p.id === id);
    if (preset) {
      inputText = preset.prompt;
    }
  }

  function handleSend() {
    if (!inputText.trim() || state.isGenerating) return;
    eyeStore.sendRequest(inputText);
    inputText = '';
    selectedPreset = '';
  }

  function startEdit(msg: any) {
    editingId = msg.id;
    editText = msg.content;
  }

  function saveEdit() {
    if (editingId && editText.trim()) {
      eyeStore.editMessage(editingId, editText.trim());
    }
    editingId = null;
  }
</script>

<div class="modal-panel eye-modal">
  <div class="modal-header">
    <h3><i class="fas fa-eye"></i> Око мира — знает все</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>

  <div class="eye-container">


    <!-- Сообщения -->
    <div class="eye-messages custom-scrollbar" bind:this={scroller}>
      {#if state.messages.length === 0}
        <div class="eye-empty">
          <i class="fas fa-crystal-ball"></i>
          <p>Око мира — это специальный всевидящий экран, который может показать вам, что происходит в любой точке мира, заглянуть в мысли любого персонажа или спрогнозировать события.</p>
        </div>
      {/if}

      {#each state.messages as msg (msg.id)}
        <div class="eye-bubble {msg.role}">
          <div class="eye-bubble-header">
            {#if msg.role === 'user'}
              <i class="fas fa-user"></i> Запрос
            {:else}
              <i class="fas fa-eye"></i> Видение
            {/if}
          </div>

          {#if editingId === msg.id}
            <div class="eye-edit">
              <textarea class="panel-textarea" bind:value={editText} rows="4"></textarea>
              <div class="eye-edit-actions">
                <button class="btn-secondary btn-sm" onclick={() => editingId = null}>Отмена</button>
                <button class="btn-primary btn-sm" onclick={saveEdit}>Сохранить</button>
              </div>
            </div>
          {:else}
            <div class="eye-content">
              {@html renderMarkdown(msg.content)}
            </div>
            {#if msg.role === 'assistant'}
              <div class="eye-actions">
                <button class="btn-icon" title="Редактировать" onclick={() => startEdit(msg)}>
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon danger" title="Удалить" onclick={() => eyeStore.deleteMessage(msg.id)}>
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            {/if}
            {#if msg.role === 'user'}
              <div class="eye-actions">
                <button class="btn-icon" title="Редактировать" onclick={() => startEdit(msg)}>
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon danger" title="Удалить" onclick={() => eyeStore.deleteMessage(msg.id)}>
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            {/if}
          {/if}
        </div>
      {/each}

      {#if state.isGenerating}
        <div class="eye-loading">
          <i class="fas fa-spinner fa-spin"></i> Око всматривается в вероятности...
        </div>
      {/if}
    </div>

    <!-- Панель ввода -->
    <div class="eye-input-area">
      <div class="preset-row">
        <select class="panel-select" bind:value={selectedPreset} onchange={handlePresetChange}>
          <option value="" disabled selected>-- Выберите заготовку запроса --</option>
          {#each EYE_PRESETS as preset}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </select>
        {#if state.messages.length > 0}
          <button class="btn-secondary btn-sm" onclick={() => eyeStore.clearHistory()} title="Очистить историю">
            <i class="fas fa-eraser"></i>
          </button>
        {/if}
      </div>

      <div class="input-row">
        <textarea 
          class="panel-textarea" 
          bind:value={inputText} 
          rows="3" 
          placeholder="Напишите, что вы хотите увидеть..."
          onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        ></textarea>
      </div>

      <button class="btn-primary show-btn" onclick={handleSend} disabled={!inputText.trim() || state.isGenerating}>
        <i class="fas fa-magic"></i> Показать
      </button>
    </div>
  </div>
</div>

<style>
  .eye-modal {
    max-width: 800px;
    height: 85vh;
  }

  .eye-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .eye-description {
    padding: var(--space-3) var(--space-4);
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
    background: var(--bg-surface-2);
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .eye-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--bg-surface-1);
  }

  .eye-empty {
    margin: auto;
    text-align: center;
    color: var(--txt-muted);
    opacity: 0.5;
  }

  .eye-empty i { font-size: 3rem; margin-bottom: 1rem; }

  .eye-bubble {
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    background: var(--bg-surface-2);
    position: relative;
  }

  .eye-bubble.user {
    border-left: 3px solid var(--state-info);
    align-self: flex-end;
    max-width: 85%;
  }

  .eye-bubble.assistant {
    border-left: 3px solid var(--txt-gold);
    background: linear-gradient(135deg, var(--bg-surface-3), var(--bg-surface-2));
    box-shadow: var(--shadow-sm);
  }

  .eye-bubble-header {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    margin-bottom: var(--space-2);
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user .eye-bubble-header i { color: var(--state-info); }
  .assistant .eye-bubble-header i { color: var(--txt-gold); }

  .eye-content {
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--txt-primary);
  }

  .eye-content :global(p) { margin-bottom: 8px; }
  .eye-content :global(p:last-child) { margin-bottom: 0; }

  .eye-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .eye-bubble:hover .eye-actions { opacity: 1; }

  .btn-icon.danger:hover { color: var(--state-error); }

  .eye-edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .eye-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .eye-loading {
    text-align: center;
    padding: var(--space-4);
    color: var(--txt-gold);
    font-style: italic;
    font-size: var(--font-size-sm);
  }

  .eye-input-area {
    padding: var(--space-4);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .preset-row {
    display: flex;
    gap: var(--space-3);
  }

  .show-btn {
    width: 100%;
    padding: var(--space-3);
    font-size: var(--font-size-md);
  }

  @media (max-width: 600px) {
    .eye-bubble.user { max-width: 95%; }
    .eye-actions { opacity: 1; }
  }
</style>