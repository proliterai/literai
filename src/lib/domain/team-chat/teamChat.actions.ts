// ================================================================================
// ФАЙЛ: src/lib/domain/team-chat/teamChat.actions.ts
// Описание: Действия для командного чата с динамическими промптами и рероллами
// ================================================================================

import { get } from 'svelte/store';
import { teamChatStore } from './teamChat.store';
import { teamChatService } from './teamChat.service';
import { ui } from '$lib/ui/ui.store';
import { teamSystemPromptStore } from '$lib/domain/team-system-prompt/teamSystemPrompt.store';
import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { buildTeamSessionRow } from './teamChat.sessionRow';

// Вспомогательная функция для проверки занятости
function isBusy(): boolean {
  const s = get(teamChatStore);
  return s.isSummarizing || s.isRerolling || s.isGenerating;
}

// Функция сохранения сессии в БД
async function saveSessionToDb(): Promise<void> {
  try {
    const sessionRow = buildTeamSessionRow();
    if (sessionRow.id) {
      await sessionsRepo.save(sessionRow);
    }
  } catch (e) {
    console.error('[TeamChat] Failed to save session:', e);
  }
}

/**
 * Синхронизация контекста с приватными чатами
 */
function updatePrivateChatsContext(): void {
  const s = get(teamChatStore);
  const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
  if (!branch) return;

  // Обновляем историю основного чата в приватных чатах
  privateChatStore.updateMainChatContext(
    branch.messages,
    s.generatedScript,
    s.itemDescriptions
  );
}

/**
 * Гарантирует наличие первого ответа от рассказчика после старта сессии
 */
export async function ensureFirstResponse(): Promise<void> {
  if (isBusy()) return;
  const s = get(teamChatStore);
  if (!s.sessionId) return;

  const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
  if (!branch) return;

  const nonSystem = branch.messages.filter((m) => m.role !== 'system');
  const hasAssistant = nonSystem.some((m) => m.role === 'assistant');

  // Если нет ни одного сообщения от рассказчика — генерируем первый ответ
  if (!hasAssistant) {
    teamChatStore.setIsGenerating(true);
    try {
      const response = await teamChatService.generateNarratorResponse({ isFirst: true });
      teamChatStore.addAssistantMessage(response);
      updatePrivateChatsContext();
      await saveSessionToDb();
    } catch (e: any) {
      teamChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
      ui.notify(e.message, 'error');
    } finally {
      teamChatStore.setIsGenerating(false);
    }
  }
}

/**
 * Отправка хода от рассказчика (кнопка «Рассказчик»)
 */
export async function sendAsNarrator(): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  teamChatStore.setIsGenerating(true);
  try {
    const response = await teamChatService.generateNarratorResponse();
    teamChatStore.addAssistantMessage(response);
    updatePrivateChatsContext();
    await saveSessionToDb();
  } catch (e: any) {
    teamChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    teamChatStore.setIsGenerating(false);
  }
}

/**
 * Отправка хода от конкретного персонажа (кнопка с аватаркой персонажа)
 */
export async function sendAsCharacter(characterId: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  const characters = teamChatStore.getTeamCharacters();
  const character = characters.find(c => c.id === characterId);
  if (!character) {
    ui.notify('Персонаж не найден', 'error');
    return;
  }

  teamChatStore.setIsGenerating(true);
  try {
    const response = await teamChatService.generateCharacterResponse(characterId);
    // Добавляем как сообщение пользователя (от лица персонажа)
    teamChatStore.addUserMessage(response, characterId);
    updatePrivateChatsContext();
    await saveSessionToDb();
  } catch (e: any) {
    ui.notify(`Ошибка генерации для ${character.name}: ${e.message}`, 'error');
  } finally {
    teamChatStore.setIsGenerating(false);
  }
}

/**
 * Реролл сообщения (переключает версию или генерирует новую)
 */
export async function reroll(messageId: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  const s = get(teamChatStore);
  const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
  const message = branch?.messages.find(m => m.id === messageId);
  if (!message) {
    ui.notify('Сообщение не найдено', 'error');
    return;
  }

  teamChatStore.setIsRerolling(true);
  try {
    let response: string;

    if (message.role === 'assistant') {
      // Реролл рассказчика
      response = await teamChatService.generateNarratorResponse({ isReroll: true, rerollMessageId: messageId });
    } else if (message.role === 'user' && (message as any).characterId) {
      // Реролл персонажа
      response = await teamChatService.generateCharacterResponse(
        (message as any).characterId, 
        { isReroll: true, rerollMessageId: messageId }
      );
    } else {
      throw new Error('Невозможно перегенерировать это сообщение');
    }

    teamChatStore.addAssistantVersion(messageId, response);
    updatePrivateChatsContext();
    await saveSessionToDb();
    ui.notify('Ответ перегенерирован', 'success');
  } catch (e: any) {
    ui.notify(`Ошибка реролла: ${e.message}`, 'error');
  } finally {
    teamChatStore.setIsRerolling(false);
  }
}

/**
 * Редактирование сообщения пользователя и перегенерация
 */
export async function editUserAndRegenerate(messageId: string, newText: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  teamChatStore.editUserMessageAndTruncate(messageId, newText);
  teamChatStore.setIsGenerating(true);

  try {
    // После правки пользователя обычно отвечает рассказчик (продвигает мир дальше)
    const response = await teamChatService.generateNarratorResponse();
    teamChatStore.addAssistantMessage(response);
    updatePrivateChatsContext();
    await saveSessionToDb();
    ui.notify('Продолжение перегенерировано', 'success');
  } catch (e: any) {
    teamChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    teamChatStore.setIsGenerating(false);
  }
}

/**
 * Ветвление: создание новой ветки из отредактированного сообщения
 */
export async function branchUserAndRegenerate(messageId: string, newText: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  teamChatStore.createBranchFromEdit(messageId, newText);
  teamChatStore.setIsGenerating(true);

  try {
    const response = await teamChatService.generateNarratorResponse();
    teamChatStore.addAssistantMessage(response);
    updatePrivateChatsContext();
    await saveSessionToDb();
    ui.notify('Новая ветвь продолжена', 'success');
  } catch (e: any) {
    teamChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    teamChatStore.setIsGenerating(false);
  }
}

/**
 * Суммаризация текущей части истории
 */
export async function summarize(customPrompt?: string): Promise<boolean> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return false;
  }

  teamChatStore.setIsSummarizing(true);
  try {
    const summary = await teamChatService.runSummarization(customPrompt);
    
    // Получаем актуальный набор (чтобы использовать его Intro для старта новой части)
    const spState = get(teamSystemPromptStore);
    const activeSet = spState.customSets[spState.activeSetId] ||
                      spState.customPresets.find(p => p.id === spState.activeSetId) ||
                      spState.sets.find(p => p.id === spState.activeSetId) ||
                      spState.sets[0];
                      
    const basePrompt = activeSet ? activeSet.intro : 'Ты — рассказчик в командной истории.';
    
    teamChatStore.createNewPartFromSummary(summary, basePrompt);

    // Создаём новую часть приватных чатов
    const s = get(teamChatStore);
    privateChatStore.createNewPart(s.currentPartIndex);
    
    // Обновляем контекст приватных чатов
    updatePrivateChatsContext();
    
    await saveSessionToDb();

    return true;
  } catch (e: any) {
    ui.notify(`Ошибка суммаризации: ${e.message}`, 'error');
    return false;
  } finally {
    teamChatStore.setIsSummarizing(false);
  }
}

/**
 * Удаление сообщения
 */
export function deleteMessage(messageId: string): void {
  if (!confirm('Удалить это сообщение?')) return;
  teamChatStore.deleteMessageWithPairRule(messageId);
  updatePrivateChatsContext();
  saveSessionToDb();
  ui.notify('Сообщение удалено', 'success');
}

/**
 * Переключение версии сообщения
 */
export function switchVersion(messageId: string, direction: -1 | 1): void {
  teamChatStore.switchVersion(messageId, direction);
  saveSessionToDb();
}

/**
 * Переключение части истории
 */
export function switchPart(partIndex: number): void {
  teamChatStore.switchPart(partIndex);
  privateChatStore.setCurrentPart(partIndex);
  updatePrivateChatsContext();
}

/**
 * Удаление части истории
 */
export function deletePart(partIndex: number): void {
  if (!confirm('Удалить эту часть истории?')) return;
  teamChatStore.deletePart(partIndex);
  privateChatStore.deletePart(partIndex);
  saveSessionToDb();
  ui.notify('Часть удалена', 'success');
}