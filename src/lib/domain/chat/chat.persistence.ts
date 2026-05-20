// ================================================================================
// ФАЙЛ: src/lib/domain/chat/chat.persistence.ts
// Описание: Автосохранение сессий для ролевого режима
// ================================================================================

import { get } from 'svelte/store';
import { chatStore } from './chat.store';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';

let paused = false;

export function pauseAutosave() { paused = true; }
export function resumeAutosave() { paused = false; }

export function attachChatAutosave(buildRow: () => any) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Регистрируем callback для восстановления данных при загрузке сессии
  chatStore.onSessionLoad((data) => {
    // Всегда вызываем importData, даже если данных нет (передаём undefined)
    // Это гарантирует очистку сторов при загрузке сессии без соответствующих данных.
    systemPromptStore.importData(data?.systemPromptData);
    cheatmodeStore.importData(data?.cheatmodeData);
    lorebookStore.importData(data?.lorebookData);
  });

  return chatStore.subscribe(() => {
    const s = get(chatStore);
    if (!s.sessionId) return;
    if (paused) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await sessionsRepo.save(buildRow());
    }, 300);
  });
}