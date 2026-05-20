// ================================================================================
// ФАЙЛ: src/lib/domain/team-catalog/teamCatalog.store.ts
// Описание: Хранилище каталога для режима "Игра за команду"
// ================================================================================

import { writable, get } from 'svelte/store';
import type { CatalogItemRow, CatalogItemType } from '$lib/db/types';
import { catalogRepo } from '$lib/db/repositories/catalog.repo';
import { ui } from '$lib/ui/ui.store';
import type { TeamCatalogState, TeamSelections, TeamStep, StepConfig, StepFilters, StepRuntime } from './teamCatalog.types';
import { STEP_CONFIG } from './teamCatalog.types';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { isSeeded } from '$lib/domain/seed/catalog.seed';
import type { TeamSelectedItems } from '$lib/domain/team-chat/teamChat.types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_SEED_WAIT_ATTEMPTS = 20;
const SEED_WAIT_INTERVAL = 200;
const MAX_TEAM_SIZE = 10;

function nowIso(): string { return new Date().toISOString(); }
function rid(): string { return Math.random().toString(36).slice(2, 9); }

function makeFilters(): Record<TeamStep, StepFilters> {
  const base = (): StepFilters => ({ search: '', selectedTags: [], onlyCustom: false, sortByDate: false, activeLetter: null });
  return { 1: base(), 2: base() };
}

function makeRuntime(): Record<TeamStep, StepRuntime> {
  const base = (): StepRuntime => ({ items: [], allTags: [], allLetters: [], hasMore: true, isLoading: false, page: 0 });
  return { 1: base(), 2: base() };
}

const initialState: TeamCatalogState = {
  ready: false,
  step: 1,
  selections: { 1: [], 2: null },
  filters: makeFilters(),
  runtime: makeRuntime()
};

export function createTeamCatalogStore() {
  const store = writable<TeamCatalogState>(initialState);
  const { subscribe, update } = store;

  // Защита от параллельных initStep для одного и того же шага
  const initInProgress: Record<number, boolean> = {};

  // Кэш флагов наличия пользовательских карточек
  const hasCustomFlags: Record<number, boolean> = { 1: false, 2: false };

  async function updateCustomFlag(step: TeamStep) {
    const type = STEP_CONFIG[step].type;
    const items = await catalogRepo.listUserItems(type);
    hasCustomFlags[step] = items.length > 0;
  }

  async function initStep(step: TeamStep): Promise<void> {
    if (initInProgress[step]) return;
    initInProgress[step] = true;

    try {
      const cfg = STEP_CONFIG[step];
      const type = cfg.type;

      // Обновляем флаг наличия пользовательских карточек для текущего шага
      await updateCustomFlag(step);

      const [tags, letters] = await Promise.all([
        catalogRepo.getUniqueTags(type),
        catalogRepo.getUniqueLetters(type)
      ]);

      update(s => ({
        ...s,
        runtime: {
          ...s.runtime,
          [step]: {
            ...s.runtime[step] || { items: [], allTags: [], allLetters: [], hasMore: true, isLoading: false, page: 0 },
            allTags: tags,
            allLetters: letters
          }
        }
      }));

      await loadPage(step, true);
    } finally {
      initInProgress[step] = false;
    }
  }

  async function loadPage(step: TeamStep, reset = false): Promise<void> {
    let s = get(store);
    let rt = s.runtime[step];

    if (rt.isLoading || (!rt.hasMore && !reset)) return;

    update(st => ({
      ...st,
      runtime: { ...st.runtime, [step]: { ...st.runtime[step], isLoading: true } }
    }));

    const limit = STEP_CONFIG[step].pageSize;
    s = get(store);
    rt = s.runtime[step];
    const offset = reset ? 0 : rt.items.length;

    try {
      const newItems = await catalogRepo.findItems({
        type: STEP_CONFIG[step].type,
        offset,
        limit,
        search: s.filters[step].search,
        tags: s.filters[step].selectedTags,
        letter: s.filters[step].activeLetter,
        sortByDate: s.filters[step].sortByDate,
        onlyCustom: s.filters[step].onlyCustom // <-- ИСПРАВЛЕНИЕ: Передаем параметр фильтрации "Мои"
      });

      update(st => {
        const current = st.runtime[step];
        return {
          ...st,
          runtime: {
            ...st.runtime,
            [step]: {
              ...current,
              items: reset ? newItems : [...current.items, ...newItems],
              hasMore: newItems.length === limit,
              isLoading: false,
              page: reset ? 1 : (current.page + 1)
            }
          }
        };
      });
    } catch (e) {
      console.error('[TeamCatalogStore] loadPage error', e);
      ui.notify('Ошибка загрузки данных', 'error');
      update(st => ({
        ...st,
        runtime: { ...st.runtime, [step]: { ...st.runtime[step], isLoading: false } }
      }));
    }
  }

  function applyFilters(step: TeamStep): void {
    loadPage(step, true);
  }

  return {
    subscribe,
    MAX_AVATAR_SIZE,

    async init(): Promise<void> {
      const currentState = get(store);
      if (currentState.ready) return;

      let waitAttempts = 0;
      while (!isSeeded() && waitAttempts < MAX_SEED_WAIT_ATTEMPTS) {
        await new Promise(r => setTimeout(r, SEED_WAIT_INTERVAL));
        waitAttempts++;
      }

      update(s => ({ ...s, ready: true }));
      await initStep(get(store).step);
    },

    resetCatalog(): void {
      update(s => ({
        ...s,
        step: 1,
        selections: { 1: [], 2: null }
      }));
    },

    initStep,

    setStep(step: TeamStep): void {
      const oldStep = get(store).step;
      if (oldStep === step) return;
      update(s => ({ ...s, step }));
      initStep(step);
    },

    // Одиночный выбор (для шага 2 - Сцена)
    select(step: TeamStep, item: CatalogItemRow): void {
      if (step === 2) {
        update(s => ({
          ...s,
          selections: { ...s.selections, 2: item }
        }));
      }
    },

    isAllSelected(): boolean {
      const s = get(store);
      return (s.selections[1]?.length > 0) && !!s.selections[2];
    },

    getSelections(): TeamSelections {
      return get(store).selections;
    },

    setSearch(step: TeamStep, q: string): void {
      update(s => ({
        ...s,
        filters: { ...s.filters, [step]: { ...s.filters[step], search: q } }
      }));
      applyFilters(step);
    },

    clearFilters(step: TeamStep): void {
      update(s => ({
        ...s,
        filters: {
          ...s.filters,
          [step]: { search: '', selectedTags: [], onlyCustom: false, sortByDate: false, activeLetter: null }
        }
      }));
      applyFilters(step);
    },

    toggleNew(step: TeamStep): void {
      update(s => {
        const prev = s.filters[step];
        const sortByDate = !prev.sortByDate;
        return {
          ...s,
          filters: {
            ...s.filters,
            [step]: { ...prev, sortByDate, selectedTags: sortByDate ? [] : prev.selectedTags, onlyCustom: sortByDate ? false : prev.onlyCustom, activeLetter: null }
          }
        };
      });
      applyFilters(step);
    },

    toggleCustom(step: TeamStep): void {
      update(s => {
        const prev = s.filters[step];
        const onlyCustom = !prev.onlyCustom;
        return { ...s, filters: { ...s.filters, [step]: { ...prev, onlyCustom, sortByDate: onlyCustom ? false : prev.sortByDate, activeLetter: null } } };
      });
      applyFilters(step);
    },

    toggleTag(step: TeamStep, tag: string): void {
      update(s => {
        const prev = s.filters[step];
        const selected = prev.selectedTags.slice();
        const i = selected.indexOf(tag);
        if (i === -1) selected.push(tag);
        else selected.splice(i, 1);
        return { ...s, filters: { ...s.filters, [step]: { ...prev, selectedTags: selected, sortByDate: false, activeLetter: null } } };
      });
      applyFilters(step);
    },

    getTagsForStep(step: TeamStep): string[] { return get(store).runtime[step]?.allTags || []; },
    
    // ИСПРАВЛЕНИЕ: Реальная проверка наличия пользовательских карточек по кэшу БД
    hasCustomForStep(step: TeamStep): boolean { 
      return hasCustomFlags[step] || false; 
    },

    getLettersForStep(step: TeamStep): string[] { return get(store).runtime[step]?.allLetters || []; },
    getFilters(step: TeamStep) { return get(store).filters[step]; },

    loadMore(step: TeamStep): void {
      loadPage(step, false);
    },

    async ensureLetterVisible(step: TeamStep, letter: string): Promise<void> {
      update(s => ({
        ...s,
        filters: { ...s.filters, [step]: { ...s.filters[step], activeLetter: letter } }
      }));
      applyFilters(step);
    },

    async addItem(type: CatalogItemType, data: { name: string; description: string; tags: string[]; avatar?: string; }, autoSelectStep?: TeamStep): Promise<CatalogItemRow> {
      const existing = await catalogRepo.findItems({ type, offset: 0, limit: 1, search: data.name });
      if (existing.length > 0 && existing[0].name.toLowerCase() === data.name.toLowerCase()) {
        throw new Error(`Элемент с именем «${data.name}» уже существует`);
      }

      const item: CatalogItemRow = {
        id: `user_${type}_${Date.now()}_${rid()}`,
        type,
        name: data.name,
        description: data.description,
        tags: data.tags,
        avatar: data.avatar,
        meta: { author: 'user', createdAt: nowIso(), updatedAt: nowIso() }
      };

      const saved = await catalogRepo.upsert(item);
      const step = autoSelectStep || get(store).step;
      
      await updateCustomFlag(step);
      await initStep(step);

      if (autoSelectStep === 2) {
        this.select(autoSelectStep, saved);
      } else if (autoSelectStep === 1) {
        this.toggleCharacter(saved);
      }

      ui.notify(`«${saved.name}» создано!`, 'success');
      return saved;
    },

    async editItem(id: string, data: Partial<CatalogItemRow>): Promise<void> {
      const existing = await catalogRepo.getById(id);
      if (!existing) throw new Error('Элемент не найден');

      const updated: CatalogItemRow = {
        ...existing,
        ...data,
        meta: {
          ...existing.meta,
          author: 'user', // Помечаем как пользовательский, чтобы защитить от перезаписи сидом
          updatedAt: nowIso()
        }
      };

      await catalogRepo.upsert(updated);
      const step = get(store).step;
      
      await updateCustomFlag(step);
      await initStep(step);

      update(s => {
        const selections = { ...s.selections };
        
        // Обновляем в массиве команды (Шаг 1)
        if (selections[1] && selections[1].length > 0) {
          selections[1] = selections[1].map(c => c.id === id ? updated : c);
        }
        
        // Обновляем сцену (Шаг 2)
        if (selections[2]?.id === id) {
          selections[2] = updated;
        }
        
        return { ...s, selections };
      });

      ui.notify(`«${updated.name}» успешно обновлено`, 'success');
    },

    async deleteItem(id: string): Promise<void> {
      const item = await catalogRepo.getById(id);
      if (!item) throw new Error('Элемент не найден');
      if (item.meta?.author !== 'user') throw new Error('Нельзя удалить базовый элемент');

      await catalogRepo.remove(id);
      const step = get(store).step;

      await updateCustomFlag(step);

      update(s => {
        const selections = { ...s.selections };
        if (selections[1]) {
          selections[1] = selections[1].filter(c => c.id !== id);
        }
        if (selections[2]?.id === id) {
          selections[2] = null;
        }
        return { ...s, selections };
      });

      await initStep(step);
      ui.notify(`«${item.name}» удалён`, 'success');
    },

    async exportUserCards(): Promise<{ version: string; exportDate: string; items: CatalogItemRow[]; }> {
      const items = await catalogRepo.listUserItems();
      return { version: '2.0', exportDate: nowIso(), items };
    },

    async importUserCards(json: any): Promise<{ added: number; skipped: number; errors: number; }> {
      const items = json.items || [];
      if (!Array.isArray(items)) return { added: 0, skipped: 0, errors: 1 };

      const valid = items.filter((i: any) => i.id && i.name && i.type);
      const added = await catalogRepo.bulkUpsert(valid);

      const s = get(store);
      if (s.ready) {
        await updateCustomFlag(s.step);
        await initStep(s.step);
      }

      return { added, skipped: items.length - valid.length, errors: 0 };
    },

    generateScriptOrThrow(): string {
      const s = get(store).selections;
      if (!s[1]?.length || !s[2]) {
        throw new Error('Не все элементы выбраны');
      }
      let script = `Команда персонажей:\n`;
      s[1].forEach((char, idx) => {
        script += `${idx + 1}. ${char.name} — ${char.description || 'Нет описания'}\n`;
      });
      script += `\nСценарий / Сеттинг: ${s[2].name}\n`;
      script += `Описание мира: ${s[2].description || 'Нет описания'}`;
      return script;
    },

    async startSessionFromSelections(): Promise<string> {
      const s = get(store);
      const selections = s.selections;

      if (!selections[1]?.length || !selections[2]) {
        throw new Error('Не все элементы выбраны');
      }

      const teamSelectedItems: TeamSelectedItems = {
        teamCharacters: selections[1],
        scene: selections[2]
      };

      const script = this.generateScriptOrThrow();

      const { teamChatStore } = await import('$lib/domain/team-chat/teamChat.store');
      const { buildTeamSessionRow } = await import('$lib/domain/team-chat/teamChat.sessionRow');
      const { teamSystemPromptStore } = await import('$lib/domain/team-system-prompt/teamSystemPrompt.store');

      const spState = get(teamSystemPromptStore);
      const activeSet = spState.customSets[spState.activeSetId] ||
                        spState.customPresets.find(p => p.id === spState.activeSetId) ||
                        spState.sets.find(p => p.id === spState.activeSetId) ||
                        spState.sets[0];
      
      const basePrompt = activeSet ? activeSet.intro : 'Ты — рассказчик в командной истории.';

      const sessionId = teamChatStore.startNewSession(teamSelectedItems, script, basePrompt);

      await sessionsRepo.save(buildTeamSessionRow());

      return sessionId;
    },

    // ===== СПЕЦИФИЧЕСКИЕ МЕТОДЫ ДЛЯ КОМАНДЫ =====

    getSelectedCount(): number {
      const s = get(store);
      return s.selections[1]?.length || 0;
    },

    isCharacterSelected(id: string): boolean {
      const s = get(store);
      return s.selections[1]?.some(char => char.id === id) || false;
    },

    toggleCharacter(item: CatalogItemRow): void {
      update(s => {
        const current = s.selections[1] || [];
        const exists = current.some(c => c.id === item.id);
        let newSelection: CatalogItemRow[];
        if (exists) {
          newSelection = current.filter(c => c.id !== item.id);
        } else {
          if (current.length >= MAX_TEAM_SIZE) {
            setTimeout(() => ui.notify(`Максимум ${MAX_TEAM_SIZE} персонажей`, 'warning'), 0);
            return s;
          }
          newSelection = [...current, item];
        }
        return {
          ...s,
          selections: { ...s.selections, 1: newSelection }
        };
      });
    }
  };
}

export const teamCatalogStore = createTeamCatalogStore();
export { STEP_CONFIG } from './teamCatalog.types';