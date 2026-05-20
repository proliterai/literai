// ================================================================================
// ФАЙЛ: src/lib/domain/seed/catalog.seed.ts
// Описание: Загрузка seed-данных каталога при первом запуске с разбиением на файлы
// ================================================================================
import { browser } from '$app/environment';
import { catalogRepo } from '$lib/db/repositories/catalog.repo';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { get } from 'svelte/store';

const SEED_VERSION = 2;

// Флаг готовности seed-данных
let seeded = false;
let seedingPromise: Promise<void> | null = null;

// Вспомогательная функция для обновления глобального экрана загрузки
function updateBoot(percent: number, text?: string, subtext?: string) {
    if (typeof window !== 'undefined' && (window as any).__boot) {
        (window as any).__boot.setProgress(percent, text, subtext);
    }
}

/**
 * Проверяет и загружает seed-данные каталога, если это необходимо.
 * Вызывается один раз при старте приложения.
 */
export async function ensureCatalogSeeded(): Promise<void> {
    // Проверка что код выполняется в браузере
    if (!browser) return;

    // Если уже засеяно - возвращаем сразу
    if (seeded) return;

    // Если уже идёт процесс seeding - ждём его завершения
    if (seedingPromise) return seedingPromise;

    seedingPromise = (async () => {
        try {
            // Получаем текущую версию seed из настроек
            const currentVersion = get(settingsStore).values[SETTINGS_KEYS.SEED_VERSION_CATALOG] ?? 0;
            
            // Если версия актуальна - убираем boot-экран и ничего не делаем
            if (currentVersion >= SEED_VERSION) {
                seeded = true;
                if (typeof window !== 'undefined' && (window as any).__boot) {
                    (window as any).__boot.done();
                }
                return;
            }

            updateBoot(10, 'Загрузка библиотек...', 'Скачиваем базовые наборы историй');

            // Загружаем 3 файла параллельно
            const [charsRes, rolesRes, scenesRes] = await Promise.all([
                fetch('/data/seed-characters.json'),
                fetch('/data/seed-roles.json'),
                fetch('/data/seed-scenes.json')
            ]);

            const chars = charsRes.ok ? await charsRes.json() : [];
            const roles = rolesRes.ok ? await rolesRes.json() : [];
            const scenes = scenesRes.ok ? await scenesRes.json() : [];

            const items = [...chars, ...roles, ...scenes];
            const total = items.length;

            updateBoot(30, 'Подготовка базы данных...', `Найдено записей: ${total}`);

            // Сохраняем в БД по одному с обновлением прогресса
            for (let i = 0; i < total; i++) {
                const it = items[i];
                // Убеждаемся что meta существует
                it.meta = it.meta ?? {};
                // Помечаем как системный элемент
                it.meta.author = 'system';
                it.meta.seedVersion = SEED_VERSION;
                it.meta.createdAt = it.meta.createdAt ?? new Date().toISOString();
                it.meta.updatedAt = it.meta.updatedAt ?? it.meta.createdAt;
                
                // Сохраняем в Dexie
                await catalogRepo.upsert(it);

                // Обновляем UI каждые 10 записей или на последней итерации (чтобы не перегружать DOM)
                if (i % 10 === 0 || i === total - 1) {
                    // Рассчитываем процент от 30% до 100%
                    const percent = 30 + Math.floor((i / total) * 70);
                    updateBoot(percent, 'Запись в базу данных...', `Обработано ${i + 1} из ${total}`);
                }
            }

            // Сохраняем версию seed в настройки
            await settingsStore.set(SETTINGS_KEYS.SEED_VERSION_CATALOG, SEED_VERSION);
            
            // Устанавливаем флаг готовности
            seeded = true;
            console.log('[Seed] Catalog seeded successfully');
            
        } catch (error) {
            console.error('[Seed] Failed to seed catalog:', error);
            // Не прерываем работу приложения если seed не загрузился
            seeded = true;
        } finally {
            seedingPromise = null;
            // Плавно скрываем и удаляем загрузочный экран
            if (typeof window !== 'undefined' && (window as any).__boot) {
                (window as any).__boot.done();
            }
        }
    })();

    return seedingPromise;
}

/**
 * Проверка готовности seed-данных.
 * Используется сторами каталога для ожидания завершения инициализации.
 */
export function isSeeded(): boolean {
    return seeded;
}

/**
 * Сброс флага (для тестов или принудительной перезагрузки)
 */
export function resetSeeded(): void {
    seeded = false;
    seedingPromise = null;
}