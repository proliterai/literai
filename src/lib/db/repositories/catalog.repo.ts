// ================================================================================
// ФАЙЛ: src/lib/db/repositories/catalog.repo.ts
// Описание: Репозиторий для работы с каталогом персонажей/ролей/сцен
// Оптимизации:
// - Быстрая пагинация и сортировка в памяти
// - Методы для получения уникальных тегов и букв без загрузки всех карточек
// ================================================================================
import type { CatalogItemRow, CatalogItemType } from '../types';
import { getDB } from '../db';

// ================================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================================================================
function nowIso(): string {
  return new Date().toISOString();
}

function normalize(item: CatalogItemRow): CatalogItemRow {
  const now = nowIso();
  const meta = item.meta ?? { author: 'system' as const };
  return {
    ...item,
    meta: {
      author: meta.author ?? 'system',
      createdAt: meta.createdAt ?? now,
      updatedAt: meta.updatedAt ?? meta.createdAt ?? now,
      seedVersion: meta.seedVersion
    }
  };
}

// ================================================================================
// КЛАСС РЕПОЗИТОРИЯ
// ================================================================================
export class CatalogRepository {
  // ----------------------------------------------------------------------------
  // БАЗОВЫЕ CRUD
  // ----------------------------------------------------------------------------
  async getById(id: string): Promise<CatalogItemRow | undefined> {
    return getDB().catalog_items.get(id);
  }

  async upsert(item: CatalogItemRow): Promise<CatalogItemRow> {
    const now = nowIso();
    const norm = normalize({
      ...item,
      meta: { 
        ...(item.meta ?? { author: 'user' as const }), 
        updatedAt: now 
      }
    });
    await getDB().catalog_items.put(norm);
    return norm;
  }

  async remove(id: string): Promise<void> {
    await getDB().catalog_items.delete(id);
  }

  // ----------------------------------------------------------------------------
  // МЕТАДАННЫЕ ДЛЯ ФИЛЬТРОВ (загружаются один раз)
  // ----------------------------------------------------------------------------
  async getUniqueTags(type: CatalogItemType): Promise<string[]> {
    // Используем Map для подсчета частоты каждого тега
    const tagCounts = new Map<string, number>();
    
    await getDB().catalog_items
      .where('type')
      .equals(type)
      .each((item) => {
        if (item.tags) {
          item.tags.forEach((t) => {
            tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
          });
        }
      });

    // Сортируем: сначала по частоте (по убыванию), при равенстве — по алфавиту
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(entry => entry[0]); // Возвращаем только сами теги
  }

  async getUniqueLetters(type: CatalogItemType): Promise<string[]> {
    const letters = new Set<string>();
    await getDB().catalog_items
      .where('type')
      .equals(type)
      .each((item) => {
        const firstChar = (item.name || '#')[0].toUpperCase();
        letters.add(firstChar);
      });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  // ----------------------------------------------------------------------------
  // ПОИСК С ПАГИНАЦИЕЙ
  // ----------------------------------------------------------------------------
  async findItems(params: {
    type: CatalogItemType;
    offset: number;
    limit: number;
    search?: string;
    tags?: string[];
    letter?: string | null;
    sortByDate?: boolean;
    onlyCustom?: boolean;
  }): Promise<CatalogItemRow[]> {
    const { type, offset, limit, search, tags, letter, sortByDate, onlyCustom } = params;

    // 1. ЗАГРУЗКА: Получаем все записи нужного типа в память
    // Dexie отрабатывает это мгновенно для каталогов до нескольких тысяч записей
    let items = await getDB().catalog_items.where('type').equals(type).toArray();

    // 2. ФИЛЬТРАЦИЯ
    if (onlyCustom) {
      items = items.filter((item) => item.meta?.author === 'user');
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item) => (item.name || '').toLowerCase().includes(q));
    }
    
    if (tags && tags.length > 0) {
      items = items.filter((item) => tags.every((t) => (item.tags || []).includes(t)));
    }
    
    if (letter) {
      const l = letter.toUpperCase();
      items = items.filter((item) => ((item.name || '#')[0] || '#').toUpperCase() === l);
    }
    
    // 3. СОРТИРОВКА
    if (sortByDate) {
      items.sort((a, b) => {
        const da = a.meta?.updatedAt || a.meta?.createdAt || '';
        const db = b.meta?.updatedAt || b.meta?.createdAt || '';
        return db.localeCompare(da); // Новые сверху
      });
    } else {
      items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru')); // По алфавиту
    }

    // 4. ПАГИНАЦИЯ: Возвращаем нужный срез массива
    return items.slice(offset, offset + limit);
  }

  // ----------------------------------------------------------------------------
  // ДЛЯ ЭКСПОРТА/ИМПОРТА (полные списки)
  // ----------------------------------------------------------------------------
  async listUserItems(type?: CatalogItemType): Promise<CatalogItemRow[]> {
    const query = type 
      ? getDB().catalog_items.where('type').equals(type)
      : getDB().catalog_items;
    const all = await query.toArray();
    return all.filter(item => item.meta?.author === 'user');
  }

  async bulkUpsert(items: CatalogItemRow[]): Promise<number> {
    const normalized = items.map(item => normalize({
      ...item,
      meta: { 
        ...(item.meta ?? { author: 'user' as const }), 
        updatedAt: nowIso() 
      }
    }));
    await getDB().catalog_items.bulkPut(normalized);
    return normalized.length;
  }
}

export const catalogRepo = new CatalogRepository();