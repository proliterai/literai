<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ProviderRow } from '$lib/db/types';
  import { providersStore } from '$lib/domain/providers/providers.store';
  import { ui } from '$lib/ui/ui.store';

  let savingTimers = $state<Record<string, ReturnType<typeof setTimeout>>>({});
  let pending = $state<Record<string, Partial<Pick<ProviderRow, 'name' | 'url' | 'model' | 'apiKey'>>>>({});
  let testResult = $state<Record<string, { ok: boolean; message: string } | null>>({});
  let testing = $state<Record<string, boolean>>({});
  let showKey = $state<Record<string, boolean>>({});
  let importFileEl = $state<HTMLInputElement>();

  function queueUpdate(id: string, patch: Partial<Pick<ProviderRow, 'name' | 'url' | 'model' | 'apiKey'>>) {
    pending[id] = { ...(pending[id] ?? {}), ...patch };
    if (savingTimers[id]) clearTimeout(savingTimers[id]);
    savingTimers[id] = setTimeout(() => flush(id), 500);
  }

  async function flush(id: string) {
    if (savingTimers[id]) {
      clearTimeout(savingTimers[id]);
      delete savingTimers[id];
    }
    const patch = pending[id];
    if (!patch || !Object.keys(patch).length) return;
    delete pending[id];
    try {
      await providersStore.updateProvider(id, patch);
    } catch (e: any) {
      ui.notify(e.message || 'Ошибка сохранения провайдера', 'error');
    }
  }

  async function runTest(id: string) {
    testing[id] = true;
    testResult[id] = null;
    await flush(id);
    const res = await providersStore.testConnection(id);
    testResult[id] = res;
    ui.notify(res.message, res.ok ? 'success' : 'error');
    testing[id] = false;
    setTimeout(() => { testResult[id] = null; }, 5000);
  }

  function handleExport() {
    const data = providersStore.exportProviders();
    if (data.providers.length === 0) {
      ui.notify('Нет провайдеров для экспорта', 'warning');
      return;
    }
    downloadJson(data, `providers_export_${new Date().toISOString().slice(0, 10)}.json`);
    ui.notify(`Экспортировано ${data.providers.length} провайдеров`, 'success');
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await providersStore.importProviders(json);
      ui.notify(
        `Импортировано: ${result.added}, обновлено: ${result.updated}, пропущено: ${result.skipped}`,
        result.added > 0 || result.updated > 0 ? 'success' : 'info'
      );
    } catch (e: any) {
      ui.notify('Ошибка импорта: ' + (e.message || 'Неверный формат файла'), 'error');
    }
  }

  function downloadJson(obj: any, filename: string) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  onMount(async () => { await providersStore.init(); });

  onDestroy(() => {
    Object.keys(savingTimers).forEach(id => {
      clearTimeout(savingTimers[id]);
      flush(id);
    });
  });

  let s = $derived($providersStore);
</script>

<div class="providers-panel">
  <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="margin: 0;"><i class="fas fa-server"></i> Провайдеры</h4>
    <div style="display: flex; gap: 8px;">
      <button class="btn-secondary" style="padding: 0 12px;" type="button" title="Справка по API" onclick={() => ui.openModal('provider-help')}>
        <i class="fas fa-question"></i>
      </button>
      <button class="btn-primary" type="button" onclick={() => providersStore.addProvider()}>
        <i class="fas fa-plus"></i> Добавить
      </button>
    </div>
  </div>

  <!-- Кнопки экспорта/импорта -->
  <div class="import-export-bar">
    <button class="ie-btn" type="button" onclick={handleExport}>
      <i class="fas fa-file-export"></i> Экспорт
    </button>
    <button class="ie-btn" type="button" onclick={() => importFileEl?.click()}>
      <i class="fas fa-file-import"></i> Импорт
    </button>
    <input
      bind:this={importFileEl}
      type="file"
      accept=".json"
      style="display:none"
      onchange={(e) => {
        const f = e.currentTarget.files?.[0];
        if (f) handleImport(f);
        e.currentTarget.value = '';
      }}
    />
  </div>

  {#if !s.ready}
    <p class="panel-placeholder">Загрузка...</p>
  {:else if s.providers.length === 0}
    <div class="providers-empty">
      <i class="fas fa-server"></i>
      <p>Нет добавленных провайдеров</p>
      <span>Нажмите «Добавить» для начала</span>
    </div>
  {:else}
    <div class="providers-list">
      {#each s.providers as p, idx (p.id)}
        {@const isActive = p.id === s.activeId}
        {@const collapsed = s.collapsed[p.id] ?? true}
        
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="provider-card {isActive ? 'active' : ''} {collapsed ? 'collapsed' : 'expanded'} {s.drag.draggedId === p.id ? 'dragging' : ''} {s.drag.dragOverId === p.id ? 'drag-over' : ''}"
          ondragover={(e) => { e.preventDefault(); providersStore.dragOver(p.id); }}
          ondrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer?.getData('text/plain');
            if (draggedId) providersStore.drop(draggedId, p.id);
          }}
        >
          <div class="provider-card-header">
            <!-- БЛОК УПРАВЛЕНИЯ ПОРЯДКОМ (Стрелки + Перетаскивание) -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="provider-order-controls">
              <button 
                class="order-btn" 
                type="button" 
                disabled={idx === 0} 
                title="Вверх"
                onclick={(e) => { e.stopPropagation(); providersStore.moveProvider(p.id, -1); }}
              >
                <i class="fas fa-caret-up"></i>
              </button>
              
              <div
                class="provider-drag-handle" draggable="true" title="Перетащить"
                ondragstart={(e) => {
                  e.dataTransfer?.setData('text/plain', p.id);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                  providersStore.startDrag(p.id);
                }}
                ondragend={() => providersStore.endDrag()}
              >⋮⋮</div>

              <button 
                class="order-btn" 
                type="button" 
                disabled={idx === s.providers.length - 1} 
                title="Вниз"
                onclick={(e) => { e.stopPropagation(); providersStore.moveProvider(p.id, 1); }}
              >
                <i class="fas fa-caret-down"></i>
              </button>
            </div>

            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="provider-info" onclick={() => !isActive && providersStore.setActive(p.id)}>
              <span class="provider-name">{p.name || 'Без названия'}</span>
              <span class="provider-model">{p.model || 'Модель не указана'}</span>
            </div>

            <span class="provider-status {isActive ? 'active' : 'inactive'}">
              {isActive ? '● On' : '○ Off'}
            </span>

            <div class="provider-header-controls">
              <button aria-label="Свернуть/развернуть" class="btn-icon" type="button" title={collapsed ? 'Развернуть' : 'Свернуть'} onclick={(e) => { e.stopPropagation(); providersStore.toggleCollapse(p.id); }}>
                <i class="fas fa-chevron-{collapsed ? 'down' : 'up'}"></i>
              </button>
              <button aria-label="Удалить провайдера" class="btn-icon btn-delete" type="button" title="Удалить" onclick={async (e) => {
                e.stopPropagation();
                if (!confirm(`Удалить провайдер "${p.name || 'Без названия'}"?`)) return;
                await providersStore.deleteProvider(p.id);
              }}>
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          {#if !collapsed}
            <div class="provider-card-body">
              <div class="provider-field-group">
                <label for="p-name-{p.id}">Название</label>
                <input id="p-name-{p.id}" class="provider-input" value={p.name} placeholder="OpenRouter" oninput={(e) => queueUpdate(p.id, { name: e.currentTarget.value })} onblur={() => flush(p.id)} />
              </div>

              <div class="provider-field-group">
                <label for="p-url-{p.id}">URL API</label>
                <input id="p-url-{p.id}" class="provider-input" value={p.url} placeholder="https://api..." oninput={(e) => queueUpdate(p.id, { url: e.currentTarget.value })} onblur={() => flush(p.id)} />
              </div>

              <div class="provider-field-group">
                <label for="p-model-{p.id}">Модель</label>
                <input id="p-model-{p.id}" class="provider-input" value={p.model} placeholder="anthropic/claude-3.5-sonnet" oninput={(e) => queueUpdate(p.id, { model: e.currentTarget.value })} onblur={() => flush(p.id)} />
              </div>

              <div class="provider-field-group">
                <label for="p-key-{p.id}">API Key</label>
                <div class="provider-key-wrapper">
                  <input id="p-key-{p.id}" class="provider-input" type={showKey[p.id] ? 'text' : 'password'} value={p.apiKey} placeholder="sk-or-..." oninput={(e) => queueUpdate(p.id, { apiKey: e.currentTarget.value })} onblur={() => flush(p.id)} />
                  <button aria-label={showKey[p.id] ? "Скрыть ключ" : "Показать ключ"} class="btn-icon" type="button" onclick={() => (showKey[p.id] = !showKey[p.id])}><i class="fas fa-eye{showKey[p.id] ? '-slash' : ''}"></i></button>
                </div>
              </div>

              <button class="btn-secondary btn-test" type="button" disabled={!!testing[p.id]} onclick={() => runTest(p.id)}>
                {#if testing[p.id]}
                  <i class="fas fa-spinner fa-spin"></i> Проверка...
                {:else}
                  <i class="fas fa-plug"></i> Проверить соединение
                {/if}
              </button>

              {#if testResult[p.id]}
                <div class="test-result {testResult[p.id]?.ok ? 'success' : 'error'}">
                  <i class="fas fa-{testResult[p.id]?.ok ? 'check-circle' : 'exclamation-circle'}"></i> {testResult[p.id]?.message}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>