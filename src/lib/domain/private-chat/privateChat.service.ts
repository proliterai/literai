// ================================================================================
// ФАЙЛ: src/lib/domain/private-chat/privateChat.service.ts
// Описание: Сервис для приватных чатов — в текущей архитектуре вся логика генерации
// встроена в privateChat.store.ts. Этот файл оставлен для совместимости и может
// использоваться для вынесения логики в будущем.
// ================================================================================

import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';

/**
 * Сервис для приватных чатов — утилиты.
 * Основная генерация ответов выполняется в privateChat.store.ts.
 */
export class PrivateChatService {
  /**
   * Вызов API провайдера (утилита для внешнего использования).
   */
  async callProvider(params: {
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    max_tokens: number;
    model: string;
    url: string;
    apiKey: string;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }): Promise<string> {
    const body = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.topP,
      frequency_penalty: params.frequencyPenalty,
      presence_penalty: params.presencePenalty,
      stream: false
    };

    const resp = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Ошибка API (${resp.status}): ${errText.slice(0, 300)}`);
    }

    const data = await resp.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) throw new Error('Пустой ответ от AI');
    return content.trim();
  }
}

export const privateChatService = new PrivateChatService();