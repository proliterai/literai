<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { autoplayStore } from '$lib/domain/autoplay/autoplay.store';
  import { page } from '$app/stores';

  let state = $derived($autoplayStore);
  
  let mode: 'roleplay' | 'hero' = $derived($page.url.pathname.startsWith('/hero') ? 'hero' : 'roleplay');

  function handleStart() {
    autoplayStore.start(mode);
  }

  // Управление сообщениями
  function incMsg() { autoplayStore.setTargetMessages(state.targetMessages + 1); }
  function decMsg() { if (state.targetMessages > 1) autoplayStore.setTargetMessages(state.targetMessages - 1); }
  function handleMsgInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val > 0) autoplayStore.setTargetMessages(val);
  }

  // Управление задержкой
  function incDelay() { autoplayStore.setDelaySeconds(state.delaySeconds + 1); }
  function decDelay() { if (state.delaySeconds > 1) autoplayStore.setDelaySeconds(state.delaySeconds - 1); }
  function handleDelayInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 1) autoplayStore.setDelaySeconds(val);
  }
</script>

<div class="modal-panel autoplay-modal">
  <div class="modal-header">
    <h3><i class="fas fa-robot"></i> Автоигра</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>

  <div class="tab-content-area">
    <p class="autoplay-desc">
      Скрипт будет автоматически выбирать случайный вариант из подсказок нейросети и продолжать историю.
    </p>

    {#if !state.isRunning}
      <div class="settings-grid">
        <div class="setting-group">
          <label class="setting-label">Количество сообщений:</label>
          <div class="counter-control">
            <button class="btn-icon count-btn" onclick={decMsg}><i class="fas fa-minus"></i></button>
            <input type="number" class="panel-input count-input" value={state.targetMessages} oninput={handleMsgInput} />
            <button class="btn-icon count-btn" onclick={incMsg}><i class="fas fa-plus"></i></button>
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label">Задержка ответа (сек):</label>
          <div class="counter-control">
            <button class="btn-icon count-btn" onclick={decDelay}><i class="fas fa-minus"></i></button>
            <input type="number" class="panel-input count-input" value={state.delaySeconds} oninput={handleDelayInput} />
            <button class="btn-icon count-btn" onclick={incDelay}><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>

      <button class="btn-primary start-btn" onclick={handleStart}>
        <i class="fas fa-play"></i> Запустить Автоигру
      </button>
    {:else}
      <div class="status-panel">
        <div class="status-indicator">
          {#if state.isPaused}
            <div class="pulse-dot paused"></div>
            <span>Автоигра на паузе</span>
          {:else}
            <div class="pulse-dot active"></div>
            <span>Режим Автоигра запущен</span>
          {/if}
        </div>

        <div class="progress-info">
          Выполнено: <strong>{state.currentMessages}</strong> из <strong>{state.targetMessages}</strong>
        </div>

        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {(state.currentMessages / state.targetMessages) * 100}%"></div>
        </div>

        <div class="action-buttons">
          {#if state.isPaused}
            <button class="btn-primary" onclick={autoplayStore.resume}>
              <i class="fas fa-play"></i> Продолжить
            </button>
          {:else}
            <button class="btn-secondary" onclick={autoplayStore.pause}>
              <i class="fas fa-pause"></i> Пауза
            </button>
          {/if}
          <button class="btn-danger" onclick={autoplayStore.stop}>
            <i class="fas fa-stop"></i> Стоп
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .autoplay-modal { max-width: 480px; }
  .autoplay-desc { color: var(--txt-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-5); line-height: 1.5; }
  
  .settings-grid { display: flex; gap: var(--space-4); margin-bottom: var(--space-4); flex-wrap: wrap; }
  .setting-group { flex: 1; min-width: 180px; }
  .counter-control { display: flex; align-items: center; gap: var(--space-2); }
  .count-btn { background: var(--bg-surface-3); border: 1px solid var(--glass-border); width: 40px; height: 40px; border-radius: var(--radius-md); }
  .count-input { text-align: center; font-size: var(--font-size-md); font-weight: bold; padding: 0; }
  
  .start-btn { width: 100%; margin-top: var(--space-4); padding: var(--space-3); font-size: var(--font-size-md); }

  .status-panel { background: var(--bg-surface-2); padding: var(--space-5); border-radius: var(--radius-lg); border: 1px solid var(--glass-border); text-align: center; }
  .status-indicator { display: flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--font-size-md); font-weight: bold; margin-bottom: var(--space-4); color: var(--txt-primary); }
  
  .pulse-dot { width: 12px; height: 12px; border-radius: 50%; }
  .pulse-dot.active { background: var(--state-success); box-shadow: 0 0 10px var(--state-success); animation: pulse 1.5s infinite alternate; }
  .pulse-dot.paused { background: var(--state-warning); box-shadow: 0 0 10px var(--state-warning); }

  .progress-info { font-size: var(--font-size-sm); color: var(--txt-secondary); margin-bottom: var(--space-2); }
  .progress-bar-bg { width: 100%; height: 8px; background: var(--bg-surface-4); border-radius: var(--radius-full); overflow: hidden; margin-bottom: var(--space-5); }
  .progress-bar-fill { height: 100%; background: var(--txt-gold); transition: width 0.3s ease; }

  .action-buttons { display: flex; gap: var(--space-3); justify-content: center; }
  .action-buttons button { flex: 1; padding: var(--space-3); }

  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.7; }
    100% { transform: scale(1.2); opacity: 1; }
  }
</style>