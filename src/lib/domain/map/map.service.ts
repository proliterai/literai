// src/lib/domain/map/map.service.ts
import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { loggingStore } from '$lib/domain/logging/logging.store';

const MAP_PROMPT = `Ты — дотошный картограф и архитектор миров. Твоя задача: проанализировать историю и составить МАКСИМАЛЬНО ПОДРОБНЫЙ пространственный граф всех локаций, где побывали персонажи или которые упоминались.

Тебе нужно построить МНОГОУРОВНЕВУЮ топологию:
- Макро-уровень: Страны, регионы, города, леса, горы.
- Средний уровень: Конкретные улицы, районы, кварталы, площади, крупные подземелья.
- Микро-уровень: Здания, таверны, замки, пещеры.
- Ультра-микро уровень (если события происходят внутри): Конкретные комнаты, залы, коридоры, подвалы, этажи, балконы.

ПРАВИЛА СВЯЗЕЙ (edges):
1. Если локация Б находится ВНУТРИ локации А (например, "Кухня" внутри "Таверны"), создай связь с label "Внутри" или "Часть".
2. Если локации соединены физически (дверь, коридор, тропа), опиши это в label (например, "Дверь дубовая", "Лестница вниз", "Тайный ход").

Верни ТОЛЬКО валидный JSON следующей структуры:
{
  "nodes": [
    { "id": 1, "label": "Название локации/комнаты", "group": "room", "description": "Детальное описание того, что там находится и что там происходило" }
  ],
  "edges": [
    { "from": 1, "to": 2, "label": "Как они связаны" }
  ]
}

Доступные группы (group) строго из этого списка:
- "region" (страны, королевства, глобальные зоны)
- "city" (города, поселения)
- "street" (улицы, площади, дворы)
- "building" (дома, таверны, замки снаружи)
- "room" (комнаты, залы, коридоры, этажи внутри зданий)
- "nature" (леса, поля, реки, болота)
- "dungeon" (глобальные подземелья, руины)
- "dungeon_room" (конкретные камеры, пещеры и коридоры в подземелье)
- "unknown" (остальное)

Верни ТОЛЬКО JSON без markdown разметки (\`\`\`json) и без комментариев. Будь очень подробен, не упускай ни одной упомянутой комнаты или тропинки.`;

export class MapService {
  async generateMap(script: string, history: string): Promise<any> {
    const provider = await providersRepo.getActive();
    if (!provider) throw new Error('Нет активного провайдера ИИ.');

    const context = `БАЗОВЫЙ СЦЕНАРИЙ И МИР:\n${script}\n\nХРОНОЛОГИЯ СОБЫТИЙ (Где были персонажи):\n${history}`;

    const messages = [
      { role: 'system', content: MAP_PROMPT },
      { role: 'user', content: context }
    ];

    const startTime = Date.now();
    try {
      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
        // Увеличили max_tokens, так как детальная карта требует много JSON-текста
        body: JSON.stringify({ model: provider.model, messages, temperature: 0.2, max_tokens: 8000 })
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Ошибка API (${resp.status}): ${err}`);
      }
      
      const data = await resp.json();
      let content = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Очистка от markdown
      content = content.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) content = jsonMatch[0];

      return JSON.parse(content);
    } catch (e: any) {
      console.error('[MapService] Error:', e);
      throw new Error('Не удалось сгенерировать карту. Проверьте логи.');
    }
  }
}

export const mapService = new MapService();