// ================================================================================
// ФАЙЛ: src/lib/domain/cheatmode/cheatmode.store.ts
// Описание: Хранилище читмода с поддержкой режимов и пользовательских пресетов
// ИСПРАВЛЕНИЯ:
// - loadPresets всегда устанавливает loaded = true, чтобы избежать вечного спиннера
// - loadCharactersFromSelections заменяет актёров, сохраняя кастомных NPC,
//   и работает иммутабельно (без мутаций)
// - deleteRelationship удаляет неиспользуемых кастомных актёров
// - Все обновления состояния используют копии массивов/объектов
// - Добавлена поддержка AbortSignal для возможности отмены запросов при размонтировании
// ================================================================================
import { writable, derived, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';

export type CheatmodeTrait = {
    id: string;
    name: string;
    value: number;
    isCustom?: boolean;
};

export type CheatmodePreset = {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    worldTraits: CheatmodeTrait[];
};

// ТИПЫ ДЛЯ ОТНОШЕНИЙ
export type CheatmodeActor = {
    id: string;
    name: string;
    avatar?: string;
    sourceType: 'session' | 'custom';
};

export type RelationshipPreset = {
    id: string;
    name: string;
    traits: { name: string; value: number }[];
};

export type CheatmodeRelationship = {
    id: string;
    sourceId: string;
    sourceName: string;
    sourceAvatar?: string;
    targetId: string;
    targetName: string;
    targetAvatar?: string;
    traits: CheatmodeTrait[];
    presetName?: string;
};

type State = {
    loaded: boolean;
    currentMode: 'roleplay' | 'hero' | 'team' | null;
    presets: CheatmodePreset[];
    customPresets: CheatmodePreset[];
    relationshipPresets: RelationshipPreset[];
    customRelationshipPresets: RelationshipPreset[];
    activePresetId: string | null;
    activePresetData: CheatmodePreset | null;
    runtime: {
        actors: CheatmodeActor[];
        relationships: CheatmodeRelationship[];
    };
};

const initial: State = {
    loaded: false,
    currentMode: null,
    presets: [],
    customPresets: [],
    relationshipPresets: [],
    customRelationshipPresets: [],
    activePresetId: null,
    activePresetData: null,
    runtime: { actors: [], relationships: [] }
};

// Вспомогательные функции
function cid() {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function rid() {
    return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(v: number) {
    const n = Number.isFinite(v) ? v : 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function level(value: number) {
    if (value <= 5) return 'отсутствует';
    if (value <= 20) return 'очень низкий';
    if (value <= 30) return 'низкий';
    if (value <= 50) return 'средний';
    if (value <= 75) return 'высокий';
    if (value <= 90) return 'очень высокий';
    return 'максимальный';
}

function validatePresetData(data: any): CheatmodePreset | null {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.id !== 'string' || !data.id) return null;
    if (typeof data.name !== 'string' || !data.name) return null;
    const worldTraits = Array.isArray(data.worldTraits)
        ? data.worldTraits.filter((t: any) =>
            t && typeof t === 'object' &&
            typeof t.id === 'string' &&
            typeof t.name === 'string' &&
            typeof t.value === 'number'
        ).map((t: any) => ({
            id: t.id,
            name: t.name,
            value: clamp(t.value),
            isCustom: !!t.isCustom
        }))
        : [];
    return {
        id: data.id,
        name: data.name,
        icon: typeof data.icon === 'string' ? data.icon : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        worldTraits
    };
}

// Поиск или создание актера
function ensureActor(actors: CheatmodeActor[], name: string): { actor: CheatmodeActor, isNew: boolean } {
    const cleanName = name.trim();
    const existing = actors.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return { actor: existing, isNew: false };
    
    return {
        actor: { id: cid(), name: cleanName, sourceType: 'custom' },
        isNew: true
    };
}

export function createCheatmodeStore() {
    const store = writable<State>(initial);
    const { subscribe, update } = store;

    // ================================================================================
    // Работа с пользовательскими пресетами (localStorage)
    // ================================================================================

    function loadCustomPresetsFromStorage() {
        try {
            const saved = localStorage.getItem('custom_cheatmode_presets');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const valid = parsed
                        .map(validatePresetData)
                        .filter((p): p is CheatmodePreset => p !== null);
                    update(s => ({ ...s, customPresets: valid }));
                }
            }

            const savedRel = localStorage.getItem('custom_relationship_presets');
            if (savedRel) {
                const parsedRel = JSON.parse(savedRel);
                if (Array.isArray(parsedRel)) {
                    update(s => ({ ...s, customRelationshipPresets: parsedRel }));
                }
            }
        } catch (e) {
            console.error('Failed to load custom presets', e);
        }
    }

    function saveCustomPresetsToStorage(presets: CheatmodePreset[]) {
        try {
            localStorage.setItem('custom_cheatmode_presets', JSON.stringify(presets));
        } catch (e) {
            console.error('Failed to save custom presets', e);
        }
    }

    function saveCustomRelationshipPresetsToStorage(presets: RelationshipPreset[]) {
        try {
            localStorage.setItem('custom_relationship_presets', JSON.stringify(presets));
        } catch (e) {
            console.error('Failed to save custom relationship presets', e);
        }
    }

    // ================================================================================
    // Загрузка системных пресетов в зависимости от режима
    // ================================================================================

    async function loadPresets(mode: 'roleplay' | 'hero' | 'team' = 'roleplay', signal?: AbortSignal) {
        loadCustomPresetsFromStorage();
        const s = get(store);
        if (s.loaded && s.currentMode === mode) return;
        
        // Сразу говорим UI, что мы "загрузили" (чтобы спиннер исчез)
        update(state => ({ ...state, loaded: true, currentMode: mode }));
        
        try {
            const resp = await fetch(`/data/cheatmode-${mode}.json`, { signal });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const rawPresets = await resp.json();
            if (!Array.isArray(rawPresets)) throw new Error('Invalid preset format');
            
            const presets = rawPresets
                .map(validatePresetData)
                .filter((p): p is CheatmodePreset => p !== null);

            let relationshipPresets: RelationshipPreset[] = [];
            try {
                const relResp = await fetch('/data/relationship-presets.json', { signal });
                if (relResp.ok) relationshipPresets = await relResp.json();
            } catch (e) {
                console.warn('Не удалось загрузить пресеты отношений, используем фолбэк', e);
                relationshipPresets = [
                    { id: 'default', name: 'Дефолт', traits: [{ name: 'Доверие', value: 50 }, { name: 'Симпатия', value: 50 }] }
                ];
            }

            update(state => ({ ...state, presets, relationshipPresets }));
        } catch (err) {
            console.error(`Failed to load cheatmode presets for mode ${mode}:`, err);
            update(state => ({ ...state, presets: [] }));
            ui.notify(`Не удалось загрузить пресеты читмода для режима: ${mode}`, 'warning');
        }
    }

    // ================================================================================
    // Активный пресет
    // ================================================================================

    function setActivePreset(presetId: string) {
        update(s => {
            const preset = s.presets.find(p => p.id === presetId) || s.customPresets.find(p => p.id === presetId);
            if (!preset) return s;
            return {
                ...s,
                activePresetId: presetId,
                activePresetData: JSON.parse(JSON.stringify(preset))
            };
        });
    }

    function updateTrait(traitId: string, value: number) {
        update(s => {
            if (!s.activePresetData) return s;
            const worldTraits = (s.activePresetData.worldTraits ?? []).map(t =>
                t.id === traitId ? { ...t, value: clamp(value) } : t
            );
            return { ...s, activePresetData: { ...s.activePresetData, worldTraits } };
        });
    }

    function addCustomTrait(name: string, value = 50) {
        const nm = String(name ?? '').trim();
        if (!nm) return;
        update(s => {
            if (!s.activePresetData) return s;
            const worldTraits = [
                ...(s.activePresetData.worldTraits ?? []),
                { id: cid(), name: nm, value: clamp(value), isCustom: true }
            ];
            return { ...s, activePresetData: { ...s.activePresetData, worldTraits } };
        });
    }

    function removeTrait(traitId: string) {
        update(s => {
            if (!s.activePresetData) return s;
            return {
                ...s,
                activePresetData: {
                    ...s.activePresetData,
                    worldTraits: (s.activePresetData.worldTraits ?? []).filter(t => t.id !== traitId)
                }
            };
        });
    }

    // ================================================================================
    // Сохранение текущих настроек как пользовательский пресет
    // ================================================================================

    function saveCurrentAsCustomPreset(name: string, description?: string) {
        const s = get(store);
        if (!s.activePresetData) {
            ui.notify('Сначала выберите или создайте настройки', 'warning');
            return;
        }

        const newPreset: CheatmodePreset = {
            id: `custom_cm_${Date.now()}`,
            name: name.trim() || 'Новый пресет',
            icon: 'fa-star',
            description: description || 'Мой сохранённый пресет',
            worldTraits: JSON.parse(JSON.stringify(s.activePresetData.worldTraits))
        };

        update(st => {
            const customPresets = [...st.customPresets, newPreset];
            saveCustomPresetsToStorage(customPresets);
            return {
                ...st,
                customPresets,
                activePresetId: newPreset.id,
                activePresetData: JSON.parse(JSON.stringify(newPreset))
            };
        });
        ui.notify('Пользовательский пресет сохранён', 'success');
    }

    function deleteCustomPreset(id: string) {
        update(st => {
            const customPresets = st.customPresets.filter(p => p.id !== id);
            saveCustomPresetsToStorage(customPresets);
            let activeId = st.activePresetId;
            let activeData = st.activePresetData;
            if (activeId === id) {
                activeId = null;
                activeData = null;
            }
            return { ...st, customPresets, activePresetId: activeId, activePresetData: activeData };
        });
        ui.notify('Пресет удалён', 'info');
    }

    // ================================================================================
    // Отношения персонажей
    // ================================================================================

    function ensureCharactersFromChat(): Promise<void> {
        return Promise.resolve();
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: полностью заменяет актёров, сохраняя только кастомных NPC
    function loadCharactersFromSelections(selectedItems: any) {
        update(s => {
            const sessionActors: CheatmodeActor[] = [];

            if (selectedItems?.systemCharacter) {
                sessionActors.push({
                    id: selectedItems.systemCharacter.id || 'system',
                    name: selectedItems.systemCharacter.name || 'Система',
                    avatar: selectedItems.systemCharacter.avatar || '',
                    sourceType: 'session'
                });
            }
            if (selectedItems?.userCharacter) {
                sessionActors.push({
                    id: selectedItems.userCharacter.id || 'user',
                    name: selectedItems.userCharacter.name || 'Пользователь',
                    avatar: selectedItems.userCharacter.avatar || '',
                    sourceType: 'session'
                });
            }
            if (selectedItems?.heroCharacter) {
                sessionActors.push({
                    id: selectedItems.heroCharacter.id || 'hero',
                    name: selectedItems.heroCharacter.name || 'Герой',
                    avatar: selectedItems.heroCharacter.avatar || '',
                    sourceType: 'session'
                });
            }
            if (selectedItems?.teamCharacters?.length) {
                selectedItems.teamCharacters.forEach((c: any) => {
                    sessionActors.push({
                        id: c.id || `char_${sessionActors.length}`,
                        name: c.name || 'Персонаж',
                        avatar: c.avatar || '',
                        sourceType: 'session'
                    });
                });
            }

            const customActors = s.runtime.actors.filter(a => a.sourceType === 'custom');
            // Иммутабельное слияние: создаём новые массивы, не мутируем старые
            let merged = [...sessionActors];
            let updatedRelationships = [...s.runtime.relationships]; // копия

            for (const custom of customActors) {
                const existing = merged.find(a => a.name.toLowerCase() === custom.name.toLowerCase());
                if (existing) {
                    if (existing.id !== custom.id) {
                        // обновляем отношения, создавая новые объекты
                        updatedRelationships = updatedRelationships.map(rel => {
                            if (rel.sourceId === custom.id) {
                                return { ...rel, sourceId: existing.id, sourceName: existing.name, sourceAvatar: existing.avatar };
                            }
                            if (rel.targetId === custom.id) {
                                return { ...rel, targetId: existing.id, targetName: existing.name, targetAvatar: existing.avatar };
                            }
                            return rel;
                        });
                    }
                    // кастомного актора не добавляем — он заменён session-актором
                } else {
                    merged.push(custom);
                }
            }

            return {
                ...s,
                runtime: {
                    ...s.runtime,
                    actors: merged,
                    relationships: updatedRelationships
                }
            };
        });
    }

    function createRelationshipAdvanced(sourceName: string, targetName: string, presetId?: string) {
        update(s => {
            const sName = sourceName.trim();
            const tName = targetName.trim();
            if (!sName || !tName || sName.toLowerCase() === tName.toLowerCase()) return s;

            let actors = [...s.runtime.actors];
            const sourceRes = ensureActor(actors, sName);
            if (sourceRes.isNew) actors.push(sourceRes.actor);
            const targetRes = ensureActor(actors, tName);
            if (targetRes.isNew) actors.push(targetRes.actor);

            const exists = s.runtime.relationships.find(r => 
                r.sourceName.toLowerCase() === sName.toLowerCase() && 
                r.targetName.toLowerCase() === tName.toLowerCase()
            );
            if (exists) {
                ui.notify('Связь между этими персонажами уже существует', 'info');
                return { ...s, runtime: { ...s.runtime, actors } };
            }

            let traitsToUse: CheatmodeTrait[] = [{ id: cid(), name: 'Знакомство', value: 50 }];
            let presetName: string | undefined;
            if (presetId) {
                const preset = s.relationshipPresets.find(p => p.id === presetId) || 
                               s.customRelationshipPresets.find(p => p.id === presetId);
                if (preset && preset.traits) {
                    traitsToUse = preset.traits.map(t => ({ id: cid(), name: t.name, value: t.value }));
                    presetName = preset.name;
                }
            }

            const rel: CheatmodeRelationship = {
                id: rid(),
                sourceId: sourceRes.actor.id,
                sourceName: sourceRes.actor.name,
                sourceAvatar: sourceRes.actor.avatar,
                targetId: targetRes.actor.id,
                targetName: targetRes.actor.name,
                targetAvatar: targetRes.actor.avatar,
                traits: traitsToUse,
                presetName
            };

            ui.notify('Зависимость создана', 'success');
            return {
                ...s,
                runtime: { actors, relationships: [...s.runtime.relationships, rel] }
            };
        });
    }

    // Легаси метод
    function createRelationship(sourceId: string, targetId: string) {
        ensureCharactersFromChat();
        update(s => {
            const source = s.runtime.actors.find(c => c.id === sourceId);
            const target = s.runtime.actors.find(c => c.id === targetId);
            if (!source || !target || sourceId === targetId) return s;
            const exists = s.runtime.relationships.find(r => r.sourceId === sourceId && r.targetId === targetId);
            if (exists) return s;
            const rel: CheatmodeRelationship = {
                id: rid(),
                sourceId,
                sourceName: source.name,
                sourceAvatar: source.avatar,
                targetId,
                targetName: target.name,
                targetAvatar: target.avatar,
                traits: [
                    { id: cid(), name: 'Любовь', value: 40 },
                    { id: cid(), name: 'Доверие', value: 50 },
                    { id: cid(), name: 'Верность', value: 50 },
                    { id: cid(), name: 'Страсть', value: 10 }
                ]
            };
            return {
                ...s,
                runtime: { ...s.runtime, relationships: [...s.runtime.relationships, rel] }
            };
        });
    }

    // ИСПРАВЛЕННЫЙ deleteRelationship: удаляет неиспользуемых кастомных актёров
    function deleteRelationship(relId: string) {
        update(s => {
            const newRelationships = s.runtime.relationships.filter(r => r.id !== relId);
            const usedActorIds = new Set<string>();
            for (const rel of newRelationships) {
                usedActorIds.add(rel.sourceId);
                usedActorIds.add(rel.targetId);
            }
            const newActors = s.runtime.actors.filter(a => 
                a.sourceType === 'session' || usedActorIds.has(a.id)
            );
            return {
                ...s,
                runtime: {
                    ...s.runtime,
                    relationships: newRelationships,
                    actors: newActors
                }
            };
        });
    }

    function updateRelationshipTrait(relId: string, traitId: string, value: number) {
        update(s => ({
            ...s,
            runtime: {
                ...s.runtime,
                relationships: s.runtime.relationships.map(r =>
                    r.id !== relId ? r : { ...r, traits: r.traits.map(t => t.id === traitId ? { ...t, value: clamp(value) } : t) }
                )
            }
        }));
    }

    function addRelationshipTrait(relId: string, name: string, value = 50) {
        const nm = String(name ?? '').trim();
        if (!nm) return;
        update(s => ({
            ...s,
            runtime: {
                ...s.runtime,
                relationships: s.runtime.relationships.map(r =>
                    r.id !== relId ? r : { ...r, traits: [...r.traits, { id: cid(), name: nm, value: clamp(value) }] }
                )
            }
        }));
    }

    function removeRelationshipTrait(relId: string, traitId: string) {
        update(s => ({
            ...s,
            runtime: {
                ...s.runtime,
                relationships: s.runtime.relationships.map(r =>
                    r.id !== relId ? r : { ...r, traits: r.traits.filter(t => t.id !== traitId) }
                )
            }
        }));
    }

    function saveCurrentAsRelationshipPreset(name: string, traits: CheatmodeTrait[]) {
        const newPreset: RelationshipPreset = {
            id: `custom_rel_${Date.now()}`,
            name: name.trim() || 'Новый шаблон',
            traits: traits.map(t => ({ name: t.name, value: t.value }))
        };
        update(st => {
            const customRelationshipPresets = [...st.customRelationshipPresets, newPreset];
            saveCustomRelationshipPresetsToStorage(customRelationshipPresets);
            return { ...st, customRelationshipPresets };
        });
    }

    function deleteRelationshipPreset(id: string) {
        update(st => {
            const customRelationshipPresets = st.customRelationshipPresets.filter(p => p.id !== id);
            saveCustomRelationshipPresetsToStorage(customRelationshipPresets);
            return { ...st, customRelationshipPresets };
        });
    }

    function importRelationshipPreset(data: any) {
        let added = 0;
        const newPresets: RelationshipPreset[] = [];
        if (data && data.type === 'relationship_presets_export' && Array.isArray(data.presets)) {
            data.presets.forEach((p: any) => {
                if (p.name && Array.isArray(p.traits)) {
                    newPresets.push({
                        id: `custom_rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        name: p.name,
                        traits: p.traits
                    });
                    added++;
                }
            });
        } else if (data && data.traits && Array.isArray(data.traits)) {
            newPresets.push({
                id: `custom_rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: data.name || 'Импортированный шаблон',
                traits: data.traits
            });
            added++;
        }
        if (added > 0) {
            update(st => {
                const customRelationshipPresets = [...st.customRelationshipPresets, ...newPresets];
                saveCustomRelationshipPresetsToStorage(customRelationshipPresets);
                return { ...st, customRelationshipPresets };
            });
            ui.notify(`Импортировано шаблонов: ${added}`, 'success');
        } else {
            ui.notify('Неверный формат файла шаблона(ов)', 'error');
        }
    }

    // ================================================================================
    // Экспорт/импорт данных
    // ================================================================================

    function exportData() {
        const s = get(store);
        return {
            activePresetId: s.activePresetId,
            activePresetData: s.activePresetData,
            runtimeData: JSON.parse(JSON.stringify(s.runtime)),
            exportedAt: new Date().toISOString()
        };
    }

    function importData(data?: any) {
        loadCustomPresetsFromStorage();
        if (!data) {
            update(s => ({
                ...s,
                activePresetId: null,
                activePresetData: null,
                runtime: { actors: [], relationships: [] }
            }));
            return;
        }
        update(s => {
            let parsedActors: CheatmodeActor[] = [];
            if (data.runtimeData) {
                if (Array.isArray(data.runtimeData.actors)) {
                    parsedActors = data.runtimeData.actors.filter((a: any) => 
                        a && typeof a === 'object' && typeof a.id === 'string' && typeof a.name === 'string');
                } else if (Array.isArray(data.runtimeData.characters)) {
                    parsedActors = data.runtimeData.characters.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        avatar: c.avatar,
                        sourceType: 'session'
                    }));
                }
            }
            const runtime = data.runtimeData && typeof data.runtimeData === 'object'
                ? {
                    actors: parsedActors,
                    relationships: Array.isArray(data.runtimeData.relationships)
                        ? data.runtimeData.relationships.filter((r: any) =>
                            r && typeof r === 'object' && typeof r.id === 'string' &&
                            typeof r.sourceId === 'string' && typeof r.targetId === 'string' &&
                            Array.isArray(r.traits))
                        : []
                }
                : s.runtime;
            const validatedPresetData = data.activePresetData ? validatePresetData(data.activePresetData) : s.activePresetData;
            return {
                ...s,
                runtime,
                activePresetId: typeof data.activePresetId === 'string' ? data.activePresetId : s.activePresetId,
                activePresetData: validatedPresetData
            };
        });
    }

    function importPreset(data: any) {
        if (data && data.worldTraits && Array.isArray(data.worldTraits)) {
            const newPreset: CheatmodePreset = {
                id: `custom_cm_${Date.now()}`,
                name: (data.name || 'Импортированный пресет').trim(),
                icon: data.icon || 'fa-star',
                description: data.description || 'Мой импортированный пресет',
                worldTraits: data.worldTraits.map((t: any) => ({
                    id: cid(), 
                    name: String(t.name || 'Без названия'),
                    value: clamp(Number(t.value) || 50),
                    isCustom: true
                }))
            };
            update(st => {
                const customPresets = [...st.customPresets, newPreset];
                saveCustomPresetsToStorage(customPresets);
                return {
                    ...st,
                    customPresets,
                    activePresetId: newPreset.id,
                    activePresetData: JSON.parse(JSON.stringify(newPreset))
                };
            });
            ui.notify('Пресет читмода успешно импортирован', 'success');
        } else {
            ui.notify('Неверный формат файла пресета читмода', 'error');
        }
    }

    function getContextForPrompt(): string {
        const s = get(store);
        const promptParts: string[] = [];
        if (s.activePresetData && s.activePresetData.worldTraits && s.activePresetData.worldTraits.length > 0) {
            let worldCtx = '[ПАРАМЕТРЫ МИРА И СЕТТИНГА (Шкала от 0% до 100%)]\n';
            s.activePresetData.worldTraits.forEach(t => {
                worldCtx += `- ${t.name}: ${t.value}% (${level(t.value)})\n`;
            });
            promptParts.push(worldCtx.trim());
        }
        if (s.runtime.relationships && s.runtime.relationships.length > 0) {
            let relCtx = '[ОТНОШЕНИЯ ПЕРСОНАЖЕЙ И NPC (Шкала от 0% до 100%)]\n';
            s.runtime.relationships.forEach(r => {
                relCtx += `Отношение: ${r.sourceName} -> ${r.targetName}\n`;
                if (r.traits && r.traits.length > 0) {
                    r.traits.forEach(t => {
                        relCtx += `  - ${t.name}: ${t.value}% (${level(t.value)})\n`;
                    });
                }
            });
            promptParts.push(relCtx.trim());
        }
        return promptParts.join('\n\n');
    }

    const isEnabled = derived(store, s => !!s.activePresetData || (s.runtime.relationships?.length ?? 0) > 0);

    return {
        subscribe,
        loadPresets,
        isEnabled,
        setActivePreset,
        updateTrait,
        addCustomTrait,
        removeTrait,
        saveCurrentAsCustomPreset,
        deleteCustomPreset,
        loadCharactersFromSelections,
        ensureCharactersFromChat,
        createRelationship,
        createRelationshipAdvanced,
        deleteRelationship,
        updateRelationshipTrait,
        addRelationshipTrait,
        removeRelationshipTrait,
        exportData,
        importData,
        importPreset,
        getContextForPrompt,
        saveCurrentAsRelationshipPreset,
        deleteRelationshipPreset,
        importRelationshipPreset
    };
}

export const cheatmodeStore = createCheatmodeStore();