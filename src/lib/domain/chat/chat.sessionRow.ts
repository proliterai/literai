// ================================================================================
// ФАЙЛ: src/lib/domain/chat/chat.sessionRow.ts
// Включаем все данные (systemPrompt, cheatmode, lorebook, eyeData, memoryBookData) в sessionRow
// ================================================================================

import { chatStore } from './chat.store';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
import type { ChatSessionRow } from './chat.types';

export function buildSessionRow(): ChatSessionRow {
  const base = chatStore.toSessionData();

  return {
    ...base,
    systemPromptData: systemPromptStore.exportData(),
    cheatmodeData: cheatmodeStore.exportData(),
    lorebookData: lorebookStore.exportData(),
    eyeData: eyeStore.exportData(),
    memoryBookData: memoryBookStore.exportData()
  } as ChatSessionRow;
}