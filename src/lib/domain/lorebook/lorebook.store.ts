// ================================================================================
// ФАЙЛ: src/lib/domain/lorebook/lorebook.store.ts
// Описание: Хранилище лорбука с поддержкой классического и векторного поиска
// ================================================================================

import { writable, get } from 'svelte/store';
import { settingsRepo } from '$lib/db/repositories/settings.repo';
import { ui } from '$lib/ui/ui.store';
import { embeddingService, cosineSimilarity } from './embedding.service';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { loggingStore } from '$lib/domain/logging/logging.store';

const SETTINGS_KEY = 'active_lorebook_data';

export type LorebookEntry = {
  uid: number | string;
  name: string;
  keys: string[];
  secondaryKeys?: string[];
  content: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  selectiveLogic: number;
  priority: number;
  probability: number;
  caseSensitive: boolean;
  excludeRecursion: boolean;
  vector?: number[]; // <-- Векторное представление текста для семантического поиска
};

export type LorebookData = {
  name: string;
  description?: string;
  scanDepth: number;
  tokenBudget: number;
  recursiveScanning: boolean;
  entries: LorebookEntry[];
  lastModified: string;
};

type State = {
  ready: boolean;
  data: LorebookData | null;
  isVectorizing: boolean;
  vectorizeProgress: { current: number; total: number };
};

const initial: State = { 
  ready: false, 
  data: null,
  isVectorizing: false,
  vectorizeProgress: { current: 0, total: 0 }
};

function nowIso() { return new Date().toISOString(); }

function normalizeEntries(raw: any[]): LorebookEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e, idx) => ({
    uid: e.uid ?? e.id ?? idx + 1,
    name:
      e.name ??
      e.comment ??
      (Array.isArray(e.keys) ? e.keys[0] : '') ??
      `Запись ${idx + 1}`,
    keys: Array.isArray(e.keys)
      ? e.keys
      : e.key
      ? [String(e.key)]
      : [],
    secondaryKeys: Array.isArray(e.secondary_keys)
      ? e.secondary_keys
      : Array.isArray(e.secondaryKeys)
      ? e.secondaryKeys
      : [],
    content: e.content ?? e.text ?? e.description ?? '',
    enabled: e.enabled !== false,
    constant: !!e.constant,
    selective: !!e.selective,
    selectiveLogic: e.selective_logic ?? e.selectiveLogic ?? 0,
    priority: Number(e.priority ?? 10),
    probability: Number(e.probability ?? 100),
    caseSensitive: !!(e.case_sensitive ?? e.caseSensitive),
    excludeRecursion: !!(e.exclude_recursion ?? e.excludeRecursion),
    vector: Array.isArray(e.vector) ? e.vector : undefined
  }));
}

function checkKeys(
  keys: string[],
  text: string,
  textLower: string,
  caseSensitive: boolean
) {
  if (!keys?.length) return false;
  for (const k0 of keys) {
    const k = String(k0 ?? '').trim();
    if (!k) continue;
    const hay = caseSensitive ? text : textLower;
    const key = caseSensitive ? k : k.toLowerCase();
    if (hay.includes(key)) return true;
  }
  return false;
}

function buildContent(entries: LorebookEntry[], budget: number) {
  const maxChars = (budget || 8048) * 4;
  let total = 0;
  const parts: string[] = [];

  for (const e of entries) {
    const c = String(e.content ?? '');
    if (!c.trim()) continue;
    if (total + c.length > maxChars) break;
    parts.push(c);
    total += c.length;
  }

  return {
    content: parts.join('\n\n'),
    estimatedTokens: Math.ceil(total / 4)
  };
}

export function createLorebookStore() {
  const store = writable<State>(initial);
  const { subscribe, update } = store;

  async function init() {
    try {
      const saved = await settingsRepo.get(SETTINGS_KEY);
      if (saved && typeof saved === 'object' && Array.isArray(saved.entries)) {
        update((s) => ({ ...s, ready: true, data: saved as LorebookData }));
      } else {
        update((s) => ({ ...s, ready: true, data: null }));
      }
    } catch {
      update((s) => ({ ...s, ready: true, data: null }));
    }
  }

  async function loadFromFile(file: File) {
    const text = await file.text();
    let parsed: LorebookData;

    if (file.name.toLowerCase().endsWith('.json')) {
      const data = JSON.parse(text);
      const entries = Array.isArray(data.entries)
        ? data.entries
        : Array.isArray(data)
        ? data
        : [];
      parsed = {
        name: data.name ?? file.name.replace(/\.[^/.]+$/, ''),
        description: data.description ?? '',
        scanDepth: data.scan_depth ?? data.scanDepth ?? 4,
        tokenBudget: data.token_budget ?? data.tokenBudget ?? 8048,
        recursiveScanning: !!data.recursiveScanning,
        entries: normalizeEntries(entries),
        lastModified: nowIso()
      };
    } else {
      const lines = text.split('\n');
      const entries: any[] = [];
      let uid = 1;
      let current: any = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#'))
          continue;

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          if (current?.content) entries.push(current);
          current = {
            uid: uid++,
            name: trimmed.slice(1, -1).trim(),
            keys: [],
            content: '',
            enabled: true,
            priority: 10
          };
          continue;
        }

        if (trimmed.includes('|')) {
          const [keysStr, ...contentParts] = trimmed.split('|');
          const content = contentParts.join('|').trim();
          const keys = keysStr
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);
          if (keys.length && content) {
            entries.push({
              uid: uid++,
              name: keys[0],
              keys,
              content,
              enabled: true,
              priority: 10
            });
          }
          continue;
        }

        if (current) {
          current.content += (current.content ? '\n' : '') + trimmed;
        }
      }

      if (current?.content) entries.push(current);

      parsed = {
        name: file.name.replace(/\.[^/.]+$/, ''),
        description: 'Импортировано из TXT',
        scanDepth: 4,
        tokenBudget: 8048,
        recursiveScanning: false,
        entries: normalizeEntries(entries),
        lastModified: nowIso()
      };
    }

    update((s) => ({ ...s, data: parsed }));
    await settingsRepo.set(SETTINGS_KEY, parsed);
    ui.notify(`Лорбук "${parsed.name}" загружен`, 'success');
  }

  async function clear() {
    update((s) => ({ ...s, data: null }));
    await settingsRepo.set(SETTINGS_KEY, null);
    ui.notify('Лорбук очищен', 'success');
  }

  // МАССОВАЯ ВЕКТОРИЗАЦИЯ
  async function vectorizeAll() {
    const d = get(store).data;
    if (!d || !d.entries.length) return;

    // Находим записи, у которых еще нет векторов
    const toVectorize = d.entries.filter(e => !e.vector && e.content.trim().length > 0);
    if (toVectorize.length === 0) {
        ui.notify("Все записи уже векторизованы", "success");
        return;
    }

    update(s => ({ ...s, isVectorizing: true, vectorizeProgress: { current: 0, total: toVectorize.length } }));

    try {
        const BATCH_SIZE = 20; // Ограничение пачки, чтобы не превысить Rate Limit API
        let processed = 0;

        for (let i = 0; i < toVectorize.length; i += BATCH_SIZE) {
            const batch = toVectorize.slice(i, i + BATCH_SIZE);
            const texts = batch.map(e => `${e.name}\n${e.content}`); // Векторизуем заголовок + контент
            
            const vectors = await embeddingService.getEmbeddings(texts);
            
            batch.forEach((entry, idx) => {
                entry.vector = vectors[idx];
            });

            processed += batch.length;
            update(s => ({ ...s, vectorizeProgress: { current: processed, total: toVectorize.length } }));
        }

        update(s => ({ ...s, data: d }));
        await settingsRepo.set(SETTINGS_KEY, d);
        ui.notify(`Успешно векторизовано записей: ${processed}`, "success");

    } catch (e: any) {
        ui.notify(`Ошибка векторизации: ${e.message}`, "error");
    } finally {
        update(s => ({ ...s, isVectorizing: false }));
    }
  }

  // АСИНХРОННОЕ СКАНИРОВАНИЕ С ГИБРИДНЫМ ПОИСКОМ (Ключи + Векторы)
  async function scan(messages: Array<{ role: string; content: string }>) {
    const d = get(store).data;
    if (!d?.entries?.length) return null;

    const depth = d.scanDepth ?? 4;
    const recursiveScanning = d.recursiveScanning ?? false;
    
    const recentMessages = messages.filter((m) => m.role !== 'system').slice(-depth);
    const text = recentMessages.map((m) => m.content || '').join('\n');
    const textLower = text.toLowerCase();

    const activated: LorebookEntry[] = [];
    const activatedKeys = new Set<string>();
    
    // --- ШАГ 1: Поиск по ключевым словам (Точное совпадение) ---
    for (const entry of d.entries) {
      if (!entry.enabled) continue;
      if (
        entry.probability < 100 &&
        Math.random() * 100 > entry.probability
      ) continue;

      if (entry.constant) {
        if (!activated.includes(entry)) {
          activated.push(entry);
          entry.keys.forEach(k => activatedKeys.add(k.toLowerCase()));
        }
        continue;
      }

      const pm = checkKeys(entry.keys, text, textLower, entry.caseSensitive);
      if (!pm) continue;

      if (entry.selective && entry.secondaryKeys?.length) {
        const sm = checkKeys(
          entry.secondaryKeys,
          text,
          textLower,
          entry.caseSensitive
        );
        const logic = entry.selectiveLogic ?? 0;
        if (logic === 0 && !sm) continue;
        if (logic === 1 && sm) continue;
      }

      if (!activated.includes(entry)) {
        activated.push(entry);
        entry.keys.forEach(k => activatedKeys.add(k.toLowerCase()));
      }
    }

    // --- ШАГ 2: Векторный (семантический) поиск ---
    const settings = get(settingsStore).values;
    const useVector = settings[SETTINGS_KEYS.EMBEDDING_ENABLED];
    const threshold = settings[SETTINGS_KEYS.EMBEDDING_THRESHOLD] ?? 0.75;

    if (useVector && text.trim().length > 0) {
        try {
            // Формируем контекст для векторного поиска из 2-х последних сообщений
            const searchContext = recentMessages.slice(-2).map(m => m.content).join('\n');
            const [queryVector] = await embeddingService.getEmbeddings([searchContext]);

            const semanticMatches = [];
            const debugScores = []; // <-- Массив для отладки

            for (const entry of d.entries) {
                // Если запись уже активирована по ключам или отключена - пропускаем
                if (!entry.enabled || activated.includes(entry)) continue;
                
                // Если у записи нет вектора, отмечаем это в дебаге
                if (!entry.vector) {
                    debugScores.push({ name: entry.name, status: "Нет вектора (нажмите 'Векторизовать')" });
                    continue;
                }
                
                const similarity = cosineSimilarity(queryVector, entry.vector);
                
                // Записываем результат сравнения в дебаг
                debugScores.push({ 
                    name: entry.name, 
                    score: similarity.toFixed(3),
                    passed: similarity >= threshold ? "ДА ✅" : "НЕТ ❌"
                });
                
                // Если сходство выше порога - добавляем в выборку
                if (similarity >= threshold) {
                    activated.push(entry);
                    entry.priority = (entry.priority || 10) + Math.round(similarity * 5); 
                    
                    semanticMatches.push({ 
                        entry_name: entry.name, 
                        similarity: `${(similarity * 100).toFixed(1)}%` 
                    });
                }
            }

            // <-- ЛОГИРУЕМ АБСОЛЮТНО ВСЕ ОЦЕНКИ СХОДСТВА ДЛЯ НАСТРОЙКИ
            loggingStore.logResponse({
                response: {
                    event: "Лорбук: Отладка векторного поиска",
                    threshold_used: threshold,
                    matches_found: semanticMatches.length,
                    scores: debugScores // Здесь вы увидите, какие баллы выдает ваша модель
                },
                duration: 0
            });

        } catch (e) {
            console.error("Vector search failed silently:", e);
        }
    }

    // --- ШАГ 3: Рекурсивное сканирование (внутри уже активированных) ---
    if (recursiveScanning && activated.length > 0) {
      let changed = true;
      let iterations = 0;
      const maxIterations = 10;
      
      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        const activatedContent = activated
          .filter(e => !e.excludeRecursion)
          .map(e => e.content)
          .join('\n');
        const activatedContentLower = activatedContent.toLowerCase();
        
        for (const entry of d.entries) {
          if (!entry.enabled) continue;
          if (activated.includes(entry)) continue;
          if (entry.excludeRecursion) continue;
          if (entry.constant) continue;
          
          const pm = checkKeys(
            entry.keys, 
            activatedContent, 
            activatedContentLower, 
            entry.caseSensitive
          );
          
          if (pm) {
            if (entry.selective && entry.secondaryKeys?.length) {
              const sm = checkKeys(
                entry.secondaryKeys,
                activatedContent,
                activatedContentLower,
                entry.caseSensitive
              );
              const logic = entry.selectiveLogic ?? 0;
              if (logic === 0 && !sm) continue;
              if (logic === 1 && sm) continue;
            }
            
            activated.push(entry);
            entry.keys.forEach(k => activatedKeys.add(k.toLowerCase()));
            changed = true;
          }
        }
      }
    }

    activated.sort((a, b) => (b.priority ?? 10) - (a.priority ?? 10));
    return buildContent(activated, d.tokenBudget);
  }

  function exportData() {
    const d = get(store).data;
    if (!d) return null;
    return {
      ...d,
      totalEntries: d.entries.length,
      enabledEntries: d.entries.filter((e) => e.enabled !== false).length,
      exportedAt: nowIso()
    };
  }

  function importData(data?: any) {
    if (!data || !Array.isArray(data.entries)) {
      update((s) => ({ ...s, data: null }));
      settingsRepo.set(SETTINGS_KEY, null).catch(console.error);
      return;
    }

    const parsed: LorebookData = {
      name: data.name ?? 'Imported Lorebook',
      description: data.description ?? '',
      scanDepth: data.scanDepth ?? data.scan_depth ?? 4,
      tokenBudget: data.tokenBudget ?? data.token_budget ?? 8048,
      recursiveScanning: !!data.recursiveScanning,
      entries: normalizeEntries(data.entries),
      lastModified: nowIso()
    };

    update((s) => ({ ...s, data: parsed }));
    settingsRepo.set(SETTINGS_KEY, parsed).catch(console.error);
  }

  return {
    subscribe,
    init,
    loadFromFile,
    clear,
    scan,
    vectorizeAll,
    exportData,
    importData
  };
}

export const lorebookStore = createLorebookStore();