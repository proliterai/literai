<!--
  ФАЙЛ: src/lib/components/modals/ScriptModal.svelte
  Описание: Модальное окно скрипта для ролевого режима.
  Включает системный промпт, лорбук и читмод с обновленной системой отношений (NPC и пресеты).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ui } from '$lib/ui/ui.store';
  import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
  import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
  import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
  import { chatStore } from '$lib/domain/chat/chat.store';
  import VectorSettings from '$lib/components/lorebook/VectorSettings.svelte';

  type Tab = 'system-prompt' | 'cheatmode' | 'lorebook';
  let tab = $state<Tab>('system-prompt');

  // --- Системный промпт ---
  let promptText = $state('');
  let sp = $derived($systemPromptStore);
  let activeSystemPreset = $derived(
    sp.presets.find((p) => p.id === sp.activePresetId) ??
    sp.customPresets.find((p) => p.id === sp.activePresetId) ??
    sp.presets[0] ?? null
  );
  let isPromptCustomized = $derived(!!sp.customPrompts?.[sp.activePresetId]);

  let newPromptName = $state('');
  let showSavePromptInput = $state(false);
  let promptFileEl = $state<HTMLInputElement>();

  // --- Читмод (Мир) ---
  let newWorldTrait = $state('');
  let cm = $derived($cheatmodeStore);
  let activeCheatPreset = $derived(cm.activePresetData);

  let newPresetName = $state('');
  let showSavePresetInput = $state(false);
  let cheatFileEl = $state<HTMLInputElement>();

  // --- Читмод (Отношения) ---
  let relSourceName = $state('');
  let relTargetName = $state('');
  let relPresetId = $state(''); // ID выбранного пресета отношений
  let newRelTraitInputs = $state<Record<string, string>>({});

  // Переменные для сохранения пресета отношений
  let newRelPresetName = $state('');
  let showSaveRelPresetInputId = $state<string | null>(null);
  let relPresetFileEl = $state<HTMLInputElement>();

  // --- Lorebook ---
  let lbFile = $state<HTMLInputElement>();
  let lb = $derived($lorebookStore);

  // Определение, находимся ли мы на странице чата
  const isChatRoute = $derived(
    $page.url.pathname.startsWith('/roleplay/chat/') ||
    $page.url.pathname.startsWith('/chat/')
  );
  let chatState = $derived($chatStore);

  // Состояние для выпадающих меню
  let promptSelectorOpen = $state(false);
  let cheatSelectorOpen = $state(false);

  // Синхронизация promptText
  $effect(() => {
    if (activeSystemPreset) {
      const custom = sp.customPrompts?.[sp.activePresetId];
      promptText = typeof custom === 'string' ? custom : activeSystemPreset.content;
    }
  });

  function closeSelectors() {
    promptSelectorOpen = false;
    cheatSelectorOpen = false;
  }

  onMount(async () => {
    await cheatmodeStore.loadPresets('roleplay');
    if (!lb.ready) await lorebookStore.init();

    if (isChatRoute && chatState.selectedItems) {
      cheatmodeStore.loadCharactersFromSelections(chatState.selectedItems);
    }

    function handleCloseSelectors() {
      promptSelectorOpen = false;
      cheatSelectorOpen = false;
    }
    window.addEventListener('close-preset-selectors', handleCloseSelectors);

    function handleDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.preset-selector-wrapper')) {
        closeSelectors();
      }
    }
    document.addEventListener('click', handleDocClick);

    return () => {
      window.removeEventListener('close-preset-selectors', handleCloseSelectors);
      document.removeEventListener('click', handleDocClick);
    };
  });

  function downloadJson(obj: any, filename: string) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Обработчики системного промпта ---
  function handleSetActivePreset(id: string) {
    systemPromptStore.setActivePreset(id);
    promptSelectorOpen = false;
  }

  function handleSaveCustomPrompt() {
    systemPromptStore.saveCustom(promptText);
  }

  function handleResetPrompt() {
    systemPromptStore.resetToDefault();
  }

  function handleSaveAsNewPreset() {
    if (!newPromptName.trim()) {
      ui.notify('Введите название пресета', 'warning');
      return;
    }
    systemPromptStore.saveAsCustomPreset(newPromptName, promptText);
    newPromptName = '';
    showSavePromptInput = false;
  }

  function handleDeletePromptPreset() {
    if (confirm('Удалить этот пресет?')) {
      systemPromptStore.deleteCustomPreset(sp.activePresetId);
    }
  }

  function handleExportPrompt() {
    const data = {
      type: 'system_prompt_preset',
      name: activeSystemPreset?.name || 'Пресет',
      content: promptText
    };
    downloadJson(data, `prompt_export_${Date.now()}.json`);
  }

  function handleImportPrompt(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        systemPromptStore.importPreset(JSON.parse(text));
      } catch (err) {
        ui.notify('Ошибка чтения файла', 'error');
      }
    });
    (e.target as HTMLInputElement).value = '';
  }

  // --- Обработчики для читмода (Мир) ---
  function handlePresetSelect(presetId: string) {
    cheatmodeStore.setActivePreset(presetId);
    cheatSelectorOpen = false;
  }

  function handleSaveCustomPreset() {
    if (!newPresetName.trim()) {
      ui.notify('Введите название пресета', 'warning');
      return;
    }
    cheatmodeStore.saveCurrentAsCustomPreset(newPresetName);
    newPresetName = '';
    showSavePresetInput = false;
  }

  function handleDeleteCustomPreset() {
    if (cm.activePresetId && cm.activePresetId.startsWith('custom_')) {
      if (confirm('Удалить этот пресет?')) {
        cheatmodeStore.deleteCustomPreset(cm.activePresetId);
      }
    }
  }

  function handleAddWorldTrait() {
    if (newWorldTrait.trim()) {
      cheatmodeStore.addCustomTrait(newWorldTrait.trim(), 50);
      newWorldTrait = '';
    }
  }

  function handleExportCheatPreset() {
    if (!activeCheatPreset) {
      ui.notify('Нет активного пресета для экспорта', 'warning');
      return;
    }
    const data = {
      type: 'cheatmode_preset',
      name: activeCheatPreset.name,
      description: activeCheatPreset.description,
      icon: activeCheatPreset.icon,
      worldTraits: activeCheatPreset.worldTraits
    };
    downloadJson(data, `cheatmode_export_${Date.now()}.json`);
  }

  function handleImportCheatPreset(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        cheatmodeStore.importPreset(JSON.parse(text));
      } catch (err) {
        ui.notify('Ошибка чтения файла', 'error');
      }
    });
    (e.target as HTMLInputElement).value = '';
  }

  // --- Обработчики для читмода (Отношения) ---
  function updateNewRelTraitInput(relId: string, value: string) {
    newRelTraitInputs[relId] = value;
    newRelTraitInputs = { ...newRelTraitInputs };
  }

  function handleAddRelationshipTrait(relId: string) {
    const traitName = newRelTraitInputs[relId]?.trim();
    if (traitName) {
      cheatmodeStore.addRelationshipTrait(relId, traitName, 50);
      updateNewRelTraitInput(relId, '');
    }
  }

  function handleCreateRelationshipAdvanced() {
    if (!relSourceName.trim() || !relTargetName.trim()) {
      ui.notify('Укажите имена обоих участников', 'warning');
      return;
    }
    if (relSourceName.trim().toLowerCase() === relTargetName.trim().toLowerCase()) {
      ui.notify('Выберите разных персонажей', 'warning');
      return;
    }
    
    // ИСПРАВЛЕНО: Передача 3 отдельных строковых аргументов
    cheatmodeStore.createRelationshipAdvanced(
      relSourceName.trim(), 
      relTargetName.trim(), 
      relPresetId || undefined
    );
    
    relTargetName = '';
  }

  function handleSaveRelPreset(relId: string, traits: any[]) {
    if (!newRelPresetName.trim()) {
      ui.notify('Введите название шаблона', 'warning');
      return;
    }
    cheatmodeStore.saveCurrentAsRelationshipPreset(newRelPresetName, traits);
    newRelPresetName = '';
    showSaveRelPresetInputId = null;
    ui.notify('Шаблон сохранен', 'success');
  }

  function handleExportRelPreset(preset: any) {
    downloadJson(preset, `relationship_preset_${Date.now()}.json`);
  }

  function handleExportAllRelPresets() {
    if (!cm.customRelationshipPresets || cm.customRelationshipPresets.length === 0) {
      ui.notify('Нет пользовательских шаблонов для экспорта', 'warning');
      return;
    }
    const data = {
      type: 'relationship_presets_export',
      presets: cm.customRelationshipPresets
    };
    downloadJson(data, `relationship_presets_${Date.now()}.json`);
  }

  function handleImportRelPreset(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        cheatmodeStore.importRelationshipPreset(JSON.parse(text));
      } catch (err) {
        ui.notify('Ошибка импорта шаблона отношений', 'error');
      }
    });
    (e.target as HTMLInputElement).value = '';
  }

  // --- Lorebook ---
  async function handleLorebookFile(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const f = target.files?.[0];
    if (f) {
      await lorebookStore.loadFromFile(f);
      target.value = '';
    }
  }
</script>

<div class="modal-panel script-modal">
  <div class="modal-header">
    <h3><i class="fas fa-scroll"></i> Скрипт</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}><i class="fas fa-times"></i></button>
  </div>

  <div class="tab-nav">
    <button class="tab-btn {tab === 'system-prompt' ? 'active' : ''}" onclick={() => (tab = 'system-prompt')}>
      <i class="fas fa-pen-nib"></i> Промпт
    </button>
    <button class="tab-btn {tab === 'cheatmode' ? 'active' : ''}" onclick={() => {
      tab = 'cheatmode';
      // ИСПРАВЛЕНИЕ: Используем cm.runtime.actors вместо cm.runtime.characters
      if (isChatRoute && (!cm.runtime.actors || cm.runtime.actors.length < 2) && chatState.selectedItems) {
        cheatmodeStore.loadCharactersFromSelections(chatState.selectedItems);
      }
    }}>
      <i class="fas fa-gamepad"></i> Читмод
    </button>
    <button class="tab-btn {tab === 'lorebook' ? 'active' : ''}" onclick={() => (tab = 'lorebook')}>
      <i class="fas fa-book"></i> Лорбук
    </button>
  </div>

  <div class="tab-content-area custom-scrollbar" style="overflow-y: auto;">
    <!-- ===== SYSTEM PROMPT ===== -->
    {#if tab === 'system-prompt'}
      {#if !sp.loaded || sp.presets.length === 0}
        <p class="panel-placeholder"><i class="fas fa-spinner fa-spin"></i> Загрузка пресетов...</p>
      {:else}
        <!-- Выпадающее меню системных промптов -->
        <div class="preset-selector-wrapper">
          <button
            class="preset-selector-trigger {promptSelectorOpen ? 'active' : ''}"
            type="button"
            onclick={() => { promptSelectorOpen = !promptSelectorOpen; cheatSelectorOpen = false; }}
            aria-expanded={promptSelectorOpen}
          >
            <div class="preset-selector-trigger-content">
              <i class="preset-selector-trigger-icon fas {activeSystemPreset?.icon || 'fa-pen'}"></i>
              <span class="preset-selector-trigger-text">{activeSystemPreset?.name || 'Выберите пресет'}</span>
            </div>
            <i class="preset-selector-trigger-arrow fas fa-chevron-down"></i>
          </button>
          {#if promptSelectorOpen}
            <div class="preset-selector-dropdown open">
              <!-- Пользовательские пресеты -->
              {#if sp.customPresets.length > 0}
                <div class="preset-group">Мои пресеты</div>
                {#each sp.customPresets as p (p.id)}
                  <button
                    class="preset-selector-option {p.id === sp.activePresetId ? 'active' : ''}"
                    type="button"
                    onclick={() => handleSetActivePreset(p.id)}
                  >
                    <i class="preset-selector-option-icon fas {p.icon || 'fa-star'}"></i>
                    <div class="preset-selector-option-content">
                      <span class="preset-selector-option-text">⭐ {p.name}</span>
                    </div>
                  </button>
                {/each}
              {/if}

              <!-- Системные пресеты -->
              <div class="preset-group">Системные</div>
              {#each sp.presets as p (p.id)}
                <button
                  class="preset-selector-option {p.id === sp.activePresetId ? 'active' : ''}"
                  type="button"
                  onclick={() => handleSetActivePreset(p.id)}
                >
                  <i class="preset-selector-option-icon fas {p.icon || 'fa-pen'}"></i>
                  <div class="preset-selector-option-content">
                    <span class="preset-selector-option-text">{p.name}</span>
                    {#if p.description}
                      <span class="preset-selector-option-description">{p.description}</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Кнопка удаления пользовательского пресета -->
        {#if sp.activePresetId?.startsWith('custom_')}
          <button class="btn-delete-preset" onclick={handleDeletePromptPreset}>
            <i class="fas fa-trash"></i> Удалить этот пресет
          </button>
        {/if}

        {#if activeSystemPreset?.description}
          <p class="preset-description">
            {activeSystemPreset.description}
            {#if isPromptCustomized}
              <span style="color:var(--txt-gold);margin-left:8px"><i class="fas fa-edit"></i> (изменён)</span>
            {/if}
          </p>
        {/if}

        <textarea class="panel-textarea" rows="10" bind:value={promptText} placeholder="Системный промпт рассказчика..."></textarea>

        <!-- Блок сохранения как новый пресет -->
        <div class="save-preset-block">
          {#if showSavePromptInput}
            <input
              class="panel-input"
              type="text"
              placeholder="Название пресета"
              bind:value={newPromptName}
              onkeydown={(e) => e.key === 'Enter' && handleSaveAsNewPreset()}
            />
            <button class="btn-primary btn-sm" onclick={handleSaveAsNewPreset}>
              <i class="fas fa-save"></i> Сохранить
            </button>
            <button class="btn-secondary btn-sm" onclick={() => { showSavePromptInput = false; newPromptName = ''; }}>
              <i class="fas fa-times"></i>
            </button>
          {:else}
            <button class="btn-secondary" onclick={() => showSavePromptInput = true}>
              <i class="fas fa-plus"></i> Сохранить как мой пресет
            </button>
          {/if}
        </div>

        <div class="prompt-actions">
          <!-- Кнопки экспорта/импорта -->
          <div style="display:flex; gap:8px; margin-right:auto;">
            <button class="btn-secondary btn-sm" title="Экспорт пресета" onclick={handleExportPrompt}>
              <i class="fas fa-download"></i> Out
            </button>
            <button class="btn-secondary btn-sm" title="Импорт пресета" onclick={() => promptFileEl?.click()}>
              <i class="fas fa-upload"></i> In
            </button>
            <input type="file" accept=".json" style="display:none" bind:this={promptFileEl} onchange={handleImportPrompt} />
          </div>
          <button class="btn-secondary" onclick={handleResetPrompt}><i class="fas fa-undo"></i> </button>
          <button class="btn-primary" onclick={handleSaveCustomPrompt}><i class="fas fa-check"></i> Ок</button>
        </div>

        {#if isChatRoute}
          <p class="hint-info" style="margin-top:8px;font-size:0.85em;color:var(--txt-muted)">
            <i class="fas fa-info-circle"></i> Изменения промпта сразу применяются к текущему чату.
          </p>
        {/if}
      {/if}

    <!-- ===== CHEATMODE ===== -->
    {:else if tab === 'cheatmode'}
      <div class="cheatmode-layout">
        <p class="tab-subtitle">Выберите пресет мира:</p>
        {#if !cm.loaded}
          <p class="panel-placeholder">Загрузка пресетов...</p>
        {:else}
          <!-- Выпадающее меню пресетов -->
          <div class="preset-selector-wrapper">
            <button
              class="preset-selector-trigger {cheatSelectorOpen ? 'active' : ''}"
              type="button"
              onclick={() => { cheatSelectorOpen = !cheatSelectorOpen; promptSelectorOpen = false; }}
              aria-expanded={cheatSelectorOpen}
            >
              <div class="preset-selector-trigger-content">
                <i class="preset-selector-trigger-icon fas {activeCheatPreset?.icon || 'fa-magic'}"></i>
                <span class="preset-selector-trigger-text">
                  {activeCheatPreset?.name || 'Выберите пресет'}
                </span>
              </div>
              <i class="preset-selector-trigger-arrow fas fa-chevron-down"></i>
            </button>
            {#if cheatSelectorOpen}
              <div class="preset-selector-dropdown open">
                <!-- Пользовательские пресеты -->
                {#if cm.customPresets.length > 0}
                  <div class="preset-group">Мои пресеты</div>
                  {#each cm.customPresets as p (p.id)}
                    <button
                      class="preset-selector-option {p.id === cm.activePresetId ? 'active' : ''}"
                      type="button"
                      onclick={() => handlePresetSelect(p.id)}
                    >
                      <i class="preset-selector-option-icon fas {p.icon || 'fa-star'}"></i>
                      <div class="preset-selector-option-content">
                        <span class="preset-selector-option-text">⭐ {p.name}</span>
                        {#if p.description}
                          <span class="preset-selector-option-description">{p.description}</span>
                        {/if}
                      </div>
                    </button>
                  {/each}
                {/if}

                <!-- Системные пресеты -->
                {#if cm.presets.length > 0}
                  <div class="preset-group">Системные ({cm.currentMode})</div>
                  {#each cm.presets as p (p.id)}
                    <button
                      class="preset-selector-option {p.id === cm.activePresetId ? 'active' : ''}"
                      type="button"
                      onclick={() => handlePresetSelect(p.id)}
                    >
                      <i class="preset-selector-option-icon fas {p.icon || 'fa-magic'}"></i>
                      <div class="preset-selector-option-content">
                        <span class="preset-selector-option-text">{p.name}</span>
                        {#if p.description}
                          <span class="preset-selector-option-description">{p.description}</span>
                        {/if}
                      </div>
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>

          <!-- Кнопка удаления пользовательского пресета -->
          {#if cm.activePresetId?.startsWith('custom_')}
            <button class="btn-delete-preset" onclick={handleDeleteCustomPreset}>
              <i class="fas fa-trash"></i> Удалить этот пресет
            </button>
          {/if}
        {/if}

        <!-- Настройки активного пресета -->
        {#if activeCheatPreset}
          <div class="cheatmode-section">
            <h4><i class="fas fa-globe"></i> Настройки мира: {activeCheatPreset.name}</h4>
            {#each activeCheatPreset.worldTraits as t (t.id)}
              <div class="cheatmode-trait">
                <div class="cheatmode-trait-info">
                  <span class="cheatmode-trait-name">{t.name}</span>
                  <button class="btn-icon" aria-label="Удалить характеристику" title="Удалить" onclick={() => cheatmodeStore.removeTrait(t.id)}>
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
                <div class="cheatmode-trait-control">
                  <input class="panel-range" type="range" min="0" max="100" step="5" value={t.value} oninput={(e) => cheatmodeStore.updateTrait(t.id, Number(e.currentTarget.value))} />
                  <span class="cheatmode-trait-value">{t.value}%</span>
                </div>
              </div>
            {/each}
            <div style="display:flex;gap:8px;margin-top:8px">
              <input class="panel-input" placeholder="Новая характеристика" bind:value={newWorldTrait} />
              <button aria-label="Добавить новую характеристику мира" class="btn-primary btn-sm" onclick={handleAddWorldTrait}>
                <i class="fas fa-check"></i>
              </button>
            </div>
          </div>

          <!-- Кнопка сохранения текущих настроек как новый пресет -->
          <div class="save-preset-block">
            {#if showSavePresetInput}
              <input
                class="panel-input"
                type="text"
                placeholder="Название пресета"
                bind:value={newPresetName}
                onkeydown={(e) => e.key === 'Enter' && handleSaveCustomPreset()}
              />
              <button class="btn-primary btn-sm" onclick={handleSaveCustomPreset}>
                <i class="fas fa-save"></i> Сохранить
              </button>
              <button class="btn-secondary btn-sm" onclick={() => { showSavePresetInput = false; newPresetName = ''; }}>
                <i class="fas fa-times"></i>
              </button>
            {:else}
              <button class="btn-secondary" onclick={() => showSavePresetInput = true}>
                <i class="fas fa-plus"></i> Сохранить как мой пресет
              </button>
            {/if}
          </div>

          <!-- Блок Экспорта и Импорта Читмода -->
          <div class="prompt-actions" style="margin-top: 16px;">
            <div style="display:flex; gap:8px; margin-right:auto;">
              <button class="btn-secondary btn-sm" title="Экспорт пресета" onclick={handleExportCheatPreset}>
                <i class="fas fa-download"></i> Экспорт
              </button>
              <button class="btn-secondary btn-sm" title="Импорт пресета" onclick={() => cheatFileEl?.click()}>
                <i class="fas fa-upload"></i> Импорт
              </button>
              <input type="file" accept=".json" style="display:none" bind:this={cheatFileEl} onchange={handleImportCheatPreset} />
            </div>
          </div>
        {:else}
          <p class="panel-placeholder">Выберите пресет мира для настройки параметров</p>
        {/if}

        <!-- Блок отношений (Обновленный) -->
        <div class="cheatmode-section" style="margin-top:16px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <h4 style="margin:0;"><i class="fas fa-users"></i> Отношения (Персонажи и NPC)</h4>
            <!-- Кнопки экспорта/импорта шаблонов -->
            <div style="display:flex; gap:8px;">
              <button class="btn-secondary btn-sm" title="Экспорт своих шаблонов" onclick={handleExportAllRelPresets}>
                <i class="fas fa-download"></i> Out
              </button>
              <button class="btn-secondary btn-sm" title="Импорт шаблонов" onclick={() => relPresetFileEl?.click()}>
                <i class="fas fa-upload"></i> In
              </button>
              <input type="file" accept=".json" style="display:none" bind:this={relPresetFileEl} onchange={handleImportRelPreset} />
            </div>
          </div>

          {#if !isChatRoute}
            <p class="panel-placeholder"><i class="fas fa-lock"></i> Запустите чат, чтобы настраивать отношения</p>
          {:else}
            <!-- Datalist для автодополнения известных актеров -->
            <datalist id="cm-actors-list">
              {#if cm.runtime.actors}
                {#each cm.runtime.actors as actor}
                  <option value={actor.name}></option>
                {/each}
              {/if}
            </datalist>

            <div class="relationship-creator">
              <div class="modal-field">
                <label for="rel-source">От кого (Имя)</label>
                <input 
                  id="rel-source" 
                  class="panel-input" 
                  list="cm-actors-list" 
                  bind:value={relSourceName} 
                  placeholder="Герой, NPC..." 
                />
              </div>
              <div class="modal-field">
                <label for="rel-target">К кому (Имя)</label>
                <input 
                  id="rel-target" 
                  class="panel-input" 
                  list="cm-actors-list" 
                  bind:value={relTargetName} 
                  placeholder="NPC..." 
                />
              </div>
              <div class="modal-field">
                <label for="rel-preset">Шаблон</label>
                <select id="rel-preset" class="panel-select" bind:value={relPresetId}>
                  <option value="">-- Без шаблона --</option>
                  <!-- Пользовательские шаблоны -->
                  {#if cm.customRelationshipPresets && cm.customRelationshipPresets.length > 0}
                    <optgroup label="Мои шаблоны">
                      {#each cm.customRelationshipPresets as rp}
                        <option value={rp.id}>⭐ {rp.name}</option>
                      {/each}
                    </optgroup>
                  {/if}
                  <!-- Базовые шаблоны -->
                  {#if cm.relationshipPresets && cm.relationshipPresets.length > 0}
                    <optgroup label="Базовые шаблоны">
                      {#each cm.relationshipPresets as rp}
                        <option value={rp.id}>{rp.name}</option>
                      {/each}
                    </optgroup>
                  {/if}
                </select>
              </div>
              <button class="btn-primary" style="margin-top: auto; height: 38px;" onclick={handleCreateRelationshipAdvanced}>
                <i class="fas fa-plus"></i> Создать
              </button>
            </div>

            <!-- Список существующих отношений -->
            {#each cm.runtime.relationships as r (r.id)}
              <div class="cheatmode-relationship-card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span><strong>{r.sourceName}</strong> <i class="fas fa-arrow-right" style="color:var(--txt-muted);font-size:0.8em;margin:0 4px;"></i> <strong>{r.targetName}</strong></span>
                  <button class="btn-icon danger" aria-label="Удалить связь" onclick={() => cheatmodeStore.deleteRelationship(r.id)}>
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
                
                <div class="traits-list" style="margin-top:8px;">
                  {#each r.traits as t (t.id)}
                    <div class="cheatmode-trait small">
                      <span class="cheatmode-trait-name">{t.name}</span>
                      <div class="cheatmode-trait-control">
                        <input class="panel-range" type="range" min="0" max="100" step="5" value={t.value} oninput={(e) => cheatmodeStore.updateRelationshipTrait(r.id, t.id, Number(e.currentTarget.value))} />
                        <span class="cheatmode-trait-value">{t.value}%</span>
                        <button class="btn-icon" aria-label="Удалить" onclick={() => cheatmodeStore.removeRelationshipTrait(r.id, t.id)}>
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>

                <div class="rel-card-footer">
                  <div class="add-trait-box">
                    <input
                      class="panel-input"
                      placeholder="Новая характеристика"
                      value={newRelTraitInputs[r.id] || ''}
                      oninput={(e) => updateNewRelTraitInput(r.id, e.currentTarget.value)}
                    />
                    <button class="btn-secondary btn-sm" aria-label="Добавить характеристику" onclick={() => handleAddRelationshipTrait(r.id)}>
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>

                  <!-- Сохранение этой связи как шаблона -->
                  <div class="save-rel-preset-box">
                    {#if showSaveRelPresetInputId === r.id}
                      <input class="panel-input sm" placeholder="Название шаблона" bind:value={newRelPresetName} />
                      <button class="btn-primary btn-sm" onclick={() => handleSaveRelPreset(r.id, r.traits)}><i class="fas fa-check"></i></button>
                      <button class="btn-secondary btn-sm" onclick={() => { showSaveRelPresetInputId = null; newRelPresetName = ''; }}><i class="fas fa-times"></i></button>
                    {:else}
                      <button class="btn-secondary btn-sm" onclick={() => showSaveRelPresetInputId = r.id} title="Сохранить текущие параметры как шаблон">
                        <i class="fas fa-star"></i> В пресеты
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}

            <!-- Управление пользовательскими шаблонами отношений -->
            {#if cm.customRelationshipPresets && cm.customRelationshipPresets.length > 0}
              <div class="custom-rel-presets-manager">
                <h5>Управление моими шаблонами отношений:</h5>
                <div class="rel-presets-grid">
                  {#each cm.customRelationshipPresets as p (p.id)}
                    <div class="rel-preset-chip">
                      <span class="chip-name">{p.name}</span>
                      <div class="chip-actions">
                        <button class="btn-icon" title="Экспорт шаблона" onclick={() => handleExportRelPreset(p)}><i class="fas fa-download"></i></button>
                        <button class="btn-icon danger" title="Удалить шаблон" onclick={() => cheatmodeStore.deleteRelationshipPreset(p.id)}><i class="fas fa-trash"></i></button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

          {/if}
        </div>
      </div>

    <!-- ===== LOREBOOK ===== -->
    {:else if tab === 'lorebook'}
      <div class="lorebook-header">
        <div class="lorebook-status">
          {#if lb.data?.entries?.length}
            <span class="status-ok"><i class="fas fa-check-circle"></i> {lb.data.name} ({lb.data.entries.length} записей)</span>
          {:else}
            <span class="status-empty"><i class="fas fa-info-circle"></i> Нет активного лорбука</span>
          {/if}
        </div>
        <div class="lorebook-actions">
          {#if lb.data?.entries?.length}
            <button class="btn-secondary btn-sm" aria-label="Очистить" title="Очистить" onclick={() => confirm('Удалить загруженный лорбук?') && lorebookStore.clear()}>
              <i class="fas fa-trash"></i>
            </button>
            <button class="btn-secondary btn-sm" aria-label="Экспорт" title="Экспорт" onclick={() => {
              const data = lorebookStore.exportData();
              if (data) downloadJson(data, `${(data.name || 'lorebook').replace(/\s+/g, '_')}_lorebook.json`);
            }}>
              <i class="fas fa-download"></i>
            </button>
          {/if}
          <button class="btn-primary btn-sm" aria-label="Загрузить" onclick={() => lbFile?.click()}>
            <i class="fas fa-upload"></i> Загрузить
          </button>
          <input bind:this={lbFile} type="file" accept=".json,.txt" style="display:none" onchange={handleLorebookFile} />
        </div>
      </div>
      {#if lb.data}
        <div class="lorebook-stats">
          <span class="stat-item"><i class="fas fa-cog"></i> Глубина: {lb.data.scanDepth}</span>
          <span class="stat-item"><i class="fas fa-coins"></i> Бюджет: {lb.data.tokenBudget}</span>
          <span class="stat-item"><i class="fas fa-toggle-on"></i> Активных: {lb.data.entries.filter((e) => e.enabled).length}</span>
          <span class="stat-item"><i class="fas fa-sync"></i> Рекурсия: {lb.data.recursiveScanning ? 'Вкл' : 'Выкл'}</span>
        </div>

        <!-- 2. ВСТАВЛЯЕМ КОМПОНЕНТ СЮДА -->
                <VectorSettings 
          isVectorizing={lb.isVectorizing} 
          progress={lb.vectorizeProgress} 
          disabled={!lb.data?.entries.length} 
          onVectorize={() => lorebookStore.vectorizeAll()} 
        />

        <div class="lorebook-list">
          {#each lb.data.entries as e (e.uid)}
            <div class="lb-entry-card {!e.enabled ? 'disabled' : ''} {e.constant ? 'constant' : ''}">
              <div class="lb-entry-header">
                <span class="lb-keys">{e.keys.slice(0, 3).join(', ')}{e.keys.length > 3 ? ` +${e.keys.length - 3}` : ''}</span>
                <div class="lb-entry-badges">
                  {#if e.constant}<span class="lb-badge">∞</span>{/if}
                  {#if !e.enabled}<span class="lb-badge">off</span>{/if}
                  <span class="lb-badge">P{e.priority}</span>
                </div>
              </div>
              <div class="lb-entry-content">{e.content.slice(0, 150)}{e.content.length > 150 ? '...' : ''}</div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Стили для селектора пресетов */
  .preset-group {
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    background: var(--bg-surface-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--glass-border);
  }

  .btn-delete-preset {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 1px dashed var(--state-error);
    border-radius: var(--radius-md);
    color: var(--state-error);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-delete-preset:hover {
    background: var(--state-error-bg);
    border-style: solid;
  }

  .save-preset-block {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--glass-border);
  }

  .hint-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--state-info-bg);
    border: 1px solid var(--state-info);
    border-radius: var(--radius-md);
    color: var(--state-info);
  }

  /* Читмод секция */
  .cheatmode-section {
    margin-top: var(--space-4);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .cheatmode-trait {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    padding: var(--space-2);
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
  }

  .cheatmode-trait.small {
    padding: var(--space-1) var(--space-2);
    margin-bottom: var(--space-2);
  }

  .cheatmode-trait-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cheatmode-trait-control {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .cheatmode-trait-value {
    min-width: 3em;
    text-align: right;
  }

  /* Отношения (Новые стили) */
  .relationship-creator {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
    background: var(--bg-secondary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
  }

  .relationship-creator .modal-field {
    flex: 1;
    min-width: 140px;
  }

  .cheatmode-relationship-card {
    margin-top: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--txt-gold);
    box-shadow: var(--shadow-sm);
  }

  .rel-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--glass-border);
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .add-trait-box, .save-rel-preset-box {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .panel-input.sm {
    width: 150px;
  }

  .custom-rel-presets-manager {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--glass-border);
  }

  .custom-rel-presets-manager h5 {
    margin: 0 0 var(--space-2) 0;
    color: var(--txt-secondary);
    font-size: var(--font-size-sm);
  }

  .rel-presets-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .rel-preset-chip {
    display: inline-flex;
    align-items: center;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    padding: 2px 4px 2px 12px;
    font-size: var(--font-size-xs);
  }

  .rel-preset-chip .chip-name {
    color: var(--txt-gold);
    font-weight: 500;
    margin-right: 8px;
  }

  .rel-preset-chip .chip-actions {
    display: flex;
    gap: 2px;
  }

  .rel-preset-chip .btn-icon {
    width: 24px;
    height: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .btn-icon.danger:hover {
    color: var(--state-error);
    background: var(--state-error-bg);
  }

  /* Инпуты */
  .panel-input, .panel-select, .panel-textarea {
    width: 100%;
    padding: var(--space-2);
    background: var(--bg-surface-1);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
  }

  .panel-input:focus, .panel-select:focus {
    border-color: var(--txt-gold);
    outline: none;
  }

  .panel-range {
    flex: 1;
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--txt-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
  }

  .btn-icon:hover {
    background: var(--bg-hover);
    color: var(--state-error);
  }

  .btn-sm {
    padding: 4px 8px;
    font-size: var(--font-size-sm);
  }

  .prompt-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--glass-border);
  }

  @media (max-width: 600px) {
    .rel-card-footer {
      flex-direction: column;
      align-items: stretch;
    }
    .add-trait-box, .save-rel-preset-box {
      width: 100%;
    }
    .add-trait-box input, .save-rel-preset-box input {
      flex: 1;
    }
  }
</style>