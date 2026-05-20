import { getDB } from '../db';
import type { SettingRow } from '../types';

export class SettingsRepository {
  async get(key: string) {
    const row = await getDB().settings.get(key);
    return row?.value ?? null;
  }

  async set(key: string, value: any) {
    const row: SettingRow = { key, value };
    await getDB().settings.put(row);
  }

  async setMany(patch: Record<string, any>) {
    const rows: SettingRow[] = Object.entries(patch).map(([key, value]) => ({ key, value }));
    await getDB().settings.bulkPut(rows);
  }

  async getAll() {
    return getDB().settings.toArray();
  }
}

export const settingsRepo = new SettingsRepository();