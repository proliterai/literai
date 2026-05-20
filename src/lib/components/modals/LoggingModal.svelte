<script lang="ts">
import { ui } from '$lib/ui/ui.store';
import { loggingStore, type LogEntry } from '$lib/domain/logging/logging.store';

let logs = $derived($loggingStore);
let filter = $state<'all' | 'request' | 'response' | 'error'>('all');
let searchQuery = $state('');
let expandedIds = $state<Set<string>>(new Set());

let filteredEntries = $derived(() => {
  let entries = logs.entries;
  
  if (filter !== 'all') {
    entries = entries.filter(e => e.type === filter);
  }
  
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    entries = entries.filter(e => 
      JSON.stringify(e.data).toLowerCase().includes(q) ||
      e.type.includes(q)
    );
  }
  
  return entries;
});

function toggleExpand(id: string) {
  const newSet = new Set(expandedIds);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  expandedIds = newSet;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function getTypeIcon(type: LogEntry['type']): string {
  switch (type) {
    case 'request': return 'fa-arrow-up';
    case 'response': return 'fa-arrow-down';
    case 'error': return 'fa-exclamation-triangle';
    default: return 'fa-circle';
  }
}

function getTypeClass(type: LogEntry['type']): string {
  switch (type) {
    case 'request': return 'log-request';
    case 'response': return 'log-response';
    case 'error': return 'log-error';
    default: return '';
  }
}

function formatJson(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function handleExport() {
  const data = loggingStore.exportLogs();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai_logs_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleClear() {
  if (confirm('Очистить все логи?')) {
    loggingStore.clear();
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    ui.notify('Скопировано в буфер обмена', 'success');
  }).catch(() => {
    ui.notify('Не удалось скопировать', 'error');
  });
}
</script>

<div class="modal-panel logging-modal">
  <div class="modal-header">
    <h3><i class="fas fa-terminal"></i> Логирование AI</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  
  <div class="logging-toolbar">
    <div class="logging-filters">
      <button 
        class="filter-btn {filter === 'all' ? 'active' : ''}" 
        onclick={() => filter = 'all'}
      >
        Все ({logs.entries.length})
      </button>
      <button 
        class="filter-btn filter-request {filter === 'request' ? 'active' : ''}" 
        onclick={() => filter = 'request'}
      >
        <i class="fas fa-arrow-up"></i> Запросы
      </button>
      <button 
        class="filter-btn filter-response {filter === 'response' ? 'active' : ''}" 
        onclick={() => filter = 'response'}
      >
        <i class="fas fa-arrow-down"></i> Ответы
      </button>
      <button 
        class="filter-btn filter-error {filter === 'error' ? 'active' : ''}" 
        onclick={() => filter = 'error'}
      >
        <i class="fas fa-exclamation-triangle"></i> Ошибки
      </button>
    </div>
    
    <div class="logging-search">
      <i class="fas fa-search"></i>
      <input 
        type="text" 
        placeholder="Поиск в логах..." 
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => searchQuery = ''}>
          <i class="fas fa-times"></i>
        </button>
      {/if}
    </div>
    
    <div class="logging-actions">
      <label class="toggle-label">
        <input 
          type="checkbox" 
          checked={logs.isEnabled} 
          onchange={() => loggingStore.toggle()}
        />
        <span>Логирование {logs.isEnabled ? 'вкл' : 'выкл'}</span>
      </label>
      <button class="btn-secondary btn-sm" onclick={handleExport} title="Экспорт логов">
        <i class="fas fa-download"></i>
      </button>
      <button class="btn-secondary btn-sm" onclick={handleClear} title="Очистить логи">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </div>
  
  <div class="logging-content">
    {#if filteredEntries().length === 0}
      <div class="logging-empty">
        <i class="fas fa-inbox"></i>
        <p>Нет записей в логе</p>
        {#if !logs.isEnabled}
          <small>Логирование отключено</small>
        {:else}
          <small>Отправьте сообщение в чат для записи логов</small>
        {/if}
      </div>
    {:else}
      <div class="log-entries">
        {#each filteredEntries() as entry (entry.id)}
          <div class="log-entry {getTypeClass(entry.type)} {expandedIds.has(entry.id) ? 'expanded' : ''}">
            <div class="log-entry-header" onclick={() => toggleExpand(entry.id)}>
              <div class="log-entry-meta">
                <i class="fas {getTypeIcon(entry.type)}"></i>
                <span class="log-type">{entry.type.toUpperCase()}</span>
                <span class="log-time">{formatTimestamp(entry.timestamp)}</span>
                {#if entry.data.statusCode}
                  <span class="log-status">HTTP {entry.data.statusCode}</span>
                {/if}
                {#if entry.data.duration}
                  <span class="log-duration">{entry.data.duration}ms</span>
                {/if}
              </div>
              <div class="log-entry-actions">
                <button 
                  class="btn-icon" 
                  title="Копировать"
                  onclick={(e) => { e.stopPropagation(); copyToClipboard(formatJson(entry.data)); }}
                >
                  <i class="fas fa-copy"></i>
                </button>
                <i class="fas fa-chevron-{expandedIds.has(entry.id) ? 'up' : 'down'}"></i>
              </div>
            </div>
            
            {#if expandedIds.has(entry.id)}
              <div class="log-entry-body">
                {#if entry.data.url}
                  <div class="log-field">
                    <span class="log-field-label">URL:</span>
                    <code class="log-field-value">{entry.data.url}</code>
                  </div>
                {/if}
                {#if entry.data.model}
                  <div class="log-field">
                    <span class="log-field-label">Model:</span>
                    <code class="log-field-value">{entry.data.model}</code>
                  </div>
                {/if}
                {#if entry.data.params}
                  <div class="log-field">
                    <span class="log-field-label">Parameters:</span>
                    <pre class="log-code">{formatJson(entry.data.params)}</pre>
                  </div>
                {/if}
                {#if entry.data.messages}
                  <div class="log-field">
                    <span class="log-field-label">Messages ({entry.data.messages.length}):</span>
                    <pre class="log-code">{formatJson(entry.data.messages)}</pre>
                  </div>
                {/if}
                {#if entry.data.response}
                  <div class="log-field">
                    <span class="log-field-label">Response:</span>
                    <pre class="log-code">{formatJson(entry.data.response)}</pre>
                  </div>
                {/if}
                {#if entry.data.error}
                  <div class="log-field log-field-error">
                    <span class="log-field-label">Error:</span>
                    <pre class="log-code log-code-error">{entry.data.error}</pre>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .logging-modal {
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }
  
  .logging-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--glass-border);
    background: var(--glass-bg);
  }
  
  .logging-filters {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .filter-btn {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--txt-secondary);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .filter-btn:hover {
    background: var(--bg-tertiary);
    color: var(--txt-primary);
  }
  
  .filter-btn.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
  }
  
  .filter-request.active { background: var(--state-info); border-color: var(--state-info); }
  .filter-response.active { background: var(--state-success); border-color: var(--state-success); }
  .filter-error.active { background: var(--state-error); border-color: var(--state-error); }
  
  .logging-search {
    flex: 1;
    min-width: 200px;
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .logging-search i {
    position: absolute;
    left: var(--space-3);
    color: var(--txt-muted);
  }
  
  .logging-search input {
    width: 100%;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-8);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--txt-primary);
    font-size: var(--font-size-sm);
  }
  
  .logging-search input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .search-clear {
    position: absolute;
    right: var(--space-2);
    background: none;
    border: none;
    color: var(--txt-muted);
    cursor: pointer;
    padding: var(--space-1);
  }
  
  .logging-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--txt-secondary);
    cursor: pointer;
  }
  
  .toggle-label input {
    cursor: pointer;
  }
  
  .logging-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3);
  }
  
  .logging-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    color: var(--txt-muted);
    text-align: center;
  }
  
  .logging-empty i {
    font-size: 3rem;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }
  
  .logging-empty small {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
  }
  
  .log-entries {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .log-entry {
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    overflow: hidden;
  }
  
  .log-entry.log-request {
    border-left: 3px solid var(--state-info);
  }
  
  .log-entry.log-response {
    border-left: 3px solid var(--state-success);
  }
  
  .log-entry.log-error {
    border-left: 3px solid var(--state-error);
  }
  
  .log-entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .log-entry-header:hover {
    background: var(--bg-tertiary);
  }
  
  .log-entry-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  
  .log-entry-meta i {
    width: 16px;
    text-align: center;
  }
  
  .log-request .log-entry-meta i { color: var(--state-info); }
  .log-response .log-entry-meta i { color: var(--state-success); }
  .log-error .log-entry-meta i { color: var(--state-error); }
  
  .log-type {
    font-weight: var(--font-semibold);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .log-time {
    color: var(--txt-muted);
    font-size: var(--font-size-xs);
    font-family: monospace;
  }
  
  .log-status {
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-family: monospace;
    background: var(--bg-tertiary);
  }
  
  .log-duration {
    color: var(--txt-gold);
    font-size: var(--font-size-xs);
    font-family: monospace;
  }
  
  .log-entry-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .log-entry-body {
    padding: var(--space-3);
    border-top: 1px solid var(--glass-border);
    background: var(--bg-primary);
  }
  
  .log-field {
    margin-bottom: var(--space-3);
  }
  
  .log-field:last-child {
    margin-bottom: 0;
  }
  
  .log-field-label {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--txt-gold);
    margin-bottom: var(--space-1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .log-field-value {
    font-family: monospace;
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    word-break: break-all;
  }
  
  .log-code {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    font-family: monospace;
    font-size: var(--font-size-xs);
    color: var(--txt-secondary);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .log-field-error .log-field-label {
    color: var(--state-error);
  }
  
  .log-code-error {
    border: 1px solid var(--state-error);
    color: var(--state-error);
  }
  
  @media (max-width: 640px) {
    .logging-toolbar {
      flex-direction: column;
    }
    
    .logging-filters {
      width: 100%;
      justify-content: flex-start;
    }
    
    .filter-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>