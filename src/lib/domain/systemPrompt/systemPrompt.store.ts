// ================================================================================
// ФАЙЛ: src/lib/domain/systemPrompt/systemPrompt.store.ts
// Описание: Хранилище системных промптов для ролевого режима.
//           Полная поддержка пользовательских пресетов, импорта, экспорта.
// ================================================================================

import { writable, derived, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import type { SystemPromptPreset, SystemPromptState, SystemPromptExportData } from './systemPrompt.types';

const CUSTOM_PRESETS_STORAGE_KEY = 'custom_roleplay_prompts';

const initialState: SystemPromptState = {
  loaded: false,
  presets: [],
  customPresets: [],
  activePresetId: 'default',
  customPrompts: {}
};

function getActiveContentFromState(s: SystemPromptState): string {
  const custom = s.customPrompts[s.activePresetId];
  if (typeof custom === 'string') return custom;

  const preset = s.presets.find((p) => p.id === s.activePresetId) ||
                 s.customPresets.find((p) => p.id === s.activePresetId);
  return preset?.content ?? '';
}

export function createSystemPromptStore() {
  const store = writable<SystemPromptState>(initialState);
  const { subscribe, update } = store;

  // ================================================================================
  // СИНХРОНИЗАЦИЯ С ЧАТОМ
  // ================================================================================
  async function syncPromptToChat() {
    try {
      const { chatStore } = await import('$lib/domain/chat/chat.store');
      if (!chatStore.isSessionActive()) return;
      const s = get(store);
      const content = getActiveContentFromState(s);
      chatStore.updateSystemPromptInChat(content);
    } catch {
      // чат не инициализирован – игнорируем
    }
  }

  // ================================================================================
  // РАБОТА С ПОЛЬЗОВАТЕЛЬСКИМИ ПРЕСЕТАМИ (LOCALSTORAGE)
  // ================================================================================
  function loadCustomPresets() {
    try {
      const saved = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          update(s => ({ ...s, customPresets: parsed }));
        }
      }
    } catch (e) {
      console.error('Failed to load custom prompts', e);
    }
  }

  function saveCustomPresetsToStorage(presets: SystemPromptPreset[]) {
    try {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save custom prompts', e);
    }
  }

  // ================================================================================
  // ЗАГРУЗКА СИСТЕМНЫХ ПРЕСЕТОВ
  // ================================================================================
  async function loadPresets() {
    loadCustomPresets(); // загружаем пользовательские перед системными

    try {
      const resp = await fetch('/data/system-prompts.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const presets = (await resp.json()) as SystemPromptPreset[];
      update((s) => ({ ...s, loaded: true, presets }));
    } catch {
      // Если не удалось загрузить, создаём дефолтный пресет
      update((s) => ({
        ...s,
        loaded: true,
        presets: [
          {
            id: 'default',
            name: 'Дефолтный',
            description: 'Универсальный промпт',
            content: 'Вы — ассистент для текстовой ролевой игры.'
          }
        ]
      }));
      ui.notify('Не удалось загрузить пресеты промпта, использую дефолтный', 'warning');
    }
  }

  // ================================================================================
  // DERIVED STORES
  // ================================================================================
  const activePreset = derived(
    store,
    (s) =>
      s.presets.find((p) => p.id === s.activePresetId) ??
      s.customPresets.find((p) => p.id === s.activePresetId) ??
      s.presets[0] ??
      null
  );

  const activeContent = derived(store, getActiveContentFromState);

  // ================================================================================
  // УПРАВЛЕНИЕ АКТИВНЫМ ПРЕСЕТОМ
  // ================================================================================
  function setActivePreset(id: string) {
    update((s) => {
      const exists = s.presets.some((p) => p.id === id) || s.customPresets.some((p) => p.id === id);
      return exists ? { ...s, activePresetId: id } : s;
    });
    syncPromptToChat();
  }

  // ================================================================================
  // ВРЕМЕННЫЕ ИЗМЕНЕНИЯ (customPrompts)
  // ================================================================================
  function saveCustom(content: string) {
    update((s) => {
      const preset = s.presets.find((p) => p.id === s.activePresetId) ||
                     s.customPresets.find((p) => p.id === s.activePresetId);
      const def = (preset?.content ?? '').trim();
      const customPrompts = { ...s.customPrompts };
      if (!content.trim() || content.trim() === def) {
        delete customPrompts[s.activePresetId];
      } else {
        customPrompts[s.activePresetId] = content;
      }
      return { ...s, customPrompts };
    });
    ui.notify('Промпт обновлён', 'success');
    syncPromptToChat();
  }

  function resetToDefault() {
    update((s) => {
      const customPrompts = { ...s.customPrompts };
      delete customPrompts[s.activePresetId];
      return { ...s, customPrompts };
    });
    ui.notify('Восстановлен дефолтный промпт', 'success');
    syncPromptToChat();
  }

  // ================================================================================
  // СОХРАНЕНИЕ КАК НОВЫЙ ПОЛЬЗОВАТЕЛЬСКИЙ ПРЕСЕТ
  // ================================================================================
  function saveAsCustomPreset(name: string, content: string) {
    const id = `custom_prompt_${Date.now()}`;
    const newPreset: SystemPromptPreset = {
      id,
      name: name || 'Новый пресет',
      icon: 'fa-star',
      content
    };

    update(s => {
      const customPresets = [...s.customPresets, newPreset];
      saveCustomPresetsToStorage(customPresets);
      return { ...s, customPresets, activePresetId: id };
    });

    ui.notify('Пользовательский пресет сохранён', 'success');
    syncPromptToChat();
  }

  // ================================================================================
  // УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО ПРЕСЕТА
  // ================================================================================
  function deleteCustomPreset(id: string) {
    update(s => {
      const customPresets = s.customPresets.filter(p => p.id !== id);
      saveCustomPresetsToStorage(customPresets);

      let activePresetId = s.activePresetId;
      if (s.activePresetId === id) {
        // Если удаляем активный пресет, переключаемся на дефолтный
        activePresetId = 'default';
      }

      return { ...s, customPresets, activePresetId };
    });

    ui.notify('Пресет удалён', 'info');
    syncPromptToChat();
  }

  // ================================================================================
  // ИМПОРТ ПРЕСЕТА ИЗ JSON
  // ================================================================================
  function importPreset(data: any) {
    if (data && typeof data.content === 'string') {
      saveAsCustomPreset(data.name || 'Импортированный пресет', data.content);
    } else {
      ui.notify('Неверный формат файла пресета (ожидается поле "content")', 'error');
    }
  }

  // ================================================================================
  // ЭКСПОРТ ДАННЫХ ДЛЯ СЕССИИ
  // ================================================================================
  function exportData(): SystemPromptExportData {
    const s = get(store);
    return {
      activePresetId: s.activePresetId,
      customPrompts: s.customPrompts,
      exportedAt: new Date().toISOString()
    };
  }

  // ================================================================================
  // ИМПОРТ ДАННЫХ ИЗ СЕССИИ
  // ================================================================================
 function importData(data?: any) {
    loadCustomPresets(); // убеждаемся, что кастомные загружены
    if (!data) {
      update((s) => ({ ...s, activePresetId: 'default', customPrompts: {} }));
      return;
    }
    update((s) => {
      const exists = s.presets.some((p) => p.id === data.activePresetId) ||
                     s.customPresets.some((p) => p.id === data.activePresetId);
      const nextId = typeof data.activePresetId === 'string' && exists
        ? data.activePresetId
        : s.activePresetId;
      const customPrompts =
        data.customPrompts && typeof data.customPrompts === 'object'
          ? Object.fromEntries(Object.entries(data.customPrompts).filter(([, v]) => typeof v === 'string'))
          : {};
      return { ...s, activePresetId: nextId, customPrompts };
    });
  }

  return {
    subscribe,
    loadPresets,
    activePreset,
    activeContent,
    setActivePreset,
    saveCustom,
    resetToDefault,
    saveAsCustomPreset,
    deleteCustomPreset,
    importPreset,
    exportData,
    importData
  };
}

export const systemPromptStore = createSystemPromptStore();