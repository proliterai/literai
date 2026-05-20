import { getDB } from '../db';
import type { ProviderRow } from '../types';

export class ProvidersRepository {
 async listOrdered() {
    return getDB().providers.orderBy('order').toArray();
 }

 async getActive() {
    // ✅ ИСПРАВЛЕНИЕ: Вместо индексного поиска используем JS-фильтр.
    // Это устраняет ошибку "The parameter is not a valid key" с булевыми значениями.
    const all = await getDB().providers.toArray();
    return all.find(p => p.isActive === true);
 }

 async upsert(p: ProviderRow) {
    await getDB().providers.put(p);
    return p;
 }

 async delete(id: string) {
    await getDB().providers.delete(id);
 }

 async setActive(id: string) {
    const db = getDB();
    await db.transaction('rw', db.providers, async () => {
        // Сначала сбрасываем флаг у всех
        const all = await db.providers.toArray();
        for (const p of all) {
            if (p.isActive) {
                await db.providers.update(p.id, { isActive: false });
            }
        }
        // Устанавливаем новому
        await db.providers.update(id, { isActive: true });
    });
 }

 async saveOrder(idsInOrder: string[]) {
    const db = getDB();
    await db.transaction('rw', db.providers, async () => {
        for (let i = 0; i < idsInOrder.length; i++) {
            await db.providers.update(idsInOrder[i], { order: i });
        }
    });
 }
}

export const providersRepo = new ProvidersRepository();