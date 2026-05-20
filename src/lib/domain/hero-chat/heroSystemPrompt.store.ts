// ================================================================================
// ФАЙЛ: src/lib/domain/hero-chat/heroSystemPrompt.store.ts
// Описание: Хранилище системных промптов для режима "Игра за героя"
// Добавлена поддержка пользовательских пресетов, экспорта и импорта
// ================================================================================

import { writable, derived, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';

export type HeroSystemPromptPreset = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  content: string;
};

type State = {
  loaded: boolean;
  presets: HeroSystemPromptPreset[];          // системные пресеты (из JSON)
  customPresets: HeroSystemPromptPreset[];    // пользовательские пресеты
  activePresetId: string;
  customPrompts: Record<string, string>;      // временные изменения для конкретного пресета
};

const initial: State = {
  loaded: false,
  presets: [],
  customPresets: [],
  activePresetId: 'default',
  customPrompts: {}
};

// Получение активного содержимого с учётом временных изменений
function getActiveContentFromState(s: State): string {
  const custom = s.customPrompts[s.activePresetId];
  if (typeof custom === 'string') return custom;

  const preset = s.presets.find((p) => p.id === s.activePresetId) ||
                 s.customPresets.find((p) => p.id === s.activePresetId);
  return preset?.content ?? '';
}

export function createHeroSystemPromptStore() {
  const store = writable<State>(initial);
  const { subscribe, update } = store;

  // Синхронизация с чатом при изменении промпта
  async function syncPromptToChat() {
    try {
      const { heroChatStore } = await import('$lib/domain/hero-chat/heroChat.store');
      if (!heroChatStore.isSessionActive()) return;
      const s = get(store);
      const content = getActiveContentFromState(s);
      heroChatStore.updateSystemPromptInChat(content);
    } catch {
      // Чат может быть не инициализирован — игнорируем
    }
  }

  // ===== Работа с пользовательскими пресетами (localStorage) =====
  function loadCustomPresets() {
    try {
      const saved = localStorage.getItem('custom_hero_prompts');
      if (saved) {
        update(s => ({ ...s, customPresets: JSON.parse(saved) }));
      }
    } catch (e) {
      console.error('Failed to load custom hero prompts', e);
    }
  }

  function saveCustomPresetsToStorage(presets: HeroSystemPromptPreset[]) {
    try {
      localStorage.setItem('custom_hero_prompts', JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save custom hero prompts', e);
    }
  }

  // ===== Загрузка системных пресетов =====
  async function loadPresets() {
    loadCustomPresets(); // сначала загружаем сохранённые кастомные

    try {
      const resp = await fetch('/data/hero-prompts.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const presets = (await resp.json()) as HeroSystemPromptPreset[];
      update((s) => ({ ...s, loaded: true, presets }));
    } catch {
      // Если не удалось загрузить, создаём дефолтный пресет
      update((s) => ({
        ...s,
        loaded: true,
        presets: [
          {
            id: 'default',
            name: 'Рассказчик',
            icon: 'fa-feather',
            description: 'Базовый рассказчик',
            content: 'Ты — рассказчик в интерактивной истории. Описывай события, локации, NPC и развивай сюжет. После каждого ответа предлагай ровно 2 варианта продолжения для героя.'
          }
        ]
      }));
      ui.notify('Не удалось загрузить пресеты промпта, использую дефолтный', 'warning');
    }
  }

  // Активный пресет (ищется среди системных и пользовательских)
  const activePreset = derived(store, (s) => {
    const found = s.presets.find((p) => p.id === s.activePresetId) ||
                  s.customPresets.find((p) => p.id === s.activePresetId);
    return found ?? s.presets[0] ?? null;
  });

  const activeContent = derived(store, getActiveContentFromState);

  // Установка активного пресета (по ID)
  function setActivePreset(id: string) {
    update((s) => {
      const exists = s.presets.some((p) => p.id === id) || s.customPresets.some((p) => p.id === id);
      return exists ? { ...s, activePresetId: id } : s;
    });
    syncPromptToChat();
  }

  // Сохранение временных изменений для текущего пресета
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

  // Сброс временных изменений к дефолту
  function resetToDefault() {
    update((s) => {
      const customPrompts = { ...s.customPrompts };
      delete customPrompts[s.activePresetId];
      return { ...s, customPrompts };
    });
    ui.notify('Восстановлен дефолтный промпт', 'success');
    syncPromptToChat();
  }

  // Сохранить текущий (редактируемый) промпт как новый пользовательский пресет
  function saveAsCustomPreset(name: string, content: string) {
    const id = `custom_prompt_${Date.now()}`;
    const newPreset: HeroSystemPromptPreset = {
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

  // Удалить пользовательский пресет
  function deleteCustomPreset(id: string) {
    update(s => {
      const customPresets = s.customPresets.filter(p => p.id !== id);
      saveCustomPresetsToStorage(customPresets);
      const activePresetId = s.activePresetId === id ? 'default' : s.activePresetId;
      return { ...s, customPresets, activePresetId };
    });

    ui.notify('Пресет удалён', 'info');
    syncPromptToChat();
  }

  // Импорт пресета из JSON (загруженного пользователем)
  function importPreset(data: any) {
    if (data && data.content) {
      saveAsCustomPreset(data.name || 'Импортированный пресет', data.content);
    } else {
      ui.notify('Неверный формат файла пресета (отсутствует поле content)', 'error');
    }
  }

  // Экспорт данных состояния (для сохранения сессии)
  function exportData() {
    const s = get(store);
    return {
      activePresetId: s.activePresetId,
      customPrompts: s.customPrompts,
      exportedAt: new Date().toISOString()
    };
  }

  // Импорт данных состояния (при загрузке сессии)
  function importData(data?: any) {
    loadCustomPresets(); 
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

export const heroSystemPromptStore = createHeroSystemPromptStore();