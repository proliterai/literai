// ================================================================================
// ФАЙЛ: src/lib/domain/team-system-prompt/teamSystemPrompt.store.ts
// Описание: Хранилище системных промптов для режима "Игра за команду"
// Добавлена поддержка пользовательских пресетов, экспорта и импорта
// ================================================================================

import { writable, derived, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import type { TeamPromptSet, TeamSystemPromptState } from './teamSystemPrompt.types';

const STORAGE_KEY = 'team_prompt_sets';           // для customSets (временные изменения)
const CUSTOM_PRESETS_KEY = 'custom_team_prompts'; // для пользовательских пресетов
const ACTIVE_SET_KEY = 'team_active_set';

// Дефолтные наборы (заглушка, будут заменены при загрузке из JSON)
const DEFAULT_SETS: TeamPromptSet[] = [
  {
    id: 'default',
    name: 'Дефолтный',
    icon: 'fa-book',
    description: 'Универсальный рассказчик',
    intro: 'Ты ведёшь коллективную художественную историю о нескольких персонажах в интерактивном мире. Твоя задача — запустить сильную сцену начала: показать мир, обстановку, стартовый конфликт, взаимное положение героев, атмосферу момента и первую точку напряжения, от которой история сразу приходит в движение. Пиши как зрелый прозаик для взрослой аудитории: литературно, атмосферно, кинематографично, с вниманием к деталям среды, поведения, взглядов, пауз, интонаций, телесности сцены и эмоциональному тону происходящего. Основное повествование веди от третьего лица. Мысли, сомнения, внутренние реакции персонажей тоже передавай от третьего лица и только в рамках логики их характеров. Ты не просто рассказчик, но и система мира: отыгрывай второстепенных персонажей, случайных свидетелей, противников, союзников, окружение и последствия решений героев. NPC должны вести себя как самостоятельные личности со своими мотивами, интересами, страхами, привычками и манерой речи. Не превращай их в безвольные инструменты сюжета. Покажи сразу несколько действующих фигур в одном пространстве и обозначь, чем они отличаются друг от друга: кто давит, кто наблюдает, кто скрывает, кто действует первым, кто колеблется, кто уже что-то понял раньше остальных. Не пересказывай сухо — создавай живую сцену, которую можно продолжать. Диалоги оформляй через тире с новой строки. Не используй звёздочки, скобки, жирный шрифт и служебный мусор. Пиши чистым литературным текстом, как в романе. Каждый стартовый фрагмент должен заканчиваться сильным крючком: репликой, событием, угрозой, находкой, предложением, столкновением интересов или внезапным поворотом, который требует продолжения.',
    characterActing: 'Ты продолжаешь коллективную историю, но сейчас фокус только на персонаже {CharacterName}. Пиши от третьего лица и веди сцену через его действия, речь, наблюдения, решения, внутренние оценки и инициативу. Этот персонаж должен действовать строго в рамках своего характера, целей, слабостей, привычек, темперамента и текущего эмоционального состояния. Не подменяй его пустым универсальным поведением. Покажи, как именно этот персонаж воспринимает текущую сцену и что он делает в ответ. При этом не забывай, что вокруг находятся другие участники истории: учитывай их присутствие, реплики, давление, ожидания и влияние на ситуацию, но не переключай фокус полностью с {CharacterName}. Если он говорит, оформляй речь через тире. Если он думает, передавай это в литературной форме от третьего лица. Если он действует, описывай конкретно, живо и предметно, а не абстрактно. Не решай за других главных персонажей больше, чем требует естественный отклик сцены. Не обрывай момент на полуслове и не застывай в статике: каждый ответ должен менять положение фигур, усиливать конфликт, раскрывать характер или открывать новый ход в истории. Пиши чистым литературным текстом без звёздочек, скобок и служебной разметки.',
    continuation: 'Ты продолжаешь коллективную историю как рассказчик и оркестратор сцены. Веди повествование от третьего лица, удерживая в поле несколько персонажей одновременно. Показывай, как их решения, реплики, паузы, ошибки и скрытые намерения сталкиваются друг с другом и двигают сюжет. Распределяй внимание между героями естественно: не превращай сцену в набор несвязанных мини-эпизодов, а собирай её в единый поток событий. Отыгрывай NPC как самостоятельных участников мира. Следи за пространством сцены, временем, причинно-следственной связью и эмоциональной динамикой. Если происходит диалог, оформляй его через тире с новой строки. Если сцена требует действия, продвигай её вперёд, а не зависай на описательности ради описательности. Если момент тихий, насыщай его подтекстом, напряжением, наблюдением, скрытым конфликтом или изменением отношений между участниками. Пиши литературно, образно, чисто и без форматного мусора. Строго соблюдай правило показывай, а не рассказывай: вместо сухого называния эмоций или состояний передавай их через язык тела, микромоторику, сбивчивое дыхание, учащенный пульс или то, как персонажи взаимодействуют с пространством и с NPC. Смакуй сенсорный опыт: текстуры поверхностей под пальцами, привкусы на губах, игру света и тени, запахи, вызывающие ассоциации. Используй свежие, нетривиальные метафоры и эпитеты, органично вытекающие из сеттинга. История всегда должна иметь продолжение в дальнейших ответах.'
  }
];

const initialState: TeamSystemPromptState = {
  loaded: false,
  sets: DEFAULT_SETS,
  customPresets: [],
  activeSetId: 'default',
  customSets: {}
};

function getActiveSetFromState(s: TeamSystemPromptState): TeamPromptSet | null {
  // Сначала проверяем customSets (временные изменения активного сета)
  const custom = s.customSets[s.activeSetId];
  if (custom) return custom;

  // Затем пользовательские пресеты
  const customPreset = s.customPresets.find((p) => p.id === s.activeSetId);
  if (customPreset) return customPreset;

  // Наконец системные пресеты
  return s.sets.find((set) => set.id === s.activeSetId) ?? null;
}

export function createTeamSystemPromptStore() {
  const store = writable<TeamSystemPromptState>(initialState);
  const { subscribe, update } = store;

  // Синхронизация с чатом при изменении активного набора
  async function syncPromptToChat() {
    try {
      const { teamChatStore } = await import('$lib/domain/team-chat/teamChat.store');
      if (!teamChatStore.isSessionActive()) return;
      const s = get(store);
      const activeSet = getActiveSetFromState(s);
      if (activeSet) {
        teamChatStore.updateSystemPromptInChat({
          intro: activeSet.intro,
          continuation: activeSet.continuation
        });
      }
    } catch {
      // Чат может быть не инициализирован — игнорируем
    }
  }

  // Загрузка системных пресетов из JSON
  async function loadPresets() {
    loadCustomPresets(); // сначала загружаем пользовательские
    try {
      const resp = await fetch('/data/team-prompts.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const presets = (await resp.json()) as TeamPromptSet[];
      update((s) => ({ ...s, loaded: true, sets: presets }));
    } catch {
      // Если не удалось загрузить, оставляем дефолтные
      update((s) => ({ ...s, loaded: true }));
      ui.notify('Не удалось загрузить пресеты промптов, использую дефолтные', 'warning');
    }
  }

  // Загрузка пользовательских пресетов из localStorage
  function loadCustomPresets() {
    try {
      const saved = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        update((s) => ({ ...s, customPresets: parsed }));
      }
    } catch (e) {
      console.warn('[TeamSystemPrompt] Failed to load custom presets', e);
    }
  }

  // Сохранение пользовательских пресетов в localStorage
  function saveCustomPresets(presets: TeamPromptSet[]) {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
      console.warn('[TeamSystemPrompt] Failed to save custom presets', e);
    }
  }

  // Загрузка сохранённых кастомных сетов (временные изменения) из localStorage
  function loadCustomSets() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        update((s) => ({ ...s, customSets: parsed }));
      }
      const active = localStorage.getItem(ACTIVE_SET_KEY);
      if (active) {
        update((s) => ({ ...s, activeSetId: active }));
      }
    } catch (e) {
      console.warn('[TeamSystemPrompt] Failed to load from storage', e);
    }
  }

  // Сохранение кастомных сетов (временные изменения) в localStorage
  function saveCustomSets(customSets: Record<string, TeamPromptSet>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customSets));
    } catch (e) {
      console.warn('[TeamSystemPrompt] Failed to save to storage', e);
    }
  }

  // Сохранение активного сета
  function saveActiveSetId(id: string) {
    try {
      localStorage.setItem(ACTIVE_SET_KEY, id);
    } catch (e) {
      console.warn('[TeamSystemPrompt] Failed to save active set', e);
    }
  }

  // Получение активного сета (удобно для подписки)
  const activeSet = derived(store, (s) => getActiveSetFromState(s));

  // Получение активного контента (объединённый промпт)
  const activeContent = derived(store, (s) => {
    const set = getActiveSetFromState(s);
    if (!set) return '';
    return `${set.intro}\n\n${set.continuation}`;
  });

  // Установка активного сета
  function setActiveSet(id: string) {
    update((s) => {
      const exists =
        s.sets.some((set) => set.id === id) ||
        s.customPresets.some((set) => set.id === id) ||
        !!s.customSets[id];
      if (!exists) return s;
      return { ...s, activeSetId: id };
    });
    saveActiveSetId(id);
    syncPromptToChat();
  }

  // Сохранение текущих изменений как пользовательский пресет
  function saveAsCustomPreset(
    name: string,
    intro: string,
    characterActing: string,
    continuation: string
  ) {
    const id = `custom_team_${Date.now()}`;
    const newPreset: TeamPromptSet = {
      id,
      name: name || 'Новый пресет',
      icon: 'fa-star',
      intro,
      characterActing,
      continuation
    };

    update((s) => {
      const customPresets = [...s.customPresets, newPreset];
      saveCustomPresets(customPresets);
      return { ...s, customPresets, activeSetId: id };
    });

    saveActiveSetId(id);
    syncPromptToChat();
    ui.notify('Пользовательский пресет сохранён', 'success');
  }

  // Удаление пользовательского пресета
  function deleteCustomPreset(id: string) {
    update((s) => {
      const customPresets = s.customPresets.filter((p) => p.id !== id);
      saveCustomPresets(customPresets);
      const activeSetId = s.activeSetId === id ? 'default' : s.activeSetId;
      return { ...s, customPresets, activeSetId };
    });
    saveActiveSetId(get(store).activeSetId);
    syncPromptToChat();
    ui.notify('Пресет удалён', 'info');
  }

  // Импорт пресета из JSON
  function importPreset(data: any) {
    if (
      data &&
      typeof data.intro === 'string' &&
      typeof data.characterActing === 'string' &&
      typeof data.continuation === 'string'
    ) {
      saveAsCustomPreset(
        data.name || 'Импортированный пресет',
        data.intro,
        data.characterActing,
        data.continuation
      );
    } else {
      ui.notify('Неверный формат файла пресета', 'error');
    }
  }

  // Обновление сета (сохранение временных изменений в customSets)
  function updateSet(setId: string, updates: Partial<TeamPromptSet>) {
    update((s) => {
      const baseSet =
        s.sets.find((set) => set.id === setId) ??
        s.customPresets.find((set) => set.id === setId) ??
        s.customSets[setId];
      if (!baseSet) return s;

      const updatedSet: TeamPromptSet = { ...baseSet, ...updates };
      const customSets = { ...s.customSets, [setId]: updatedSet };
      return { ...s, customSets };
    });
    saveCustomSets(get(store).customSets);
    syncPromptToChat();
  }

  // Сброс конкретного сета к дефолту (удаление кастомной версии)
  function resetSetToDefault(setId: string) {
    update((s) => {
      const customSets = { ...s.customSets };
      delete customSets[setId];
      return { ...s, customSets };
    });
    saveCustomSets(get(store).customSets);
    if (get(store).activeSetId === setId) {
      syncPromptToChat();
    }
    ui.notify('Промпт сброшен к дефолтному', 'success');
  }

  // Сброс всех сетов к дефолту
  function resetAllToDefault() {
    update((s) => ({ ...s, customSets: {} }));
    saveCustomSets({});
    syncPromptToChat();
    ui.notify('Все промпты сброшены к дефолтным', 'success');
  }

  // Алиас для совместимости
  const resetToDefault = resetAllToDefault;

  // Экспорт данных (для сохранения сессии)
  function exportData() {
    const s = get(store);
    return {
      activeSetId: s.activeSetId,
      customSets: s.customSets,
      customPresets: s.customPresets,
      exportedAt: new Date().toISOString()
    };
  }

  // Импорт данных (при загрузке сессии)
  function importData(data?: any) {
    loadCustomPresets();
    if (!data) {
      update((s) => ({ ...s, activeSetId: 'default', customSets: {} }));
      saveActiveSetId('default');
      saveCustomSets({});
      return;
    }

    update((s) => {
      const nextId =
        typeof data.activeSetId === 'string' &&
        (s.sets.some((p) => p.id === data.activeSetId) ||
          s.customPresets.some((p) => p.id === data.activeSetId) ||
          !!data.customSets?.[data.activeSetId])
          ? data.activeSetId
          : s.activeSetId;

      const customSets =
        data.customSets && typeof data.customSets === 'object'
          ? { ...s.customSets, ...data.customSets }
          : s.customSets;

      const customPresets =
        data.customPresets && Array.isArray(data.customPresets)
          ? [...s.customPresets, ...data.customPresets]
          : s.customPresets;

      return { ...s, activeSetId: nextId, customSets, customPresets };
    });

    saveActiveSetId(get(store).activeSetId);
    saveCustomSets(get(store).customSets);
    saveCustomPresets(get(store).customPresets);
  }

  return {
    subscribe,
    loadPresets,
    loadCustomSets,
    activeSet,
    activeContent,
    setActiveSet,
    updateSet,
    resetSetToDefault,
    resetAllToDefault,
    resetToDefault,
    saveAsCustomPreset,
    deleteCustomPreset,
    importPreset,
    exportData,
    importData
  };
}

export const teamSystemPromptStore = createTeamSystemPromptStore();