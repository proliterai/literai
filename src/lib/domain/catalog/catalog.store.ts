// ================================================================================
// ФАЙЛ: src/lib/domain/catalog/catalog.store.ts
// Описание: Хранилище каталога для классического ролевого режима
// ИСПРАВЛЕНИЕ: Учёт пользовательских пресетов (customPresets) при старте сессии
// ================================================================================

import { writable, get } from 'svelte/store';
import type { CatalogItemRow, CatalogItemType } from '$lib/db/types';
import { catalogRepo } from '$lib/db/repositories/catalog.repo';
import { ui } from '$lib/ui/ui.store';
import type {
	CatalogSelections,
	CatalogState,
	CatalogStep,
	StepConfig
} from './catalog.types';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { isSeeded } from '$lib/domain/seed/catalog.seed';

export const STEP_CONFIG: Record<CatalogStep, StepConfig> = {
	1: { step: 1, type: 'character', title: 'Выберите персонажа (За него играет ИИ)', icon: 'fa-robot', pageSize: 20, hasAvatar: true },
	2: { step: 2, type: 'role',     title: 'Выберите роль персонажа ИИ', icon: 'fa-briefcase', pageSize: 20, hasAvatar: false },
	3: { step: 3, type: 'character', title: 'Выберите персонажа (играете вы)', icon: 'fa-user', pageSize: 20, hasAvatar: true },
	4: { step: 4, type: 'role',     title: 'Выберите роль своего персонажа', icon: 'fa-briefcase', pageSize: 20, hasAvatar: false },
	5: { step: 5, type: 'scene',    title: 'Выберите мир или сцену', icon: 'fa-globe', pageSize: 20, hasAvatar: false }
};

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_SEED_WAIT_ATTEMPTS = 20;
const SEED_WAIT_INTERVAL = 200;

function nowIso(): string { return new Date().toISOString(); }
function rid(): string { return Math.random().toString(36).slice(2, 9); }

function makeFilters(): CatalogState['filters'] {
	const base = { search: '', selectedTags: [] as string[], onlyCustom: false, sortByDate: false, activeLetter: null as string | null };
	return { 1: { ...base }, 2: { ...base }, 3: { ...base }, 4: { ...base }, 5: { ...base } };
}

function makeRuntime(): CatalogState['runtime'] {
	const base = { items: [] as CatalogItemRow[], allTags: [] as string[], allLetters: [] as string[], hasMore: true, isLoading: false, page: 0 };
	return { 1: { ...base }, 2: { ...base }, 3: { ...base }, 4: { ...base }, 5: { ...base } };
}

const initialState: CatalogState = {
	ready: false,
	step: 1,
	selections: { 1: null, 2: null, 3: null, 4: null, 5: null },
	filters: makeFilters(),
	runtime: makeRuntime()
};

export function createCatalogStore() {
	const store = writable<CatalogState>(initialState);
	const { subscribe, update } = store;

	// Локальный кеш для флагов наличия кастомных карточек по шагам (Исправление P1.5)
	const hasCustomFlags: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false, 5: false };

	async function updateCustomFlag(step: CatalogStep) {
		const type = STEP_CONFIG[step].type;
		const items = await catalogRepo.listUserItems(type);
		hasCustomFlags[step] = items.length > 0;
	}

	async function initStep(step: CatalogStep): Promise<void> {
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

	async function loadPage(step: CatalogStep, reset = false): Promise<void> {
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
				onlyCustom: s.filters[step].onlyCustom // Исправление P0.3: передаем фильтр onlyCustom
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
			console.error('[CatalogStore] loadPage error', e);
			ui.notify('Ошибка загрузки данных', 'error');
			update(st => ({
				...st,
				runtime: { ...st.runtime, [step]: { ...st.runtime[step], isLoading: false } }
			}));
		} 
	}

	function applyFilters(step: CatalogStep): void {
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

		// Сброс каталога при входе (чтобы не тянулись старые выборы)
		resetCatalog(): void {
			update(s => ({
				...s,
				step: 1,
				selections: { 1: null, 2: null, 3: null, 4: null, 5: null }
			}));
		},
		
		initStep,
		
		setStep(step: CatalogStep): void {
			const oldStep = get(store).step;
			if (oldStep === step) return;
			update(s => ({ ...s, step }));
			initStep(step);
		},
		
		select(step: CatalogStep, item: CatalogItemRow): void {
			update(s => ({
				...s,
				selections: { ...s.selections, [step]: item }
			}));
		},
		
		isAllSelected(): boolean {
			const s = get(store);
			return !!(s.selections[1] && s.selections[2] && s.selections[3] && s.selections[4] && s.selections[5]);
		},
		
		getSelections(): CatalogSelections {
			return get(store).selections;
		},
		
		setSearch(step: CatalogStep, q: string): void {
			update(s => ({ 
				...s, 
				filters: { ...s.filters, [step]: { ...s.filters[step], search: q } } 
			}));
			applyFilters(step);
		},
		
		clearFilters(step: CatalogStep): void {
			update(s => ({
				...s,
				filters: {
					...s.filters,
					[step]: { search: '', selectedTags: [], onlyCustom: false, sortByDate: false, activeLetter: null }
				}
			}));
			applyFilters(step);
		},
		
		toggleNew(step: CatalogStep): void {
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
		
		toggleCustom(step: CatalogStep): void {
			update(s => {
				const prev = s.filters[step];
				const onlyCustom = !prev.onlyCustom;
				return { ...s, filters: { ...s.filters, [step]: { ...prev, onlyCustom, sortByDate: onlyCustom ? false : prev.sortByDate, activeLetter: null } } };
			});
			applyFilters(step);
		},
		
		toggleTag(step: CatalogStep, tag: string): void {
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
		
		getTagsForStep(step: CatalogStep): string[] { 
			return get(store).runtime[step]?.allTags || []; 
		},
		
		// Исправление P1.5: Реальная проверка по кешированному флагу
		hasCustomForStep(step: CatalogStep): boolean { 
			return hasCustomFlags[step] || false;
		},
		
		getLettersForStep(step: CatalogStep): string[] { 
			return get(store).runtime[step]?.allLetters || []; 
		},
		
		getFilters(step: CatalogStep) { 
			return get(store).filters[step]; 
		},
		
		loadMore(step: CatalogStep): void {
			loadPage(step, false);
		},
		
		async ensureLetterVisible(step: CatalogStep, letter: string): Promise<void> {
			update(s => ({
				...s,
				filters: { ...s.filters, [step]: { ...s.filters[step], activeLetter: letter } }
			}));
			applyFilters(step);
		},
		
		async addItem(type: CatalogItemType, data: { name: string; description: string; tags: string[]; avatar?: string; }, autoSelectStep?: CatalogStep): Promise<CatalogItemRow> {
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

		// РЕДАКТИРОВАНИЕ КАРТОЧЕК
		async editItem(id: string, data: Partial<CatalogItemRow>): Promise<void> {
			const existing = await catalogRepo.getById(id);
			if (!existing) throw new Error('Элемент не найден');

			// Обновляем данные и делаем элемент "пользовательским", чтобы сид его не перезаписал
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
			// Перезагружаем текущий шаг
			await initStep(step);

			// Обновляем в выбранных элементах, если он сейчас выбран
			update(s => {
				const selections = { ...s.selections };
				(Object.keys(selections) as unknown as CatalogStep[]).forEach(step => {
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
			
			update(s => {
				const selections = { ...s.selections };
				(Object.keys(selections) as unknown as CatalogStep[]).forEach(step => {
					if (selections[step]?.id === id) selections[step] = null;
				});
				return { ...s, selections };
			});
			
			const step = get(store).step;
			await updateCustomFlag(step);
			await initStep(step);
			ui.notify(`«${item.name}» удалён`, 'success');
		},
		
		// Явное асинхронное получение данных из БД для экспорта
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
			if (!s[1] || !s[2] || !s[3] || !s[4] || !s[5]) {
				throw new Error('Не все элементы выбраны');
			}
			return `Персонажи и роли:
- Персонаж за которого играет система: ${s[1].name} (${s[1].description || 'Нет описания'})
- Персонаж ${s[1].name} строго следует новой роли! Роль ${s[1].name} в сюжете: ${s[2].name} (${s[2].description || 'Нет описания'})

- Персонаж за которого играет пользователь: ${s[3].name} (${s[3].description || 'Нет описания'})
- Персонаж пользователя ${s[3].name} строго следует новой роли. Роль персонажа пользователя в сюжете: ${s[4].name} (${s[4].description || 'Нет описания'})

- Сценарий / Сеттинг: ${s[5].name}
- Описание мира: ${s[5].description || 'Нет описания'}`;
		},
		
		async startSessionFromSelections(): Promise<string> {
			const s = get(store);
			const selections = s.selections;
			
			if (!selections[1] || !selections[2] || !selections[3] || !selections[4] || !selections[5]) {
				throw new Error('Не все элементы выбраны');
			}
			
			const selectedItems = {
				systemCharacter: selections[1], 
				systemRole: selections[2], 
				userCharacter: selections[3], 
				userRole: selections[4], 
				scene: selections[5]
			};
			
			const script = this.generateScriptOrThrow();
			
			// Динамический импорт для предотвращения циклической зависимости
			const { chatStore } = await import('$lib/domain/chat/chat.store');
			const { buildSessionRow } = await import('$lib/domain/chat/chat.sessionRow');
			
			const spState = get(systemPromptStore);
			const custom = spState.customPrompts?.[spState.activePresetId];
			
			// ИСПРАВЛЕНИЕ: проверяем и системные, и пользовательские пресеты
			const preset = spState.presets.find((p) => p.id === spState.activePresetId)
				?? spState.customPresets.find((p) => p.id === spState.activePresetId);
			
			const basePrompt = typeof custom === 'string' 
				? custom 
				: preset?.content ?? 'Вы — ассистент для текстовой ролевой игры.';
			
			// Настоящая активация чата с ветвлениями!
			const sessionId = chatStore.startNewSession(selectedItems, script, basePrompt);
			
			// Автосохраняем сразу, чтобы страница чата могла мгновенно прочитать
			await sessionsRepo.save(buildSessionRow());
			
			return sessionId;
		}
	};
}

export const catalogStore = createCatalogStore();