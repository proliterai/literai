// ================================================================================
// ФАЙЛ: src/lib/domain/search/search.service.ts
// Описание: Сервис для общения с ИИ в рамках поисковой сессии
// ================================================================================

import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { loggingStore } from '$lib/domain/logging/logging.store';
import type { SearchSnippet } from '$lib/db/types';
import { SYSTEM_PROMPT_SNIPPETS, SYSTEM_PROMPT_ARTICLE } from './search.constants';

export class SearchService {
  
  // 1. ГЕНЕРАЦИЯ СНИППЕТОВ
  async generateSnippets(query: string): Promise<SearchSnippet[]> {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_SNIPPETS },
      { role: 'user', content: query }
    ];

    const responseText = await this.callProvider(messages);
    const parsed = this.parseJSONFromResponse(responseText);

    if (!parsed || !Array.isArray(parsed.snippets) || parsed.snippets.length === 0) {
      throw new Error('Нейросеть вернула некорректный формат сниппетов. Попробуйте еще раз.');
    }

    return parsed.snippets;
  }

  // 2. ГЕНЕРАЦИЯ СТАТЬИ ПО ВЫБРАННОМУ СНИППЕТУ
  async generateArticle(query: string, snippet: SearchSnippet): Promise<string> {
    const prompt = SYSTEM_PROMPT_ARTICLE
      .replace('{QUERY}', query)
      .replace('{TITLE}', snippet.title)
      .replace('{TAG}', snippet.tag)
      .replace('{DESCRIPTION}', snippet.description);

    const messages = [
      { role: 'system', content: prompt }
    ];

    // Для статьи можно накинуть токенов, если нужно, но мы берем из глобальных настроек
    return await this.callProvider(messages);
  }

  // 3. УТОЧНЯЮЩИЕ ВОПРОСЫ
  async generateClarification(
    query: string,
    snippet: SearchSnippet,
    articleContent: string,
    clarificationHistory: Array<{ role: string; content: string }>,
    newUserMsg: string
  ): Promise<string> {
    const historyText = clarificationHistory.map(m => `${m.role === 'user' ? 'Пользователь' : 'Архивариус'}: ${m.content}`).join('\n\n');
    
    const prompt = `Пользователь задал изначальный вопрос по теме "${query}" и прочитал статью "${snippet.title}".
Твоя роль: Архивариус, автор этой статьи. Ответь на уточняющий вопрос пользователя, дополняя и расширяя лор.
Используй Markdown для оформления.

=== ТЕКСТ СТАТЬИ ===
${articleContent}

=== ИСТОРИЯ УТОЧНЕНИЙ ===
${historyText ? historyText : '(история пуста)'}

=== НОВЫЙ ВОПРОС ПОЛЬЗОВАТЕЛЯ ===
${newUserMsg}

Ответь развернуто и по делу:`;

    const messages = [{ role: 'user', content: prompt }];
    return await this.callProvider(messages);
  }

  // БАЗОВЫЙ ВЫЗОВ ПРОВАЙДЕРА С ЛОГИРОВАНИЕМ
  private async callProvider(messages: Array<{ role: string; content: string }>): Promise<string> {
    const provider = await providersRepo.getActive();
    if (!provider) {
      throw new Error('Нет активного провайдера. Настройте провайдера в настройках.');
    }

    const gen = get(settingsStore.generation);
    const startTime = Date.now();

    const body = {
      model: provider.model,
      messages,
      temperature: gen.temperature,
      max_tokens: gen.max_tokens,
      top_p: gen.top_p,
      frequency_penalty: gen.frequency_penalty,
      presence_penalty: gen.presence_penalty,
      stream: false
    };

    loggingStore.logRequest({
      url: provider.url,
      model: provider.model,
      messages: body.messages,
      params: { temperature: body.temperature, max_tokens: body.max_tokens }
    });

    try {
      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify(body)
      });

      const text = await resp.text();
      const duration = Date.now() - startTime;

      if (!resp.ok) {
        let errorDetails = text;
        try {
          const json = JSON.parse(text);
          if (json.error?.message) errorDetails = json.error.message;
        } catch { }
        loggingStore.logError({ error: errorDetails, statusCode: resp.status, url: provider.url });
        throw new Error(`Ошибка API (${resp.status}): ${errorDetails}`);
      }

      const data = JSON.parse(text);
      loggingStore.logResponse({ response: data, statusCode: resp.status, duration });

      const content = data.choices?.[0]?.message?.content ?? data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        throw new Error('Пустой ответ от AI');
      }

      return String(content).trim();
    } catch (e: any) {
      if (e.message?.includes('fetch') || e.name === 'TypeError') {
        const error = 'Не удалось подключиться к провайдеру.';
        loggingStore.logError({ error, url: provider.url });
        throw new Error(error);
      }
      if (!e.message?.includes('Ошибка API')) {
        loggingStore.logError({ error: e.message || 'Неизвестная ошибка', url: provider.url });
      }
      throw e;
    }
  }

  // УМНЫЙ ПАРСЕР JSON (лечит Markdown-блоки)
  private parseJSONFromResponse(text: string): any {
    try {
      // Удаляем маркеры ```json и ```
      let cleanText = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      
      // Находим первое вхождение { и последнее }
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      
      return JSON.parse(cleanText);
    } catch (e) {
      console.error('[SearchService] Failed to parse JSON:', text);
      return null;
    }
  }
}

export const searchService = new SearchService();