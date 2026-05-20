import { get } from 'svelte/store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { loggingStore } from '$lib/domain/logging/logging.store';
import { eyeStore } from '$lib/domain/eye/eye.store';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';
import { chatStore } from './chat.store';

type ApiMsg = { role: 'system' | 'user' | 'assistant'; content: string };

function stripThinkTags(text: string) {
  return String(text ?? '').replace(/<think[\s\S]*?<\/think>/gi, '').trim();
}

export class ChatService {
  prepareMessagesForAPI(opts?: {
    isReroll?: boolean;
    rerollMessageId?: string;
  }): ApiMsg[] {
    const state = get(chatStore);
    const branch = state.chatTree.branches[state.chatTree.activeBranchIndex];
    if (!branch) return [];

    const all = branch.messages.map((m) => ({
      role: m.role,
      content:
        m.role === 'assistant'
          ? m.versions?.length
            ? m.versions[m.activeVersion ?? 0]?.content ?? m.content
            : m.content
          : m.content
    })) as ApiMsg[];

    if (opts?.isReroll && opts.rerollMessageId) {
      const idx = branch.messages.findIndex((m) => m.id === opts.rerollMessageId);
      if (idx > 0) return all.slice(0, idx);
    }

    return all;
  }

  async injectLorebook(messages: ApiMsg[]) {
    const d = get(lorebookStore);
    if (!d.data?.entries?.length) return messages;

    const res = await lorebookStore.scan(messages);
    if (!res?.content) return messages;

    const inject = `\n\n[СИСТЕМНОЕ НАПОМИНАНИЕ: АКТУАЛЬНЫЕ ЗНАНИЯ О МИРЕ (LOREBOOK)]\n${res.content}\n`;

    const result = [...messages];
    const lastMsgIndex = result.length - 1;

    if (lastMsgIndex >= 0) {
      result[lastMsgIndex] = {
        ...result[lastMsgIndex],
        content: result[lastMsgIndex].content + inject
      };
    }
    return result;
  }

  injectCheatmode(messages: ApiMsg[]) {
    const enabled = get(cheatmodeStore.isEnabled);
    if (!enabled) return messages;
    const ctx = cheatmodeStore.getContextForPrompt();
    if (!ctx) return messages;

    const inject = `\n\n[СИСТЕМНОЕ НАПОМИНАНИЕ ДЛЯ ИИ (СТРОГО СОБЛЮДАТЬ!)]\n=== НАСТРОЙКИ МИРА И ОТНОШЕНИЙ ПЕРСОНАЖЕЙ ===\n${ctx}\n`;

    const result = [...messages];
    const lastMsgIndex = result.length - 1;

    if (lastMsgIndex >= 0) {
      result[lastMsgIndex] = {
        ...result[lastMsgIndex],
        content: result[lastMsgIndex].content + inject
      };
    }
    return result;
  }

  async callProvider(body: any) {
    const provider = await providersRepo.getActive();
    if (!provider)
      throw new Error(
        'Нет активного провайдера. Настройте провайдера в настройках.'
      );

    const startTime = Date.now();

    loggingStore.logRequest({
      url: provider.url,
      model: provider.model,
      messages: body.messages,
      params: {
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stream: body.stream
      }
    });

    try {
      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({ ...body, stream: false })
      });

      const text = await resp.text();
      const duration = Date.now() - startTime;

      if (!resp.ok) {
        let errorDetails = text;
        try {
          const json = JSON.parse(text);
          if (json.error?.message) errorDetails = json.error.message;
        } catch {
          errorDetails = text.slice(0, 500);
        }

        loggingStore.logError({
          error: errorDetails,
          statusCode: resp.status,
          url: provider.url
        });

        throw new Error(`Ошибка API (${resp.status}): ${errorDetails}`);
      }

      const data = JSON.parse(text);

      loggingStore.logResponse({
        response: data,
        statusCode: resp.status,
        duration
      });

      const content =
        data.choices?.[0]?.message?.content ??
        data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content)
        throw new Error('Пустой ответ от AI (структура ответа не распознана)');
      return String(content);
    } catch (e: any) {
      const duration = Date.now() - startTime;

      if (e.message?.includes('fetch') || e.name === 'TypeError') {
        const error =
          'Не удалось подключиться к провайдеру. Проверьте интернет-соединение и URL.';
        loggingStore.logError({
          error,
          url: provider.url
        });
        throw new Error(error);
      }

      if (!e.message?.includes('Ошибка API')) {
        loggingStore.logError({
          error: e.message || 'Неизвестная ошибка',
          url: provider.url
        });
      }

      throw e;
    }
  }

  async generateResponse(opts?: {
    isReroll?: boolean;
    rerollMessageId?: string;
  }) {
    let messages = this.prepareMessagesForAPI(opts);

    messages = await this.injectLorebook(messages);
    messages = this.injectCheatmode(messages);

    // --- ИНЖЕКТ ОКА МИРА И MEMORY BOOK ---
    const eyeContext = eyeStore.getContextForMainChat();
    const mbContext = await memoryBookStore.getContextForMainChat(); // Асинхронный вызов
    
    if (eyeContext || mbContext) {
      const lastMsgIndex = messages.length - 1;
      if (lastMsgIndex >= 0) {
        messages[lastMsgIndex].content += (eyeContext + mbContext);
      }
    }
    // --------------------------------

    const gen = get(settingsStore.generation);
    const provider = await providersRepo.getActive();

    return this.callProvider({
      model: provider?.model,
      messages,
      temperature: gen.temperature,
      max_tokens: gen.max_tokens,
      top_p: gen.top_p,
      frequency_penalty: gen.frequency_penalty,
      presence_penalty: gen.presence_penalty
    });
  }

  async buildSummaryPrompt(customPrompt?: string): Promise<string> { // Асинхронная функция
    const s = get(chatStore);
    const selected = s.selectedItems;
    const currentPart = s.chatParts[s.currentPartIndex];

    const branches = s.chatTree.branches.filter((b) =>
      currentPart?.branchIds.includes(b.id)
    );

    let history = '';
    for (const b of branches) {
      for (const m of b.messages) {
        if (m.role === 'system') continue;
        if (m.role === 'user') {
          history += `${selected?.userCharacter?.name || 'Пользователь'}: ${m.content}\n\n`;
        }
        if (m.role === 'assistant') {
          const content = m.versions?.length
            ? m.versions[m.activeVersion ?? 0]?.content ?? m.content
            : m.content;
          history += `${selected?.systemCharacter?.name || 'Система'}: ${stripThinkTags(content)}\n\n`;
        }
      }
    }

    const summaries = chatStore.getAccumulatedSummaries(5);

    let out = '';
    out += `ИНФОРМАЦИЯ О СЦЕНАРИИ И ПЕРСОНАЖАХ:\n${s.generatedScript}\n\n`;

    if (summaries.length) {
      out += 'КРАТКИЙ ПЕРЕСКАЗ ПРЕДЫДУЩИХ ЧАСТЕЙ:\n';
      for (const x of summaries)
        out += `${x.partName}: ${x.summary}\n\n`;
    }

    if (get(cheatmodeStore.isEnabled)) {
      const cheat = cheatmodeStore.getContextForPrompt();
      if (cheat)
        out += `\n\n[Текущее состояние мира и отношений]:\n${cheat}\n\n`;
    }

    const mbContext = await memoryBookStore.getContextForMainChat(); // Асинхронный вызов
    if (mbContext) {
      out += `\n[АКТУАЛЬНАЯ ПАМЯТЬ ИСТОРИИ (Memory Book)]:\n${mbContext}\n\n`;
    }

    out += `ИСТОРИЯ ТЕКУЩЕГО ЧАТА (${currentPart?.name || 'Часть'}):\n${history}\n\n`;
    out += `ЗАДАНИЕ: ${customPrompt ?? get(settingsStore.summarizePrompt)}`;
    return out;
  }

  async runSummarization(customPrompt?: string) {
    const provider = await providersRepo.getActive();
    if (!provider) throw new Error('Нет активного провайдера');

    const prompt = await this.buildSummaryPrompt(customPrompt); // Ожидаем формирования промпта
    return this.callProvider({
      model: provider.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 10_000
    }).then((x) => x.trim());
  }
}