import { get } from 'svelte/store';
import { chatStore } from './chat.store';
import { ui } from '$lib/ui/ui.store';
import { ChatService } from './chat.service';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';

const svc = new ChatService();

function isBusy() {
  const s = get(chatStore);
  return s.isSummarizing || s.isRerolling || s.isGenerating;
}

export async function ensureFirstResponse() {
  if (isBusy()) return;
  const s = get(chatStore);
  if (!s.sessionId) return;

  const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
  if (!branch) return;

  const nonSystem = branch.messages.filter((m) => m.role !== 'system');
  const hasAssistant = nonSystem.some((m) => m.role === 'assistant');

  if (nonSystem.length === 1 && nonSystem[0].role === 'user' && !hasAssistant) {
    chatStore.setIsGenerating(true);
    try {
      const response = await svc.generateResponse();
      chatStore.addAssistantMessage(response);
    } catch (e: any) {
      chatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
      ui.notify(e.message, 'error');
    } finally {
      chatStore.setIsGenerating(false);
    }
  }
}

export async function sendMessage(text: string) {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  chatStore.addUserMessage(text);
  chatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    chatStore.addAssistantMessage(response);
  } catch (e: any) {
    chatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    chatStore.setIsGenerating(false);
  }
}

export async function reroll(messageId: string) {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  chatStore.setIsRerolling(true);
  try {
    const response = await svc.generateResponse({
      isReroll: true,
      rerollMessageId: messageId
    });
    chatStore.addAssistantVersion(messageId, response);
    ui.notify('Ответ перегенерирован', 'success');
  } catch (e: any) {
    ui.notify(`Ошибка реролла: ${e.message}`, 'error');
  } finally {
    chatStore.setIsRerolling(false);
  }
}

export async function editUserAndRegenerate(
  messageId: string,
  newText: string
) {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  chatStore.editUserMessageAndTruncate(messageId, newText);
  chatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    chatStore.addAssistantMessage(response);
    ui.notify('Продолжение перегенерировано', 'success');
  } catch (e: any) {
    chatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    chatStore.setIsGenerating(false);
  }
}

export async function branchUserAndRegenerate(
  messageId: string,
  newText: string
) {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return;
  }

  chatStore.createBranchFromEdit(messageId, newText);
  chatStore.setIsGenerating(true);

  try {
    const response = await svc.generateResponse();
    chatStore.addAssistantMessage(response);
    ui.notify('Новая ветвь продолжена', 'success');
  } catch (e: any) {
    chatStore.addAssistantMessage(`Ошибка: ${e.message}`, true);
    ui.notify(e.message, 'error');
  } finally {
    chatStore.setIsGenerating(false);
  }
}

// ИСПРАВЛЕНИЕ: Возвращаем Promise<boolean>, чтобы корректно обрабатывать успешное завершение в модалке
export async function summarize(customPrompt?: string): Promise<boolean> {
  if (isBusy()) {
    ui.notify('Подождите завершения текущей операции', 'warning');
    return false;
  }

  chatStore.setIsSummarizing(true);
  try {
    const summary = await svc.runSummarization(customPrompt);
    const basePrompt = get(systemPromptStore.activeContent);
    chatStore.createNewPartFromSummary(summary, basePrompt);
    return true; // Успех
  } catch (e: any) {
    ui.notify(`Ошибка суммаризации: ${e.message}`, 'error');
    return false; // Ошибка
  } finally {
    chatStore.setIsSummarizing(false);
  }
}