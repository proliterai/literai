// ================================================================================
// ФАЙЛ: src/lib/domain/hero-catalog/heroCatalog.store.ts
// Описание: Хранилище каталога для режима "Игра за героя"
// ИСПРАВЛЕНИЯ: 
// 1. Асинхронный экспорт карточек (exportUserCards)
// 2. Реальная проверка наличия пользовательских карточек (hasCustomForStep)
// 3. ДОБАВЛЕНА ПЕРЕДАЧА onlyCustom В БАЗУ ДАННЫХ (Фикс кнопки "Мои")
// 4. ИСПРАВЛЕН ПОИСК В customPresets в методе startSessionFromSelections
// ================================================================================

import { writable, get } from 'svelte/store';
import type { CatalogItemRow, CatalogItemType } from '$lib/db/types';
import { catalogRepo } from '$lib/db/repositories/catalog.repo';
import { ui } from '$lib/ui/ui.store';
import type { HeroCatalogState, HeroSelections, HeroStep, StepConfig, StepFilters, StepRuntime } from './heroCatalog.types';
import { STEP_CONFIG } from './heroCatalog.types';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { isSeeded } from '$lib/domain/seed/catalog.seed';
import type { HeroSelectedItems } from '$lib/domain/hero-chat/heroChat.types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_SEED_WAIT_ATTEMPTS = 20;
const SEED_WAIT_INTERVAL = 200;

function nowIso(): string { return new Date().toISOString(); }
function rid(): string { return Math.random().toString(36).slice(2, 9); }

function makeFilters(): Record<HeroStep, StepFilters> {
  const base = { search: '', selectedTags: [] as string[], onlyCustom: false, sortByDate: false, activeLetter: null as string | null };
  return { 1: { ...base }, 2: { ...base }, 3: { ...base } };
}

function makeRuntime(): Record<HeroStep, StepRuntime> {
  const base = { items: [] as CatalogItemRow[], allTags: [] as string[], allLetters: [] as string[], hasMore: true, isLoading: false, page: 0 };
  return { 1: { ...base }, 2: { ...base }, 3: { ...base } };
}

const initialState: HeroCatalogState = {
  ready: false,
  step: 1,
  selections: { 1: null, 2: null, 3: null },
  filters: makeFilters(),
  runtime: makeRuntime()
};

export function createHeroCatalogStore() {
  const store = writable<HeroCatalogState>(initialState);
  const { subscribe, update } = store;

  // Локальный кеш для флагов наличия кастомных карточек по шагам
  const hasCustomFlags: Record<number, boolean> = { 1: false, 2: false, 3: false };

  async function updateCustomFlag(step: HeroStep) {
    const type = STEP_CONFIG[step].type;
    const items = await catalogRepo.listUserItems(type);
    hasCustomFlags[step] = items.length > 0;
  }

  async function initStep(step: HeroStep): Promise<void> {
    const cfg = STEP_CONFIG[step];
    const type = cfg.type;

    update(s => ({
      ...s,
      runtime: {
        ...s.runtime,
        [step]: s.runtime[step] || { items: [], allTags: [], allLetters: [], hasMore: true, isLoading: false, page: 0 }
      }
    }));

    // Обновляем флаг наличия пользовательских карточек
    await updateCustomFlag(step);

    const [tags, letters] = await Promise.all([
      catalogRepo.getUniqueTags(type),
      catalogRepo.getUniqueLetters(type)
    ]);

    update(s => ({
      ...s,
      runtime: { ...s.runtime, [step]: { ...s.runtime[step], allTags: tags, allLetters: letters } }
    }));

    await loadPage(step, true);
  }

  async function loadPage(step: HeroStep, reset = false): Promise<void> {
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
        onlyCustom: s.filters[step].onlyCustom // <-- ИСПРАВЛЕНИЕ: Теперь фильтр "Мои" передается в БД!
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
      console.error('[HeroCatalogStore] loadPage error', e);
      ui.notify('Ошибка загрузки данных', 'error');
      update(st => ({
        ...st,
        runtime: { ...st.runtime, [step]: { ...st.runtime[step], isLoading: false } }
      }));
    }
  }

  function applyFilters(step: HeroStep): void {
    loadPage(step, true);
  }

  return {
    subscribe,
    MAX_AVATAR_SIZE,

    resetCatalog(): void {
      update(s => ({
        ...s,
        step: 1,
        selections: { 1: null, 2: null, 3: null }
      }));
    },

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

    initStep,

    setStep(step: HeroStep): void {
      const oldStep = get(store).step;
      if (oldStep === step) return;
      update(s => ({ ...s, step }));
      initStep(step);
    },

    select(step: HeroStep, item: CatalogItemRow): void {
      update(s => ({
        ...s,
        selections: { ...s.selections, [step]: item }
      }));
    },

    isAllSelected(): boolean {
      const s = get(store);
      return !!(s.selections[1] && s.selections[2] && s.selections[3]);
    },

    getSelections(): HeroSelections {
      return get(store).selections;
    },

    setSearch(step: HeroStep, q: string): void {
      update(s => ({
        ...s,
        filters: { ...s.filters, [step]: { ...s.filters[step], search: q } }
      }));
      applyFilters(step);
    },

    clearFilters(step: HeroStep): void {
      update(s => ({
        ...s,
        filters: {
          ...s.filters,
          [step]: { search: '', selectedTags: [], onlyCustom: false, sortByDate: false, activeLetter: null }
        }
      }));
      applyFilters(step);
    },

    toggleNew(step: HeroStep): void {
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

    toggleCustom(step: HeroStep): void {
      update(s => {
        const prev = s.filters[step];
        const onlyCustom = !prev.onlyCustom;
        return { ...s, filters: { ...s.filters, [step]: { ...prev, onlyCustom, sortByDate: onlyCustom ? false : prev.sortByDate, activeLetter: null } } };
      });
      applyFilters(step);
    },

    toggleTag(step: HeroStep, tag: string): void {
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

    getTagsForStep(step: HeroStep): string[] { return get(store).runtime[step]?.allTags || []; },
    
    hasCustomForStep(step: HeroStep): boolean { return hasCustomFlags[step] || false; },
    
    getLettersForStep(step: HeroStep): string[] { return get(store).runtime[step]?.allLetters || []; },
    getFilters(step: HeroStep) { return get(store).filters[step]; },

    loadMore(step: HeroStep): void {
      loadPage(step, false);
    },

    async ensureLetterVisible(step: HeroStep, letter: string): Promise<void> {
      update(s => ({
        ...s,
        filters: { ...s.filters, [step]: { ...s.filters[step], activeLetter: letter } }
      }));
      applyFilters(step);
    },

    async addItem(type: CatalogItemType, data: { name: string; description: string; tags: string[]; avatar?: string; }, autoSelectStep?: HeroStep): Promise<CatalogItemRow> {
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

      if (autoSelectStep) this.select(autoSelectStep, saved);
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
          author: 'user', 
          updatedAt: nowIso()
        }
      };

      await catalogRepo.upsert(updated);
      const step = get(store).step;
      
      await updateCustomFlag(step);
      await initStep(step);

      update(s => {
        const selections = { ...s.selections };
        (Object.keys(selections) as unknown as HeroStep[]).forEach(step => {
          if (selections[step]?.id === id) {
            selections[step] = updated;
          }
        });
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
        (Object.keys(selections) as unknown as HeroStep[]).forEach(step => {
          if (selections[step]?.id === id) selections[step] = null;
        });
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
      if (!s[1] || !s[2] || !s[3]) {
        throw new Error('Не все элементы выбраны');
      }
      return `Персонаж и роль:
- Персонаж за которого играет система: ${s[1].name} (${s[1].description || 'Нет описания'})
- Персонаж ${s[1].name} следует новой роли! Роль ${s[1].name} в сюжете: ${s[2].name} (${s[2].description || 'Нет описания'})

- Мир и сценарий в котором действует персонаж: ${s[3].name}
- Описание мира: ${s[3].description || 'Нет описания'}`;
    },

    async startSessionFromSelections(): Promise<string> {
      const s = get(store);
      const selections = s.selections;

      if (!selections[1] || !selections[2] || !selections[3]) {
        throw new Error('Не все элементы выбраны');
      }

      const heroSelectedItems: HeroSelectedItems = {
        heroCharacter: selections[1],
        heroRole: selections[2],
        scene: selections[3]
      };

      const script = this.generateScriptOrThrow();

      const { heroChatStore } = await import('$lib/domain/hero-chat/heroChat.store');
      const { buildHeroSessionRow } = await import('$lib/domain/hero-chat/heroChat.sessionRow');
      const { heroSystemPromptStore } = await import('$lib/domain/hero-chat/heroSystemPrompt.store');

      const spState = get(heroSystemPromptStore);
      const custom = spState.customPrompts[spState.activePresetId];
      
      // ИСПРАВЛЕНИЕ: Поиск в системных и пользовательских пресетах
      const systemFits = spState.presets.find(p => p.id === spState.activePresetId);
      const customFits = spState.customPresets.find(p => p.id === spState.activePresetId);
      const preset = systemFits || customFits;
      
      const basePrompt = typeof custom === 'string'
        ? custom
        : preset?.content || 'Ты — рассказчик в интерактивной истории.';

      const sessionId = heroChatStore.startNewSession(heroSelectedItems, script, basePrompt);

      await sessionsRepo.save(buildHeroSessionRow());

      return sessionId;
    }
  };
}

export const heroCatalogStore = createHeroCatalogStore();
export { STEP_CONFIG } from './heroCatalog.types';