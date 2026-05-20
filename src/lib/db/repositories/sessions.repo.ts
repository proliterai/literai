import { getDB } from '../db';
import type { SessionRow } from '../types';

export class SessionsRepository {
  async save(session: SessionRow) {
    const updatedAt = new Date().toISOString();
    const createdAt = session.createdAt ?? updatedAt;
    const row: SessionRow = { ...session, createdAt, updatedAt };
    await getDB().sessions.put(row);
    return row;
  }

  async load(id: string) {
    return getDB().sessions.get(id);
  }

  async getRecent(limit = 500) {
    return getDB().sessions.orderBy('updatedAt').reverse().limit(limit).toArray();
  }

  async remove(id: string) {
    await getDB().sessions.delete(id);
  }
}

export const sessionsRepo = new SessionsRepository();