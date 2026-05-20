<script lang="ts">
  import { settingsStore } from '$lib/domain/settings/settings.store';
  import { SETTINGS_KEYS, SETTINGS_DEFAULTS } from '$lib/domain/settings/settings.keys';
  import { ui } from '$lib/ui/ui.store';

  let s = $derived($settingsStore.values);

  async function set(key: string, value: number) { 
    await settingsStore.set(key as any, value); 
  }

  async function setBoolean(key: string, value: boolean) {
    await settingsStore.set(key as any, value);
    
    // Уведомление при переключении подсказок
    if (key === SETTINGS_KEYS.SHOW_HINTS) {
      ui.notify(
        value ? 'Подсказки включены' : 'Подсказки выключены', 
        'success'
      );
    }
  }

  async function resetToDefault() {
    const confirmed = await ui.confirm('Сброс настроек', 'Вернуть ползунки ИИ к заводским значениям?');
    if (confirmed) {
      await settingsStore.setMany({
        [SETTINGS_KEYS.AI_TEMPERATURE]: SETTINGS_DEFAULTS.ai_temperature,
        [SETTINGS_KEYS.AI_MAX_TOKENS]: SETTINGS_DEFAULTS.ai_max_tokens,
        [SETTINGS_KEYS.AI_TOP_P]: SETTINGS_DEFAULTS.ai_top_p,
        [SETTINGS_KEYS.AI_FREQUENCY_PENALTY]: SETTINGS_DEFAULTS.ai_frequency_penalty,
        [SETTINGS_KEYS.AI_PRESENCE_PENALTY]: SETTINGS_DEFAULTS.ai_presence_penalty,
        [SETTINGS_KEYS.SHOW_HINTS]: SETTINGS_DEFAULTS.show_hints
      });
      ui.notify('Настройки ИИ сброшены', 'success');
    }
  }
</script>

<div class="panel-section ai-settings-panel">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
    <h4 class="panel-title" style="margin-bottom: 0;"><i class="fas fa-sliders-h"></i> Параметры ИИ</h4>
    <button class="btn-secondary btn-sm" onclick={resetToDefault} title="Вернуть по дефолту">
      <i class="fas fa-undo"></i> Сброс
    </button>
  </div>

  <div class="setting-group">
    <label class="setting-label" for="ai-temp">Температура: {s.ai_temperature}</label>
    <input id="ai-temp" class="panel-range" type="range" min="0" max="2" step="0.05" value={s.ai_temperature} oninput={(e) => set(SETTINGS_KEYS.AI_TEMPERATURE, Number(e.currentTarget.value))} />
  </div>

  <div class="setting-group">
    <label class="setting-label" for="ai-max-tokens">Max tokens: {s.ai_max_tokens}</label>
    <input id="ai-max-tokens" class="panel-range" type="range" min="1000" max="64000" step="500" value={s.ai_max_tokens} oninput={(e) => set(SETTINGS_KEYS.AI_MAX_TOKENS, Number(e.currentTarget.value))} />
  </div>

  <div class="setting-group">
    <label class="setting-label" for="ai-top-p">Top P: {s.ai_top_p}</label>
    <input id="ai-top-p" class="panel-range" type="range" min="0" max="1" step="0.05" value={s.ai_top_p} oninput={(e) => set(SETTINGS_KEYS.AI_TOP_P, Number(e.currentTarget.value))} />
  </div>

  <div class="setting-group">
    <label class="setting-label" for="ai-freq-pen">Frequency penalty: {s.ai_frequency_penalty}</label>
    <input id="ai-freq-pen" class="panel-range" type="range" min="0" max="2" step="0.05" value={s.ai_frequency_penalty} oninput={(e) => set(SETTINGS_KEYS.AI_FREQUENCY_PENALTY, Number(e.currentTarget.value))} />
  </div>

  <div class="setting-group">
    <label class="setting-label" for="ai-pres-pen">Presence penalty: {s.ai_presence_penalty}</label>
    <input id="ai-pres-pen" class="panel-range" type="range" min="0" max="2" step="0.05" value={s.ai_presence_penalty} oninput={(e) => set(SETTINGS_KEYS.AI_PRESENCE_PENALTY, Number(e.currentTarget.value))} />
  </div>

  <!-- Переключатель подсказок -->
  <div class="setting-group setting-group-toggle">
    <label class="setting-label" for="ai-show-hints">Вывод подсказок</label>
    <label class="toggle-switch">
      <input 
        id="ai-show-hints" 
        type="checkbox" 
        checked={s.show_hints} 
        onchange={(e) => setBoolean(SETTINGS_KEYS.SHOW_HINTS, e.currentTarget.checked)} 
      />
      <span class="toggle-slider"></span>
    </label>
    <span class="setting-hint">
      {s.show_hints ? 'Включено — ИИ предлагает 2 варианта продолжения' : 'Выключено — ответ без подсказок'}
    </span>
  </div>
</div>

<style>
  .setting-group-toggle {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 26px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--glass-border);
    transition: 0.3s;
    border-radius: 26px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: var(--txt-muted);
    transition: 0.3s;
    border-radius: 50%;
  }

  .toggle-switch input:checked + .toggle-slider {
    background-color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(24px);
    background-color: white;
  }

  .toggle-switch input:focus + .toggle-slider {
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .setting-hint {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    line-height: var(--leading-relaxed);
  }
</style>