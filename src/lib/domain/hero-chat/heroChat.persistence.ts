// ================================================================================
// ФАЙЛ: src/lib/domain/hero-chat/heroChat.persistence.ts
// Описание: Автосохранение сессий для режима "Игра за героя"
// ================================================================================

import { get } from 'svelte/store';
import { heroChatStore } from './heroChat.store';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { heroSystemPromptStore } from './heroSystemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';

let paused = false;

export function pauseHeroAutosave() { paused = true; }
export function resumeHeroAutosave() { paused = false; }

/**
 * Подключает автосохранение для режима "Игра за героя".
 * Возвращает функцию отписки, которую нужно вызвать при уничтожении компонента.
 */
export function attachHeroChatAutosave(buildRow: () => any): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Регистрируем callback для восстановления данных при загрузке сессии
  heroChatStore.onSessionLoad((data) => {
    // Всегда вызываем importData, даже если данных нет (передаём undefined)
    heroSystemPromptStore.importData(data?.systemPromptData);
    cheatmodeStore.importData(data?.cheatmodeData);
    lorebookStore.importData(data?.lorebookData);
  });

  // Подписываемся на изменения стора и сохраняем с debounce
  const unsubscribe = heroChatStore.subscribe(() => {
    const s = get(heroChatStore);
    if (!s.sessionId) return;
    if (paused) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await sessionsRepo.save(buildRow());
    }, 300);
  });

  // Возвращаем функцию отписки
  return unsubscribe;
}