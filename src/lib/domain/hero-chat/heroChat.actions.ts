import { get } from 'svelte/store';
import { heroChatStore } from './heroChat.store';
import { ui } from '$lib/ui/ui.store';
import { HeroChatService } from './heroChat.service';
import { heroSystemPromptStore } from './heroSystemPrompt.store';

const svc = new HeroChatService();

/**
 * Проверка, не занят ли чат генерацией/рероллом/суммаризацией.
 */
function isBusy(): boolean {
  const s = get(heroChatStore);
  return s.isSummarizing || s.isRerolling || s.isGenerating;
}

/**
 * Гарантирует, что после старта сессии (или после загрузки) будет сгенерирован
 * первый ответ рассказчика, если пользователь уже отправил сообщение,
 * а ответа ещё нет.
 */
export async function ensureFirstResponse(): Promise<void> {
  if (isBusy()) return;
  const s = get(heroChatStore);
  if (!s.sessionId) return;

  const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
  if (!branch) return;

  const nonSystem = branch.messages.filter((m) => m.role !== 'system');
  const hasAssistant = nonSystem.some((m) => m.role === 'assistant');

  // Если есть хотя бы одно сообщение пользователя и нет ответа рассказчика
  if (nonSystem.length === 1 && nonSystem[0].role === 'user' && !hasAssistant) {
    heroChatStore.setIsGenerating(true);
    try {
      const response = await svc.generateResponse();
      heroChatStore.addAssistantMessage(response);
    } catch (e: any) {
      heroChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
      ui.notify(e.message, 'error');
    } finally {
      heroChatStore.setIsGenerating(false);
    }
  }
}

/**
 * Отправка сообщения от пользователя (героя) и генерация ответа рассказчика.
 */
export async function sendMessage(text: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  heroChatStore.addUserMessage(text);
  heroChatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    heroChatStore.addAssistantMessage(response);
  } catch (e: any) {
    heroChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    heroChatStore.setIsGenerating(false);
  }
}

/**
 * Перегенерация (реролл) последнего ответа рассказчика.
 */
export async function reroll(messageId: string): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  heroChatStore.setIsRerolling(true);
  try {
    const response = await svc.generateResponse({
      isReroll: true,
      rerollMessageId: messageId
    });
    heroChatStore.addAssistantVersion(messageId, response);
    ui.notify('Ответ перегенерирован', 'success');
  } catch (e: any) {
    ui.notify(`Ошибка реролла: ${e.message}`, 'error');
  } finally {
    heroChatStore.setIsRerolling(false);
  }
}

/**
 * Редактирование сообщения пользователя и перегенерация всей последующей истории.
 */
export async function editUserAndRegenerate(
  messageId: string,
  newText: string
): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  heroChatStore.editUserMessageAndTruncate(messageId, newText);
  heroChatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    heroChatStore.addAssistantMessage(response);
    ui.notify('Продолжение перегенерировано', 'success');
  } catch (e: any) {
    heroChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    heroChatStore.setIsGenerating(false);
  }
}

/**
 * Создание новой ветки из отредактированного сообщения пользователя
 * и генерация ответа рассказчика в этой ветке.
 */
export async function branchUserAndRegenerate(
  messageId: string,
  newText: string
): Promise<void> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  heroChatStore.createBranchFromEdit(messageId, newText);
  heroChatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    heroChatStore.addAssistantMessage(response);
    ui.notify('Новая ветвь продолжена', 'success');
  } catch (e: any) {
    heroChatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    heroChatStore.setIsGenerating(false);
  }
}

/**
 * Запуск суммаризации текущей части истории и создание новой части.
 * @param customPrompt - опциональный пользовательский промпт для суммаризации
 * ИСПРАВЛЕНИЕ: Возвращаем Promise<boolean>, чтобы модальное окно знало о статусе выполнения
 */
export async function summarize(customPrompt?: string): Promise<boolean> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return false;
  }

  heroChatStore.setIsSummarizing(true);
  try {
    const summary = await svc.runSummarization(customPrompt);
    // Получаем текущий базовый промпт из хранилища промптов рассказчика
    const basePrompt = get(heroSystemPromptStore.activeContent);
    heroChatStore.createNewPartFromSummary(summary, basePrompt);
    return true; // Успех
  } catch (e: any) {
    ui.notify(`Ошибка суммаризации: ${e.message}`, 'error');
    return false; // Ошибка
  } finally {
    heroChatStore.setIsSummarizing(false);
  }
}