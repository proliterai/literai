import { get } from 'svelte/store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { loggingStore } from '$lib/domain/logging/logging.store';
import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
import { teamChatStore } from './teamChat.store';
import { teamSystemPromptStore } from '$lib/domain/team-system-prompt/teamSystemPrompt.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';

type ApiMsg = { role: 'system' | 'user' | 'assistant'; content: string };

function stripThinkTags(text: string): string {
  return String(text ?? '').replace(/<think[\s\S]*?<\/think>/gi, '').trim();
}

export class TeamChatService {
  
  prepareMessagesForAPI(opts?: { isReroll?: boolean; rerollMessageId?: string }): ApiMsg[] {
    const state = get(teamChatStore);
    const branch = state.chatTree.branches[state.chatTree.activeBranchIndex];
    if (!branch) return [];

    const all = branch.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.role === 'assistant'
          ? (m.versions?.length ? m.versions[m.activeVersion ?? 0]?.content ?? m.content : m.content)
          : m.content
    }));

    if (opts?.isReroll && opts.rerollMessageId) {
      const idx = branch.messages.findIndex((m) => m.id === opts.rerollMessageId);
      if (idx > 0) return all.slice(0, idx);
    }

    return all;
  }

  private getActivePromptSet() {
    const spState = get(teamSystemPromptStore);
    return spState.customSets[spState.activeSetId] ||
           spState.customPresets.find(p => p.id === spState.activeSetId) ||
           spState.sets.find(p => p.id === spState.activeSetId) ||
           spState.sets[0];
  }

  private appendToLastMessage(messages: ApiMsg[], injectText: string): ApiMsg[] {
    const result = [...messages];
    const lastMsgIndex = result.length - 1;
    if (lastMsgIndex >= 0) {
      result[lastMsgIndex] = {
        ...result[lastMsgIndex],
        content: result[lastMsgIndex].content + injectText
      };
    }
    return result;
  }

  async injectLorebook(messages: ApiMsg[]): Promise<ApiMsg[]> {
    const d = get(lorebookStore);
    if (!d.data?.entries?.length) return messages;
    
    const res = await lorebookStore.scan(messages);
    if (!res?.content) return messages;
    
    const inject = `\n\n[СИСТЕМНОЕ НАПОМИНАНИЕ: АКТУАЛЬНЫЕ ЗНАНИЯ О МИРЕ (LOREBOOK)]\n${res.content}\n`;
    return this.appendToLastMessage(messages, inject);
  }

  injectCheatmode(messages: ApiMsg[]): ApiMsg[] {
    const enabled = get(cheatmodeStore.isEnabled);
    if (!enabled) return messages;
    const ctx = cheatmodeStore.getContextForPrompt();
    if (!ctx) return messages;
    const inject = `\n\n[СИСТЕМНОЕ НАПОМИНАНИЕ ДЛЯ ИИ (СТРОГО СОБЛЮДАТЬ!)]\n=== НАСТРОЙКИ МИРА И ОТНОШЕНИЙ ПЕРСОНАЖЕЙ ===\n${ctx}\n`;
    return this.appendToLastMessage(messages, inject);
  }

  injectPrivateChats(messages: ApiMsg[]): ApiMsg[] {
    const privateMessages = privateChatStore.getPrivateMessagesForMainHistory();
    if (!privateMessages || privateMessages.length === 0) return messages;

    let privateContext = '\n\n[СИСТЕМНОЕ НАПОМИНАНИЕ: ПРИВАТНЫЕ СЦЕНЫ МЕЖДУ ПЕРСОНАЖАМИ]\n';
    privateContext += '(Эти сцены произошли между персонажами наедине. Учитывай их тайные мотивы, договоренности и отношения в своем повествовании)\n\n';

    const byRecipient: Record<string, any[]> = {};
    privateMessages.forEach(msg => {
      if (!byRecipient[msg.recipientId]) byRecipient[msg.recipientId] = [];
      byRecipient[msg.recipientId].push(msg);
    });

    Object.entries(byRecipient).forEach(([, msgs]) => {
      const recipientName = msgs[0]?.recipientName || 'Персонаж';
      privateContext += `--- Приватная сцена с ${recipientName} ---\n`;
      msgs.forEach(msg => {
        const senderName = msg.role === 'user' ? msg.senderName : msg.characterName;
        privateContext += `[${senderName}]: ${msg.content}\n\n`;
      });
      privateContext += `--- Конец сцены ---\n\n`;
    });

    return this.appendToLastMessage(messages, privateContext);
  }

  async callProvider(body: any): Promise<string> {
    const provider = await providersRepo.getActive();
    if (!provider) throw new Error('Нет активного провайдера. Настройте провайдера в настройках.');

    const startTime = Date.now();
    loggingStore.logRequest({ url: provider.url, model: provider.model, messages: body.messages, params: { temperature: body.temperature, max_tokens: body.max_tokens, top_p: body.top_p, frequency_penalty: body.frequency_penalty, presence_penalty: body.presence_penalty, stream: body.stream } });

    try {
      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ ...body, stream: false })
      });

      const text = await resp.text();
      const duration = Date.now() - startTime;

      if (!resp.ok) {
        let errorDetails = text;
        try { const json = JSON.parse(text); if (json.error?.message) errorDetails = json.error.message; } catch {}
        loggingStore.logError({ error: errorDetails, statusCode: resp.status, url: provider.url });
        throw new Error(`Ошибка API (${resp.status}): ${errorDetails}`);
      }

      const data = JSON.parse(text);
      loggingStore.logResponse({ response: data, statusCode: resp.status, duration });

      const content = data.choices?.[0]?.message?.content ?? data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Пустой ответ от AI');
      return String(content);

    } catch (e: any) {
      if (e.message?.includes('fetch') || e.name === 'TypeError') {
        const error = 'Не удалось подключиться к провайдеру.';
        loggingStore.logError({ error, url: provider.url });
        throw new Error(error);
      }
      if (!e.message?.includes('Ошибка API')) loggingStore.logError({ error: e.message || 'Неизвестная ошибка', url: provider.url });
      throw e;
    }
  }

  async generateNarratorResponse(opts?: { isFirst?: boolean; isReroll?: boolean; rerollMessageId?: string }): Promise<string> {
    let messages = this.prepareMessagesForAPI(opts);
    const activeSet = this.getActivePromptSet();

    messages.push({
      role: 'user',
      content: `[Команда системе]: ${activeSet.continuation}`
    });

    messages = await this.injectLorebook(messages);
    messages = this.injectCheatmode(messages);
    messages = this.injectPrivateChats(messages);

    // --- ИНЖЕКТ ОКА МИРА И MEMORY BOOK ---
    const eyeContext = eyeStore.getContextForMainChat();
    const mbContext = await memoryBookStore.getContextForMainChat(); // Асинхронный вызов
    
    if (eyeContext || mbContext) {
      messages = this.appendToLastMessage(messages, eyeContext + mbContext);
    }
    // -------------------------------------

    const gen = get(settingsStore.generation);
    const provider = await providersRepo.getActive();

    return this.callProvider({
      model: provider?.model,
      messages,
      temperature: opts?.isReroll ? gen.temperature + 0.1 : gen.temperature,
      max_tokens: gen.max_tokens,
      top_p: gen.top_p,
      frequency_penalty: gen.frequency_penalty,
      presence_penalty: gen.presence_penalty
    });
  }

  async generateCharacterResponse(characterId: string, opts?: { isReroll?: boolean; rerollMessageId?: string }): Promise<string> {
    let messages = this.prepareMessagesForAPI(opts);
    const activeSet = this.getActivePromptSet();

    const state = get(teamChatStore);
    const char = state.selectedItems?.teamCharacters?.find(c => c.id === characterId);
    const charName = char?.name || 'Персонаж';

    let charPrompt = activeSet.characterActing.replace(/{CharacterName}/g, charName);

    let charDesc = state.itemDescriptions?.characters?.[characterId] || char?.description;
    if (charDesc) {
      charPrompt += `\n\n[ОПИСАНИЕ ТВОЕГО ПЕРСОНАЖА]:\n${charDesc}`;
    }

    messages.push({
      role: 'user',
      content: `[Команда системе]: ${charPrompt}`
    });

    messages = await this.injectLorebook(messages);
    messages = this.injectCheatmode(messages);
    messages = this.injectPrivateChats(messages);

    // --- ИНЖЕКТ ОКА МИРА И MEMORY BOOK ---
    const eyeContext = eyeStore.getContextForMainChat();
    const mbContext = await memoryBookStore.getContextForMainChat(); // Асинхронный вызов
    
    if (eyeContext || mbContext) {
      messages = this.appendToLastMessage(messages, eyeContext + mbContext);
    }
    // -------------------------------------

    const gen = get(settingsStore.generation);
    const provider = await providersRepo.getActive();

    return this.callProvider({
      model: provider?.model,
      messages,
      temperature: opts?.isReroll ? gen.temperature + 0.1 : gen.temperature,
      max_tokens: gen.max_tokens,
      top_p: gen.top_p,
      frequency_penalty: gen.frequency_penalty,
      presence_penalty: gen.presence_penalty
    });
  }

  async buildSummaryPrompt(customPrompt?: string): Promise<string> { // Асинхронная функция
    const s = get(teamChatStore);
    const currentPart = s.chatParts[s.currentPartIndex];
    const branches = s.chatTree.branches.filter(b => currentPart?.branchIds.includes(b.id));

    let history = '';
    for (const b of branches) {
      for (const m of b.messages) {
        if (m.role === 'system') continue;
        const content = m.versions?.length ? m.versions[m.activeVersion ?? 0]?.content ?? m.content : m.content;
        if (m.role === 'user') {
          const name = (m as any).characterName || 'Персонаж';
          history += `${name}: ${content}\n\n`;
        }
        if (m.role === 'assistant') {
          history += `Рассказчик: ${stripThinkTags(content)}\n\n`;
        }
      }
    }

    const summaries = teamChatStore.getAccumulatedSummaries(5);
    let out = `ИНФОРМАЦИЯ О СЦЕНАРИИ И ПЕРСОНАЖАХ:\n${s.generatedScript}\n\n`;

    if (summaries.length) {
      out += 'КРАТКИЙ ПЕРЕСКАЗ ПРЕДЫДУЩИХ ЧАСТЕЙ:\n';
      for (const x of summaries) out += `${x.partName}: ${x.summary}\n\n`;
    }

    if (get(cheatmodeStore.isEnabled)) {
      const cheat = cheatmodeStore.getContextForPrompt();
      if (cheat) out += `\n[Текущее состояние мира]:\n${cheat}\n\n`;
    }

    const mbContext = await memoryBookStore.getContextForMainChat(); // Асинхронный вызов
    if (mbContext) {
      out += `\n[АКТУАЛЬНАЯ ПАМЯТЬ ИСТОРИИ (Memory Book)]:\n${mbContext}\n\n`;
    }

    const privateMessages = privateChatStore.getPrivateMessagesForMainHistory();
    if (privateMessages.length) {
      out += '\n=== ПРИВАТНЫЕ СЦЕНЫ (СЕКРЕТЫ И ИНТРИГИ) ===\n';
      privateMessages.forEach(msg => {
        const sender = msg.role === 'user' ? msg.senderName : msg.characterName;
        out += `[${sender} шепчет ${msg.recipientName}]: ${msg.content}\n\n`;
      });
      out += '\n';
    }

    const eyeContext = eyeStore.getContextForMainChat();
    if (eyeContext) {
      out += `\n=== ВИДЕНИЯ ОКА МИРА ===${eyeContext}\n`;
    }

    out += `ИСТОРИЯ ТЕКУЩЕГО ЧАТА (${currentPart?.name || 'Часть'}):\n${history}\n\n`;
    out += `ЗАДАНИЕ: ${customPrompt ?? get(settingsStore.summarizePrompt)}`;
    return out;
  }

  async runSummarization(customPrompt?: string): Promise<string> {
    const provider = await providersRepo.getActive();
    if (!provider) throw new Error('Нет активного провайдера');

    const prompt = await this.buildSummaryPrompt(customPrompt); // Ожидаем формирования промпта
    return this.callProvider({
      model: provider.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 24_000
    }).then(x => x.trim());
  }
}

export const teamChatService = new TeamChatService();