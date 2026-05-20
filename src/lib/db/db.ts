// ================================================================================
// ФАЙЛ: src/lib/db/db.ts
// ================================================================================

import Dexie, { type Table } from 'dexie';
import { browser } from '$app/environment';
import type { CatalogItemRow, ProviderRow, SettingRow, SessionRow } from './types';

export class RolePlayDB extends Dexie {
  catalog_items!: Table<CatalogItemRow, string>;
  settings!: Table<SettingRow, string>;
  providers!: Table<ProviderRow, string>;
  sessions!: Table<SessionRow, string>;

  constructor() {
    super('RolePlayChatDB');
    
    // Версия 3: старая схема
    this.version(3).stores({
      catalog_items: 'id, type, name, *tags, meta.author, meta.updatedAt, [type+meta.author]',
      settings: 'key',
      providers: 'id, isActive, order',
      sessions: 'id, updatedAt, createdAt, title'
    });

    // Версия 4: добавляем поле mode в индексы таблицы sessions
    this.version(4).stores({
      catalog_items: 'id, type, name, *tags, meta.author, meta.updatedAt, [type+meta.author]',
      settings: 'key',
      providers: 'id, isActive, order',
      sessions: 'id, updatedAt, createdAt, mode, title' // <-- добавили mode
    }).upgrade(async tx => {
      // Миграция: если у старых сессий нет поля mode, считаем их 'roleplay'
      await tx.table('sessions').toCollection().modify(session => {
        if (!session.mode) {
          session.mode = 'roleplay';
        }
      });
    });
  }
}

let _db: RolePlayDB | null = null;

export function getDB(): RolePlayDB {
  if (!_db) {
    if (!browser) throw new Error('Dexie DB cannot be created on the server (SSR).');
    _db = new RolePlayDB();
  }
  return _db;
}