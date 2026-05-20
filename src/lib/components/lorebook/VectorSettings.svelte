<script lang="ts">
  import { settingsStore } from '$lib/domain/settings/settings.store';
  import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';

  let { 
    isVectorizing = false, 
    progress = { current: 0, total: 0 }, 
    disabled = false, 
    onVectorize 
  } = $props();

  let st = $derived($settingsStore.values);

  async function updateSetting(key: string, value: any) {
    await settingsStore.set(key as any, value);
  }
</script>

<div class="vector-settings-panel">
  <div class="vector-header">
    <h4><i class="fas fa-brain"></i> Умный поиск (Эмбеддинги)</h4>
    <label class="toggle-switch">
      <input 
        type="checkbox" 
        checked={st.embedding_enabled} 
        onchange={(e) => updateSetting(SETTINGS_KEYS.EMBEDDING_ENABLED, e.currentTarget.checked)} 
      />
      <span class="toggle-slider"></span>
    </label>
  </div>
  
  <p class="vector-hint">
    Позволяет ИИ находить записи в Лорбуке по смыслу, даже если точные слова не упоминались в тексте.
  </p>

  {#if st.embedding_enabled}
    <div class="vector-form">
      <div class="modal-field">
        <label>URL API Эмбеддингов (OpenAI-compatible)</label>
        <input 
          class="panel-input" 
          value={st.embedding_url} 
          placeholder="http://localhost:11434/v1/embeddings"
          onblur={(e) => updateSetting(SETTINGS_KEYS.EMBEDDING_URL, e.currentTarget.value)}
        />
      </div>
      
      <div class="modal-field">
        <label>Модель эмбеддингов</label>
        <input 
          class="panel-input" 
          value={st.embedding_model} 
          placeholder="nomic-embed-text"
          onblur={(e) => updateSetting(SETTINGS_KEYS.EMBEDDING_MODEL, e.currentTarget.value)}
        />
      </div>

      <div class="modal-field">
        <label>API Key (если требуется, например для OpenAI)</label>
        <input 
          type="password"
          class="panel-input" 
          value={st.embedding_key} 
          placeholder="sk-..."
          onblur={(e) => updateSetting(SETTINGS_KEYS.EMBEDDING_KEY, e.currentTarget.value)}
        />
      </div>

      <div class="modal-field">
        <div class="range-header">
          <label>Порог срабатывания (Сходство): {st.embedding_threshold}</label>
        </div>
        <input 
          class="panel-range" 
          type="range" min="0.1" max="0.95" step="0.01" 
          value={st.embedding_threshold} 
          onchange={(e) => updateSetting(SETTINGS_KEYS.EMBEDDING_THRESHOLD, Number(e.currentTarget.value))}
        />
      </div>

      <!-- Кнопка запуска массовой векторизации -->
            <div class="vectorize-action">
        <button 
          class="btn-primary" 
          disabled={disabled || isVectorizing} 
          onclick={onVectorize}
        >
          {#if isVectorizing}
            <i class="fas fa-spinner fa-spin"></i> Обработка ({progress.current} / {progress.total})
          {:else}
            <i class="fas fa-bolt"></i> Векторизовать записи
          {/if}
        </button>
        <p class="vector-hint-small">
          *Нажмите один раз после добавления новых записей, чтобы ИИ просчитал их математический смысл.
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .vector-settings-panel {
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .vector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .vector-header h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--txt-gold);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .vector-hint {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    margin-bottom: var(--space-4);
    line-height: 1.4;
  }

  .vector-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px dashed var(--glass-border);
  }

  .vectorize-action {
    margin-top: var(--space-2);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .vector-hint-small {
    font-size: 11px;
    color: var(--state-warning);
    margin: 0;
  }

  /* Стили для переключателя (Toggle) */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--bg-surface-4);
    transition: .3s; border-radius: 24px;
    border: 1px solid var(--glass-border);
  }
  .toggle-slider:before {
    position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
    background-color: var(--txt-muted); transition: .3s; border-radius: 50%;
  }
  .toggle-switch input:checked + .toggle-slider {
    background-color: var(--state-success); border-color: var(--state-success);
  }
  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(20px); background-color: white;
  }
</style>