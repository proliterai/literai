<!-- ================================================================================
ФАЙЛ: src/lib/components/hero-modals/HeroSummarizeModal.svelte
Описание: Модальное окно суммаризации истории для режима "Игра за героя"
================================================================================ -->
<script lang="ts">
import { get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store';
import { summarize } from '$lib/domain/hero-chat/heroChat.actions';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { page } from '$app/stores';

let customPrompt = $state(get(settingsStore).values[SETTINGS_KEYS.SUMMARIZE_PROMPT] || '');
let isSummarizing = $derived($heroChatStore.isSummarizing);
const isHeroChatRoute = $derived($page.url.pathname.startsWith('/hero/chat/'));
const chatState = $derived($heroChatStore);

// Получаем информацию о текущей части
const currentPart = $derived(chatState.chatParts[chatState.currentPartIndex]);
const messageCount = $derived(() => {
  const branch = chatState.chatTree.branches[chatState.chatTree.activeBranchIndex];
  return branch?.messages?.filter(m => m.role !== 'system').length ?? 0;
});

async function handleSummarize() {
  if (!isHeroChatRoute) {
    ui.notify('Откройте чат героя для суммаризации', 'warning');
    return;
  }
  
  await settingsStore.set(SETTINGS_KEYS.SUMMARIZE_PROMPT, customPrompt);
  
  const promptText = customPrompt.trim() || undefined;
  const ok = await summarize(promptText);
  
  if (ok) {
    ui.closeModal();
    ui.notify('Суммаризация завершена', 'success');
  }
}

function handleClose() {
  ui.closeModal();
}
</script>

<div class="modal-panel summarize-modal">
  <div class="modal-header">
    <h3><i class="fas fa-book-open"></i> Суммаризация истории героя</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={handleClose}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  
  <div class="tab-content-area">
    {#if !isHeroChatRoute}
    <div class="panel-placeholder">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Откройте чат героя для суммаризации истории</p>
    </div>
    {:else if messageCount() < 5}
    <div class="panel-placeholder">
      <i class="fas fa-info-circle"></i>
      <p>Слишком мало сообщений для суммаризации</p>
      <small>Рекомендуется суммаризировать после 5+ сообщений</small>
    </div>
    {:else}
    <div class="summarize-info">
      <div class="info-card">
        <i class="fas fa-comments"></i>
        <div class="info-value">{messageCount()}</div>
        <div class="info-label">Сообщений в части</div>
      </div>
      <div class="info-card">
        <i class="fas fa-code-branch"></i>
        <div class="info-value">{chatState.chatTree.branches.length}</div>
        <div class="info-label">Ветвей истории</div>
      </div>
      <div class="info-card">
        <i class="fas fa-layer-group"></i>
        <div class="info-value">{chatState.chatParts.length}</div>
        <div class="info-label">Частей всего</div>
      </div>
    </div>
    
    <div class="summarize-section">
      <h4><i class="fas fa-info-circle"></i> Что произойдёт?</h4>
      <ul class="summarize-list">
        <li>
          <i class="fas fa-check"></i>
          <span>Текущая часть будет завершена и сохранена</span>
        </li>
        <li>
          <i class="fas fa-check"></i>
          <span>ИИ создаст краткий пересказ ключевых событий</span>
        </li>
        <li>
          <i class="fas fa-check"></i>
          <span>Начнётся новая часть с обновлённым контекстом</span>
        </li>
        <li>
          <i class="fas fa-check"></i>
          <span>Предыдущие суммаризации сохранятся для контекста</span>
        </li>
      </ul>
    </div>
    
    <div class="summarize-section">
      <h4><i class="fas fa-pen"></i> Инструкция для ИИ (Промпт)</h4>
      <p class="section-hint">
        Отредактируйте базовый промпт суммаризации. Этот текст сохранится для всех будущих сессий.
      </p>
      <textarea
        class="panel-textarea"
        bind:value={customPrompt}
        rows="4"
        placeholder="Например: Сфокусируйся на развитии характера героя..."
        disabled={isSummarizing}
      ></textarea>
    </div>
    
    <div class="summarize-actions">
      <button class="btn-secondary" onclick={handleClose} disabled={isSummarizing}>
        <i class="fas fa-times"></i>
        Отмена
      </button>
      <button class="btn-primary" onclick={handleSummarize} disabled={isSummarizing}>
        {#if isSummarizing}
        <i class="fas fa-spinner fa-spin"></i>
        Суммаризация...
        {:else}
        <i class="fas fa-magic"></i>
        Создать новую часть
        {/if}
      </button>
    </div>
    {/if}
  </div>
</div>

<style>
  .summarize-modal {
    max-width: 600px;
  }
  
  .summarize-info {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  
  .info-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }
  
  .info-card i {
    font-size: 1.5rem;
    color: var(--txt-gold);
    margin-bottom: var(--space-2);
  }
  
  .info-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-bold);
    color: var(--txt-primary);
    margin-bottom: var(--space-1);
  }
  
  .info-label {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .summarize-section {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  
  .summarize-section h4 {
    font-size: var(--font-size-sm);
    color: var(--txt-gold);
    margin-bottom: var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .summarize-section h4 i {
    color: var(--txt-gold);
  }
  
  .summarize-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .summarize-list li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
  }
  
  .summarize-list li i {
    color: var(--state-success);
    margin-top: 2px;
    flex-shrink: 0;
  }
  
  .section-hint {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    margin-bottom: var(--space-3);
    line-height: var(--leading-relaxed);
  }
  
  .summarize-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    padding-top: var(--space-4);
    border-top: 1px solid var(--glass-border);
  }
  
  @media (max-width: 480px) {
    .summarize-info {
      grid-template-columns: 1fr;
    }
    
    .summarize-actions {
      flex-direction: column-reverse;
    }
    
    .summarize-actions button {
      width: 100%;
      justify-content: center;
    }
  }
</style>