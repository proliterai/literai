import { get } from 'svelte/store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { loggingStore } from '$lib/domain/logging/logging.store'; // <-- ИМПОРТ ЛОГОВ

// Функция вычисления косинусного сходства
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class EmbeddingService {
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const s = get(settingsStore).values;
    const url = s[SETTINGS_KEYS.EMBEDDING_URL];
    const model = s[SETTINGS_KEYS.EMBEDDING_MODEL];
    const key = s[SETTINGS_KEYS.EMBEDDING_KEY];

    if (!s[SETTINGS_KEYS.EMBEDDING_ENABLED] || !url) {
      throw new Error("Векторный поиск отключен или не настроен");
    }

    const startTime = Date.now();

    // --- 1. ЛОГИРУЕМ ЗАПРОС К API ЭМБЕДДИНГОВ ---
    loggingStore.logRequest({
      url: url,
      model: `[Векторизация] ${model}`, // Помечаем, чтобы отличать от обычного чата
      messages: [{ role: 'system', content: `Запрос векторов для ${texts.length} блоков текста...` }],
      params: { input_count: texts.length, type: 'embedding' }
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model,
          input: texts
        })
      });

      const text = await response.text();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        // --- 2. ЛОГИРУЕМ ОШИБКУ API ---
        loggingStore.logError({
          error: text,
          statusCode: response.status,
          url: url
        });
        throw new Error(`Embedding API Error: ${text}`);
      }

      const data = JSON.parse(text);

      // --- 3. ЛОГИРУЕМ УСПЕШНЫЙ ОТВЕТ ---
      // ВАЖНО: Мы не передаем data целиком, иначе тысячи чисел "повесят" UI логов
      loggingStore.logResponse({
        response: { 
          status: "success", 
          vectors_received: data.data?.length || 0,
          tokens_used: data.usage?.prompt_tokens || 'unknown'
        },
        statusCode: response.status,
        duration
      });

      return data.data.map((item: any) => item.embedding);

    } catch (e: any) {
      // Логируем сетевые ошибки (CORS, нет интернета)
      if (!e.message?.includes('Embedding API Error')) {
        loggingStore.logError({
          error: e.message || "Сетевая ошибка при запросе эмбеддингов",
          url: url
        });
      }
      throw e;
    }
  }
}

export const embeddingService = new EmbeddingService();