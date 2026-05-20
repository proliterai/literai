import { writable, derived, get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import type { ProviderRow } from '$lib/db/types';
import { ui } from '$lib/ui/ui.store';

type ProvidersState = {
  ready: boolean;
  providers: ProviderRow[];
  activeId: string | null;
  collapsed: Record<string, boolean>;
  drag: { isDragging: boolean; draggedId: string | null; dragOverId: string | null };
};

const initial: ProvidersState = {
  ready: false,
  providers: [],
  activeId: null,
  collapsed: {},
  drag: { isDragging: false, draggedId: null, dragOverId: null }
};

function pid() {
  return `prov_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// Типы для экспорта/импорта
type ExportedProvider = {
  name: string;
  url: string;
  model: string;
  apiKey: string;
};

type ProvidersExportData = {
  type: 'providers_export';
  version: string;
  exportedAt: string;
  providers: ExportedProvider[];
};

type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
};

export function createProvidersStore() {
  const store = writable<ProvidersState>(initial);
  const { subscribe, update } = store;

  const active = derived(
    store,
    (s) => s.providers.find((p) => p.id === s.activeId) ?? null
  );

  async function reload() {
    const list = await providersRepo.listOrdered();
    const activeRow = list.find((p) => p.isActive) ?? list[0] ?? null;
    update((s) => {
      const collapsed = { ...s.collapsed };
      for (const p of list) {
        if (collapsed[p.id] === undefined) collapsed[p.id] = true;
      }
      return {
        ...s,
        ready: true,
        providers: list,
        activeId: activeRow?.id ?? null,
        collapsed
      };
    });
  }

  return {
    subscribe,
    active,

    async init() { await reload(); },

    // ИЗМЕНЕНО: Добавляем нового провайдера в начало списка
    async addProvider() {
      const s = get(store);
      const isFirst = s.providers.length === 0;
      
      const row: ProviderRow = {
        id: pid(),
        name: `Провайдер ${s.providers.length + 1}`,
        url: '',
        model: '',
        apiKey: '',
        order: 0, // Устанавливаем 0, так как он будет первым
        isActive: isFirst,
        createdAt: nowIso()
      };

      // Добавляем в начало и пересчитываем порядковые номера (order) для всех
      const newProvidersList = [row, ...s.providers].map((p, i) => ({ ...p, order: i }));

      await providersRepo.upsert(row);
      // Сохраняем новый порядок сортировки в БД
      await providersRepo.saveOrder(newProvidersList.map((p) => p.id));

      update((st) => ({
        ...st,
        providers: newProvidersList,
        activeId: isFirst ? row.id : st.activeId,
        collapsed: { ...st.collapsed, [row.id]: false }
      }));
      return row;
    },

    // НОВОЕ: Метод для перемещения провайдера стрелочками (вверх/вниз)
    async moveProvider(id: string, direction: -1 | 1) {
      const s = get(store);
      const idx = s.providers.findIndex((p) => p.id === id);
      if (idx === -1) return;

      const newIdx = idx + direction;
      // Проверка границ массива
      if (newIdx < 0 || newIdx >= s.providers.length) return;

      // Меняем местами элементы в массиве
      const list = [...s.providers];
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];

      // Обновляем поле order для сохранения в БД
      const updatedList = list.map((p, i) => ({ ...p, order: i }));

      update((st) => ({ ...st, providers: updatedList }));
      // Сохраняем новый порядок в БД
      await providersRepo.saveOrder(updatedList.map((p) => p.id));
    },

    async updateProvider(
      id: string,
      patch: Partial<Pick<ProviderRow, 'name' | 'url' | 'model' | 'apiKey'>>
    ) {
      if (patch.url !== undefined && patch.url) {
        try { new URL(patch.url); } catch {
          throw new Error('Некорректный URL провайдера');
        }
      }
      const s = get(store);
      const idx = s.providers.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const updated: ProviderRow = { ...s.providers[idx], ...patch };
      await providersRepo.upsert(updated);
      update((st) => {
        const next = st.providers.slice();
        next[idx] = updated;
        return { ...st, providers: next };
      });
      return updated;
    },

    async deleteProvider(id: string) {
      const s = get(store);
      const wasActive = s.activeId === id;
      const remainingProviders = s.providers.filter((p) => p.id !== id);
      const nextActive = wasActive ? (remainingProviders[0]?.id ?? null) : s.activeId;

      await providersRepo.delete(id);

      if (wasActive && nextActive) {
        await providersRepo.setActive(nextActive);
      }

      await reload();
    },

    async setActive(id: string) {
      await providersRepo.setActive(id);
      await reload();
    },

    toggleCollapse(id: string) {
      update((s) => ({
        ...s,
        collapsed: { ...s.collapsed, [id]: !s.collapsed[id] }
      }));
    },

    startDrag(id: string) {
      update((s) => ({
        ...s,
        drag: { isDragging: true, draggedId: id, dragOverId: null }
      }));
    },

    dragOver(id: string) {
      update((s) => {
        if (s.drag.dragOverId === id) return s;
        return { ...s, drag: { ...s.drag, dragOverId: id } };
      });
    },

    async drop(draggedId: string, targetId: string) {
      if (!draggedId || !targetId || draggedId === targetId) return;
      update((s) => {
        const list = s.providers.slice();
        const from = list.findIndex((p) => p.id === draggedId);
        const to = list.findIndex((p) => p.id === targetId);
        if (from === -1 || to === -1) return s;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        const providers = list.map((p, i) => ({ ...p, order: i }));
        return { ...s, providers };
      });
      const ids = get(store).providers.map((p) => p.id);
      await providersRepo.saveOrder(ids);
    },

    endDrag() {
      update((s) => ({
        ...s,
        drag: { isDragging: false, draggedId: null, dragOverId: null }
      }));
    },

    async testConnection(id: string) {
      const s = get(store);
      const p = s.providers.find((x) => x.id === id);
      if (!p) throw new Error('Провайдер не найден');
      if (!p.url) throw new Error('URL не указан');
      if (!p.model) throw new Error('Модель не указана');

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10_000);

      try {
        const resp = await fetch(p.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p.apiKey}`
          },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5,
            stream: false
          }),
          signal: controller.signal
        });

        if (!resp.ok) {
          let msg = `HTTP ${resp.status}`;
          try {
            const j = await resp.json();
            if (j.error?.message) msg += `: ${j.error.message}`;
          } catch {}
          return { ok: false as const, message: msg };
        }

        const data = await resp.json();
        if (data.choices || data.candidates)
          return { ok: true as const, message: 'Соединение успешно!' };

        return { ok: false as const, message: 'Неверный формат ответа' };
      } catch (e: any) {
        let message = e?.message || 'Ошибка';
        if (e?.name === 'AbortError') message = 'Таймаут (10 сек)';
        else if (message.includes('Failed to fetch'))
          message = 'Не удалось подключиться (CORS или неверный URL)';
        return { ok: false as const, message };
      } finally {
        clearTimeout(t);
      }
    },

    // ================================================================================
    // ЭКСПОРТ ПРОВАЙДЕРОВ
    // ================================================================================
    exportProviders(): ProvidersExportData {
      const s = get(store);
      const providers: ExportedProvider[] = s.providers.map((p) => ({
        name: p.name,
        url: p.url,
        model: p.model,
        apiKey: p.apiKey
      }));

      return {
        type: 'providers_export',
        version: '1.0',
        exportedAt: nowIso(),
        providers
      };
    },

    // ================================================================================
    // ИМПОРТ ПРОВАЙДЕРОВ
    // ================================================================================
    async importProviders(data: any): Promise<ImportResult> {
      const result: ImportResult = { added: 0, updated: 0, skipped: 0 };

      // Валидация входных данных
      if (!data || typeof data !== 'object') {
        throw new Error('Неверный формат файла');
      }

      // Поддержка разных форматов
      let providers: any[] = [];
      
      if (data.type === 'providers_export' && Array.isArray(data.providers)) {
        providers = data.providers;
      } else if (Array.isArray(data)) {
        providers = data;
      } else if (Array.isArray(data.providers)) {
        providers = data.providers;
      } else {
        throw new Error('Не найден массив провайдеров в файле');
      }

      if (providers.length === 0) {
        throw new Error('Файл не содержит провайдеров');
      }

      const s = get(store);
      const existingByName = new Map(s.providers.map((p) => [p.name.toLowerCase(), p]));

      for (const item of providers) {
        // Валидация обязательных полей
        if (!item || typeof item !== 'object') {
          result.skipped++;
          continue;
        }

        const name = String(item.name || '').trim();
        const url = String(item.url || '').trim();
        const model = String(item.model || '').trim();
        const apiKey = String(item.apiKey || item.api_key || '').trim();

        if (!name) {
          result.skipped++;
          continue;
        }

        // Валидация URL если указан
        if (url) {
          try {
            new URL(url);
          } catch {
            result.skipped++;
            continue;
          }
        }

        // Проверяем существующего провайдера по имени
        const existing = existingByName.get(name.toLowerCase());

        if (existing) {
          // Обновляем существующего провайдера
          const updated: ProviderRow = {
            ...existing,
            url: url || existing.url,
            model: model || existing.model,
            apiKey: apiKey || existing.apiKey
          };
          await providersRepo.upsert(updated);
          result.updated++;
        } else {
          // Создаём нового провайдера
          const isFirst = s.providers.length === 0 && result.added === 0;
          const newProvider: ProviderRow = {
            id: pid(),
            name,
            url,
            model,
            apiKey,
            // Добавляем в конец списка при импорте (чтобы не нарушать текущий порядок пользователя)
            order: s.providers.length + result.added,
            isActive: isFirst,
            createdAt: nowIso()
          };
          await providersRepo.upsert(newProvider);
          result.added++;
        }
      }

      // Перезагружаем состояние из базы
      await reload();

      return result;
    }
  };
}

export const providersStore = createProvidersStore();