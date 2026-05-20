// ================================================================================
// ФАЙЛ: src/lib/domain/team-chat/teamChat.sessionRow.ts
// Описание: Построение строки сессии для режима "Игра за команду"
// Включает приватные чаты, Око Мира и MemoryBook
// ================================================================================

import { teamChatStore } from './teamChat.store';
import { teamSystemPromptStore } from '$lib/domain/team-system-prompt/teamSystemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
import type { TeamChatSessionRow } from './teamChat.types';

/**
 * Собирает полный объект сессии для сохранения в IndexedDB.
 */
export function buildTeamSessionRow(): TeamChatSessionRow {
  const base = teamChatStore.toSessionData();

  return {
    ...base,
    mode: 'team',
    systemPromptData: teamSystemPromptStore.exportData(),
    cheatmodeData: cheatmodeStore.exportData(),
    lorebookData: lorebookStore.exportData(),
    privateChatsData: privateChatStore.exportData(),
    eyeData: eyeStore.exportData(),
    memoryBookData: memoryBookStore.exportData()
  } as TeamChatSessionRow;
}