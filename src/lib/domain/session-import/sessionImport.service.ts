// ================================================================================
// ФАЙЛ: src/lib/domain/session-import/sessionImport.service.ts
// Описание: Сервис для парсинга и валидации импортируемых файлов сессий
// ================================================================================

import type { SessionRow, SessionMode } from '$lib/db/types';
import type { ParseImportResult, ImportPreview, ImportCharacter, ImportRole } from './sessionImport.types';

function safeString(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function detectMode(session: any): SessionMode | null {
  if (session?.mode === 'roleplay' || session?.mode === 'hero' || session?.mode === 'team') return session.mode;

  const si = session?.selectedItems ?? {};
  if (Array.isArray(si?.teamCharacters)) return 'team';
  if (si?.heroCharacter) return 'hero';
  if (si?.systemCharacter || si?.userCharacter) return 'roleplay';
  
  return null;
}

function normalizeAvatar(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  try {
    const u = new URL(url, location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    if (u.protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
  } catch {}
  return undefined;
}

function unwrapSession(json: any): any {
  if (!json || typeof json !== 'object') return null;
  if (json.session && typeof json.session === 'object') return json.session; // обёртка экспорта
  return json;
}

function validateMinimalSession(s: any): string | null {
  if (!s || typeof s !== 'object') return 'Файл не содержит объект сессии';
  if (!s.chatTree || !Array.isArray(s.chatTree?.branches)) return 'Отсутствует chatTree.branches';
  
  // --- ЗАЩИТА ОТ "ЗЛОГО БУРАТИНО" (БИТЫХ ФАЙЛОВ) ---
  for (const branch of s.chatTree.branches) {
    if (!branch || typeof branch !== 'object') {
      return 'Повреждена структура веток истории';
    }
    if (!Array.isArray(branch.messages)) {
      return 'Повреждена структура сообщений. Файл сломан или имеет неверный формат.';
    }
  }
  // -----------------------------------------------------------

  if (!Array.isArray(s.chatParts)) return 'Отсутствует chatParts';
  if (typeof s.currentPartIndex !== 'number') return 'Отсутствует currentPartIndex';
  if (!s.selectedItems) return 'Отсутствует selectedItems';
  
  return null;
}

function roleKey(prefix: string, r: any) {
  return `${prefix}:${safeString(r?.id, safeString(r?.name, Math.random().toString(36).slice(2)))}`;
}

export function parseImportedSession(json: any): ParseImportResult {
  const raw = unwrapSession(json);
  const err = validateMinimalSession(raw);
  if (err) return { ok: false, message: err };

  const mode = detectMode(raw);
  if (!mode) return { ok: false, message: 'Не удалось определить режим чата' };

  const selected = raw.selectedItems ?? {};
  const title = safeString(raw.title, 'Импортированный чат');
  const generatedScript = safeString(raw.generatedScript, '');

  const characters: ImportCharacter[] = [];
  const roles: ImportRole[] = [];
  let scene: any = null;

  // Парсинг для режима "Игра за героя"
  if (mode === 'hero') {
    const hc = selected.heroCharacter;
    if (hc) {
      characters.push({
        key: `hero:${hc.id ?? hc.name ?? 'hero'}`,
        name: safeString(hc.name, 'Герой'),
        description: safeString(hc.description, 'Описание не задано'),
        avatar: normalizeAvatar(hc.avatar),
        source: hc
      });
    }
    if (selected.heroRole) {
      roles.push({
        key: roleKey('heroRole', selected.heroRole),
        name: safeString(selected.heroRole.name, 'Роль'),
        description: safeString(selected.heroRole.description, 'Описание не задано'),
        source: selected.heroRole
      });
    }
    scene = selected.scene ?? null;
  }

  // Парсинг для режима "Ролевой чат"
  if (mode === 'roleplay') {
    const sc = selected.systemCharacter;
    const uc = selected.userCharacter;
    
    if (sc) {
      characters.push({
        key: `system:${sc.id ?? sc.name ?? 'system'}`,
        name: safeString(sc.name, 'Персонаж ИИ'),
        description: safeString(sc.description, 'Описание не задано'),
        avatar: normalizeAvatar(sc.avatar),
        source: sc
      });
    }
    if (uc) {
      characters.push({
        key: `user:${uc.id ?? uc.name ?? 'user'}`,
        name: safeString(uc.name, 'Персонаж пользователя'),
        description: safeString(uc.description, 'Описание не задано'),
        avatar: normalizeAvatar(uc.avatar),
        source: uc
      });
    }
    if (selected.systemRole) {
      roles.push({
        key: roleKey('systemRole', selected.systemRole),
        name: safeString(selected.systemRole.name, 'Роль ИИ'),
        description: safeString(selected.systemRole.description, 'Описание не задано'),
        source: selected.systemRole
      });
    }
    if (selected.userRole) {
      roles.push({
        key: roleKey('userRole', selected.userRole),
        name: safeString(selected.userRole.name, 'Роль пользователя'),
        description: safeString(selected.userRole.description, 'Описание не задано'),
        source: selected.userRole
      });
    }
    scene = selected.scene ?? null;
  }

  // Парсинг для режима "Командная игра"
  if (mode === 'team') {
    const arr = Array.isArray(selected.teamCharacters) ? selected.teamCharacters : [];
    for (const c of arr) {
      characters.push({
        key: `team:${c.id ?? c.name ?? Math.random().toString(36).slice(2)}`,
        name: safeString(c.name, 'Персонаж'),
        description: safeString(c.description, 'Описание не задано'),
        avatar: normalizeAvatar(c.avatar),
        source: c
      });
    }
    scene = selected.scene ?? null;
  }

  const preview: ImportPreview = {
    mode,
    title,
    characters,
    roles,
    scene: scene
      ? {
          name: safeString(scene.name, 'Сценарий'),
          description: safeString(scene.description, 'Описание не задано'),
          source: scene
        }
      : null,
    generatedScript,
    rawSession: raw as SessionRow
  };

  return { ok: true, preview };
}