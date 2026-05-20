import type { CatalogItemRow, CatalogItemType } from '$lib/db/types';
import { catalogRepo } from '$lib/db/repositories/catalog.repo';

function rid() {
  return Math.random().toString(36).slice(2, 9);
}
function nowIso() {
  return new Date().toISOString();
}

async function existsByName(type: CatalogItemType, name: string): Promise<boolean> {
  const found = await catalogRepo.findItems({ type, offset: 0, limit: 50, search: name });
  return found.some((x) => x.name?.trim().toLowerCase() === name.trim().toLowerCase());
}

function normalizeAvatar(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    if (u.protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
  } catch {}
  return undefined;
}

async function addEntity(type: CatalogItemType, payload: { name: string; description?: string; avatar?: string; tags?: string[] }) {
  const name = (payload.name || '').trim();
  if (!name) return { status: 'invalid' as const, message: 'Пустое имя' };

  if (await existsByName(type, name)) {
    return { status: 'exists' as const, message: 'Уже есть в каталоге' };
  }

  const row: CatalogItemRow = {
    id: `user_${type}_${Date.now()}_${rid()}`,
    type,
    name,
    description: (payload.description || '').trim(),
    avatar: type === 'character' ? normalizeAvatar(payload.avatar) : undefined,
    tags: payload.tags ?? ['Импорт'],
    meta: { author: 'user', createdAt: nowIso(), updatedAt: nowIso() }
  };

  const saved = await catalogRepo.upsert(row);
  return { status: 'added' as const, item: saved };
}

export const catalogImportService = {
  addCharacter(data: { name: string; description?: string; avatar?: string }) {
    return addEntity('character', { ...data, tags: ['Импорт', 'Персонаж'] });
  },
  addRole(data: { name: string; description?: string }) {
    return addEntity('role', { ...data, tags: ['Импорт', 'Роль'] });
  },
  addScene(data: { name: string; description?: string }) {
    return addEntity('scene', { ...data, tags: ['Импорт', 'Сцена'] });
  }
};