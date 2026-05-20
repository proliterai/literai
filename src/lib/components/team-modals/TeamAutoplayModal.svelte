<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { autoplayStore } from '$lib/domain/autoplay/autoplay.store';
  import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';

  let state = $derived($autoplayStore);
  let characters = $derived($teamChatStore.selectedItems?.teamCharacters || []);
  let selectedActorId = $state('narrator');

  function handleAddTurn() {
    let name = 'Рассказчик';
    if (selectedActorId !== 'narrator') {
      const char = characters.find((c: any) => c.id === selectedActorId);
      if (char) name = char.name;
    }
    autoplayStore.addTeamTurn(selectedActorId, name);
  }

  function handleStart() {
    if (state.teamSequence.length === 0) {
      ui.notify('Добавьте хотя бы один ход в хронологию', 'warning');
      return;
    }
    autoplayStore.start('team');
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
    <h3><i class="fas fa-users-cog"></i> Командная Автоигра</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>

  <div class="tab-content-area">
    {#if !state.isRunning}
      <p class="autoplay-desc">Создайте хронологию ходов. Скрипт будет автоматически триггерить генерацию ответов за выбранных участников по порядку.</p>
      
      <div class="setting-group delay-setting">
        <label class="setting-label">Задержка перед ответом (сек):</label>
        <div class="counter-control">
          <button class="btn-icon count-btn" onclick={decDelay}><i class="fas fa-minus"></i></button>
          <input type="number" class="panel-input count-input" value={state.delaySeconds} oninput={handleDelayInput} />
          <button class="btn-icon count-btn" onclick={incDelay}><i class="fas fa-plus"></i></button>
        </div>
      </div>

      <div class="add-turn-box">
        <select class="panel-select" bind:value={selectedActorId}>
          <option value="narrator">Рассказчик</option>
          {#each characters as char (char.id)}
            <option value={char.id}>{char.name}</option>
          {/each}
        </select>
        <button class="btn-secondary" onclick={handleAddTurn}>
          <i class="fas fa-plus"></i> Добавить ход
        </button>
      </div>

      <div class="sequence-list custom-scrollbar">
        {#if state.teamSequence.length === 0}
          <div class="empty-sequence">Хронология пуста. Добавьте ходы выше.</div>
        {:else}
          {#each state.teamSequence as turn, i (turn.id)}
            <div class="sequence-item">
              <span class="turn-num">{i + 1}.</span>
              <span class="turn-name">Автоход: <strong>{turn.actorName}</strong></span>
              <button class="btn-icon danger" onclick={() => autoplayStore.removeTeamTurn(turn.id)}>
                <i class="fas fa-times"></i>
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick={autoplayStore.clearTeamTurns}>Очистить список</button>
        <button class="btn-primary" onclick={handleStart} disabled={state.teamSequence.length === 0}>
          <i class="fas fa-play"></i> Запустить
        </button>
      </div>

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
          Выполняется шаг: <strong>{state.currentSequenceIndex + 1}</strong> из <strong>{state.teamSequence.length}</strong>
        </div>

        <div class="sequence-list running custom-scrollbar">
          {#each state.teamSequence as turn, i (turn.id)}
            <div class="sequence-item {i === state.currentSequenceIndex ? 'current' : ''} {i < state.currentSequenceIndex ? 'done' : ''}">
              <span class="turn-num">
                {#if i < state.currentSequenceIndex}
                  <i class="fas fa-check" style="color: var(--state-success)"></i>
                {:else if i === state.currentSequenceIndex}
                  <i class="fas fa-spinner fa-spin" style="color: var(--txt-gold)"></i>
                {:else}
                  {i + 1}.
                {/if}
              </span>
              <span class="turn-name">{turn.actorName}</span>
            </div>
          {/each}
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
  .autoplay-modal { max-width: 500px; }
  .autoplay-desc { color: var(--txt-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4); line-height: 1.5; }
  
  .delay-setting { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); padding: var(--space-3); background: var(--bg-surface-3); border-radius: var(--radius-md); border: 1px solid var(--glass-border); }
  .delay-setting .setting-label { margin: 0; font-weight: normal; }
  .counter-control { display: flex; align-items: center; gap: var(--space-2); width: 130px; }
  .count-btn { background: var(--bg-surface-4); border: 1px solid var(--glass-border); width: 36px; height: 36px; border-radius: var(--radius-sm); }
  .count-input { text-align: center; font-size: var(--font-size-md); font-weight: bold; padding: 0; height: 36px; }

  .add-turn-box { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .add-turn-box select { flex: 1; }
  
  .sequence-list { background: var(--bg-surface-2); border: 1px solid var(--glass-border); border-radius: var(--radius-md); max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; }
  .empty-sequence { padding: var(--space-5); text-align: center; color: var(--txt-muted); font-size: var(--font-size-sm); }
  
  .sequence-item { display: flex; align-items: center; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--glass-border); gap: var(--space-3); }
  .sequence-item:last-child { border-bottom: none; }
  .turn-num { width: 24px; color: var(--txt-muted); font-size: var(--font-size-sm); font-weight: bold; text-align: center; }
  .turn-name { flex: 1; color: var(--txt-primary); font-size: var(--font-size-sm); }
  
  .sequence-item.current { background: rgba(196, 163, 90, 0.15); border-left: 3px solid var(--txt-gold); }
  .sequence-item.done { opacity: 0.5; }

  .status-panel { background: var(--bg-surface-2); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--glass-border); text-align: center; }
  .status-indicator { display: flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--font-size-md); font-weight: bold; margin-bottom: var(--space-3); color: var(--txt-primary); }
  
  .pulse-dot { width: 12px; height: 12px; border-radius: 50%; }
  .pulse-dot.active { background: var(--state-success); box-shadow: 0 0 10px var(--state-success); animation: pulse 1.5s infinite alternate; }
  .pulse-dot.paused { background: var(--state-warning); box-shadow: 0 0 10px var(--state-warning); }

  .progress-info { font-size: var(--font-size-sm); color: var(--txt-secondary); margin-bottom: var(--space-4); }
  
  .action-buttons { display: flex; gap: var(--space-3); justify-content: center; margin-top: var(--space-4); }
  .action-buttons button { flex: 1; padding: var(--space-3); }

  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.7; }
    100% { transform: scale(1.2); opacity: 1; }
  }
</style>