// ================================================================================
// ФАЙЛ: src/lib/domain/hero-analytics/analytics.service.ts
// Описание: Расширенный сервис для AI-анализа игровой истории в режиме "Игра за героя"
// ================================================================================

import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store';
import type { AnalyticsData, AnalyticsCache } from './analytics.types';

const ANALYSIS_PROMPT = `Ты — продвинутый аналитический модуль для ролевой игры. Проанализируй предоставленную историю максимально детально и верни ТОЛЬКО валидный JSON (без markdown, без комментариев) следующей структуры:

{
  "meta": {
    "storyPhase": "начало | завязка | развитие | кульминация | развязка",
    "overallTension": 0-100,
    "gameDay": 1,
    "chapterSummary": "2-4 абзаца детального описания текущей ситуации",
    "sessionDuration": "примерная длительность сессии",
    "totalMessages": 0,
    "wordCount": 0
  },
  "storyAnalytics": {
    "currentArc": {
      "name": "название текущей сюжетной арки",
      "description": "описание арки",
      "progress": 0-100,
      "startedAt": "когда началась арка"
    },
    "pacing": {
      "current": "очень медленный | медленный | умеренный | быстрый | стремительный",
      "recommendation": "рекомендация по темпу",
      "actionToDialogRatio": 0.0-1.0
    },
    "tone": {
      "primary": "комедия | драма | экшен | романтика | хоррор | мистика | приключение | триллер",
      "secondary": "вторичный тон или null",
      "shifts": [{ "from": "тон", "to": "тон", "trigger": "что вызвало смену" }]
    },
    "themes": [
      {
        "name": "название темы",
        "icon": "эмодзи",
        "prominence": 0-100,
        "examples": ["пример 1", "пример 2"]
      }
    ],
    "narrativeDevices": [
      {
        "name": "название приёма",
        "description": "как используется",
        "effectiveness": 0-100
      }
    ],
    "unresolved": [
      {
        "type": "вопрос | конфликт | тайна | обещание",
        "description": "описание",
        "importance": "low | medium | high",
        "suggestedResolution": "как можно разрешить"
      }
    ]
  },
  "hero": {
    "id": "id героя",
    "name": "имя",
    "avatar": "",
    "stats": {
      "health": { "value": 100, "status": "описание", "trend": "up|down|stable", "criticalThreshold": 25 },
      "energy": { "value": 100, "status": "описание", "trend": "up|down|stable" },
      "hunger": { "value": 100, "status": "описание", "trend": "up|down|stable" },
      "sanity": { "value": 100, "status": "описание", "trend": "up|down|stable" },
      "mana": { "value": 100, "status": "описание", "trend": "up|down|stable" }
    },
    "mood": {
      "primary": "название эмоции",
      "emoji": "эмодзи",
      "description": "краткое описание",
      "intensity": 80
    },
    "currentGoal": "чего хочет герой",
    "secretThought": "скрытая мысль (спойлер)",
    "screenTime": 100,
    "dialogueCount": 0,
    "strengths": ["сильная сторона 1"],
    "weaknesses": ["слабость 1"]
  },
  "npcs": [
    {
      "id": "id npc",
      "name": "имя npc",
      "role": "ally | neutral | enemy | unknown",
      "firstAppearance": "когда",
      "lastSeen": "когда",
      "meetingCount": 1
    }
  ],
  "location": {
    "name": "название локации",
    "type": "город|лес|подземелье|здание|дорога|пещера|гора|море|пустыня|болото|храм|руины|таверна|замок|деревня|другое",
    "description": "атмосферное описание места",
    "atmosphere": {
      "danger": 0-100,
      "comfort": 0-100,
      "mystery": 0-100,
      "visibility": 0-100,
      "magic": 0-100
    },
    "weather": {
      "type": "ясно|дождь|снег|туман|шторм|облачно|ветрено",
      "icon": "эмодзи погоды",
      "temperature": "холодно|прохладно|тепло|жарко",
      "impact": "влияние на геймплей",
      "changeChance": 0-100
    },
    "timeOfDay": {
      "period": "рассвет|утро|день|вечер|закат|ночь|полночь",
      "icon": "эмодзи",
      "lightLevel": 0-100,
      "description": "описание освещения"
    },
    "pointsOfInterest": [
      {
        "name": "название",
        "icon": "эмодзи",
        "status": "unexplored|exploring|explored|blocked|dangerous",
        "hint": "подсказка",
        "requirement": "что нужно для доступа или null",
        "reward": "возможная награда",
        "danger": 0-100
      }
    ],
    "exits": [
      {
        "direction": "Север|Юг|Восток|Запад|Вверх|Вниз",
        "destination": "название места",
        "danger": 0-100,
        "locked": false,
        "requirement": "что нужно или null",
        "description": "краткое описание пути",
        "travelTime": "время в пути"
      }
    ],
    "history": "история локации",
    "secrets": ["секрет 1"],
    "inhabitants": ["обитатель 1"]
  },
  "relationships": [
    {
      "npcId": "id npc",
      "npcName": "имя npc",
      "value": 50,
      "type": "дружба|вражда|нейтралитет",
      "status": "описание отношений",
      "recentChange": "up|down|stable",
      "hasTension": false,
      "history": ["событие 1"],
      "sharedMemories": ["воспоминание"]
    }
  ],
  "inventory": {
    "resources": {
      "gold": 0,
      "food": 0,
      "special": []
    },
    "items": [
      {
        "name": "название",
        "icon": "эмодзи",
        "quantity": 1,
        "category": "weapon|armor|potion|key|scroll|food|valuable|tool|artifact|clothing|document|unknown",
        "description": "описание",
        "questRelated": false,
        "hint": "подсказка или null",
        "rarity": "common|uncommon|rare|epic|legendary",
        "usable": true
      }
    ],
    "capacity": {
      "current": 0,
      "max": 100
    }
  },
  "quests": {
    "main": {
      "name": "название главного квеста",
      "description": "описание",
      "currentObjective": "текущая цель",
      "progress": 0,
      "stages": [
        { "name": "этап 1", "status": "current" }
      ]
    },
    "side": [],
    "hints": ["подсказка 1"],
    "completed": 0,
    "failed": 0
  },
  "predictions": {
    "immediateOptions": [
      {
        "action": "действие",
        "risk": "low|medium|high",
        "potentialReward": "награда",
        "insertText": "текст",
        "category": "combat|social|exploration|stealth|magic|other"
      }
    ],
    "plotHooks": ["зацепка"],
    "warnings": [],
    "opportunities": [],
    "characterMoments": []
  },
  "storyAdvice": {
    "writingTips": [],
    "plotSuggestions": [],
    "characterDevelopment": [],
    "atmosphereEnhancement": []
  },
  "timeline": [],
  "sessionStats": {
    "duration": "Неизвестно",
    "messagesCount": 0,
    "wordsWritten": 0,
    "averageMessageLength": 0,
    "longestMessage": 0,
    "heroMessageCount": 0,
    "narratorMessageCount": 0,
    "actionVsDialogue": {
      "action": 33,
      "dialogue": 33,
      "description": 34
    },
    "emotionalJourney": []
  }
}

Анализируй историю внимательно и глубоко. Возвращай ТОЛЬКО JSON, без пояснений.`;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа
const CACHE_VERSION = '2.1'; // Обновил версию, чтобы сбросить старый кэш со старой структурой

export class AnalyticsService {
	private cache: AnalyticsCache = { data: null, lastAnalysisTime: null, version: CACHE_VERSION };

	constructor() {
		this.loadFromCache();
	}

	private loadFromCache(): void {
		try {
			const cached = localStorage.getItem('hero_analytics_cache_v2');
			if (cached) {
				const parsed = JSON.parse(cached);
				if (parsed.version === CACHE_VERSION) {
					this.cache = parsed;
				} else {
					this.clearCache();
				}
			}
		} catch (e) {
			console.error('[HeroAnalytics] Ошибка загрузки кэша:', e);
		}
	}

	private saveToCache(): void {
		try {
			localStorage.setItem('hero_analytics_cache_v2', JSON.stringify(this.cache));
		} catch (e) {
			console.error('[HeroAnalytics] Ошибка сохранения кэша:', e);
		}
	}

	isCacheExpired(): boolean {
		if (!this.cache.lastAnalysisTime) return true;
		return Date.now() - this.cache.lastAnalysisTime > CACHE_DURATION;
	}

	getCachedData(): AnalyticsData | null {
		if (!this.cache.data || this.isCacheExpired()) {
			return null;
		}
		return this.cache.data;
	}

	clearCache(): void {
		this.cache = { data: null, lastAnalysisTime: null, version: CACHE_VERSION };
		localStorage.removeItem('hero_analytics_cache_v2');
	}

	collectContext(): string {
		let context = '=== КОНТЕКСТ ИСТОРИИ ===\n';

		const chatState = get(heroChatStore);

		// Добавляем скрипт сессии
		if (chatState.generatedScript) {
			context += `=== СЦЕНАРИЙ ===\n${chatState.generatedScript}\n\n`;
		}

		// Добавляем информацию о персонаже и сцене из selectedItems
		if (chatState.selectedItems) {
			context += `=== ПЕРСОНАЖ ===\n`;
			const hero = chatState.selectedItems.heroCharacter;
			if (hero) {
				context += `Имя: ${hero.name}\n`;
				if (hero.description) context += `Описание: ${hero.description}\n`;
				if (hero.avatar) context += `Аватар: ${hero.avatar}\n`;
			}
			const role = chatState.selectedItems.heroRole;
			if (role) {
				context += `\n=== РОЛЬ ===\n`;
				context += `Название: ${role.name}\n`;
				context += `Описание: ${role.description || 'Нет описания'}\n`;
			}
			const scene = chatState.selectedItems.scene;
			if (scene) {
				context += `\n=== СЦЕНА ===\n`;
				context += `Название: ${scene.name}\n`;
				context += `Описание: ${scene.description || 'Нет описания'}\n`;
			}
		}

		// Добавляем историю чата
		const branch = chatState.chatTree.branches[chatState.chatTree.activeBranchIndex];
		if (branch?.messages) {
			context += `\n=== ТЕКУЩИЕ СОБЫТИЯ ===\n`;
			const messages = branch.messages.filter((m) => m.role !== 'system').slice(-50);

			let messageCount = 0;
			let wordCount = 0;

			messages.forEach((msg) => {
				const content = msg.versions?.length
					? (msg.versions[msg.activeVersion ?? 0]?.content ?? msg.content)
					: msg.content;
				// Для пользователя — имя героя, для ассистента — "Рассказчик"
				const name =
					msg.role === 'assistant'
						? 'Рассказчик'
						: (chatState.selectedItems?.heroCharacter?.name ?? 'Герой');
				context += `${name}: ${content}\n\n`;
				messageCount++;
				wordCount += content.split(/\s+/).length;
			});

			context += `\n=== СТАТИСТИКА ===\n`;
			context += `Сообщений: ${messageCount}\n`;
			context += `Примерно слов: ${wordCount}\n`;
		}

		// Добавляем суммаризации предыдущих частей
		const summaries = heroChatStore.getAccumulatedSummaries(10);
		if (summaries.length > 0) {
			context += `\n=== ПРЕДЫСТОРИЯ ===\n`;
			summaries.forEach((s) => {
				context += `${s.partName}: ${s.summary}\n\n`;
			});
		}

		return context;
	}

	syncAvatarsFromSession(analyticsData: AnalyticsData): AnalyticsData {
		try {
			const chatState = get(heroChatStore);
			const heroChar = chatState.selectedItems?.heroCharacter;

			if (heroChar?.avatar && analyticsData.hero) {
				analyticsData.hero.avatar = heroChar.avatar;
			}

			console.log('[HeroAnalytics] Аватары синхронизированы из данных сессии');
		} catch (e) {
			console.warn('[HeroAnalytics] Ошибка синхронизации аватаров:', e);
		}

		return analyticsData;
	}

	async callProvider(messages: Array<{ role: string; content: string }>): Promise<string> {
		const provider = await providersRepo.getActive();
		if (!provider) {
			throw new Error('Нет активного провайдера. Настройте провайдера в настройках.');
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 120000); // 120 секунд для расширенного анализа

		try {
			const resp = await fetch(provider.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${provider.apiKey}`
				},
				body: JSON.stringify({
					model: provider.model,
					messages,
					temperature: 0.3,
					max_tokens: 16000,
					stream: false
				}),
				signal: controller.signal
			});

			clearTimeout(timeout);

			if (!resp.ok) {
				const text = await resp.text();
				let errorDetails = text;
				try {
					const json = JSON.parse(text);
					if (json.error?.message) errorDetails = json.error.message;
				} catch {
					// ignore parse error
				}
				throw new Error(`Ошибка API (${resp.status}): ${errorDetails}`);
			}

			const data = await resp.json();
			const content = data.choices?.[0]?.message?.content ?? '';

			if (!content) {
				throw new Error('Пустой ответ от AI');
			}

			return content;
		} catch (e: unknown) {
			clearTimeout(timeout);
			if (e instanceof Error && e.name === 'AbortError') {
				throw new Error('Таймаут запроса к API (120 секунд)');
			}
			throw e;
		}
	}

	parseAnalyticsJSON(text: string): AnalyticsData {
		// Убираем markdown обертку если есть
		text = text
			.replace(/```json\n?/gi, '')
			.replace(/```\n?/gi, '')
			.trim();

		// Пытаемся найти JSON в тексте
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			text = jsonMatch[0];
		}

		try {
			return JSON.parse(text);
		} catch (e) {
			console.error('[HeroAnalytics] Ошибка парсинга JSON:', e);
			// Пробуем исправить распространенные проблемы
			text = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
			return JSON.parse(text);
		}
	}

	async runAnalysis(forceUpdate: boolean = false): Promise<AnalyticsData> {
		// Проверяем кэш
		if (!forceUpdate) {
			const cached = this.getCachedData();
			if (cached) {
				console.log('[HeroAnalytics] Использованы кэшированные данные');
				return cached;
			}
		}

		// Собираем контекст
		const context = this.collectContext();

		if (!context || context.trim().length < 100) {
			throw new Error(
				'Недостаточно данных для анализа. Начните историю и добавьте несколько сообщений.'
			);
		}

		// Формируем запрос к API
		const messages = [
			{ role: 'system', content: ANALYSIS_PROMPT },
			{ role: 'user', content: context }
		];

		// Вызываем AI
		const responseText = await this.callProvider(messages);

		// Парсим ответ
		let analyticsData = this.parseAnalyticsJSON(responseText);

		// Синхронизируем аватары из данных сессии
		analyticsData = this.syncAvatarsFromSession(analyticsData);

		// Валидируем и дополняем данные значениями по умолчанию
		analyticsData = this.validateAndFillDefaults(analyticsData);

		// Сохраняем в кэш
		this.cache.data = analyticsData;
		this.cache.lastAnalysisTime = Date.now();
		this.saveToCache();

		console.log('[HeroAnalytics] Анализ завершён, данные сохранены в кэш');

		return analyticsData;
	}

	private validateAndFillDefaults(data: AnalyticsData): AnalyticsData {
		// Заполняем отсутствующие поля значениями по умолчанию
		if (!data.meta) {
			data.meta = {
				storyPhase: 'начало',
				overallTension: 0,
				gameDay: 1,
				chapterSummary: 'Анализ недоступен',
				sessionDuration: 'Неизвестно',
				totalMessages: 0,
				wordCount: 0
			};
		}

		if (!data.storyAnalytics) {
			data.storyAnalytics = {
				currentArc: {
					name: 'Начало истории',
					description: '',
					progress: 0,
					startedAt: 'Сейчас'
				},
				pacing: {
					current: 'умеренный',
					recommendation: '',
					actionToDialogRatio: 0.5
				},
				tone: {
					primary: 'приключение',
					secondary: null,
					shifts: []
				},
				themes: [],
				narrativeDevices: [],
				unresolved: []
			};
		}

		if (!data.hero) {
			data.hero = {
				id: 'hero',
				name: 'Герой',
				avatar: '',
				stats: {},
				mood: { primary: 'Обычное', emoji: '😐', description: '', intensity: 50 },
				currentGoal: '',
				secretThought: '',
				screenTime: 100,
				dialogueCount: 0,
				strengths: [],
				weaknesses: []
			};
		}
        
		if (!data.npcs) data.npcs = [];
		if (!data.relationships) data.relationships = [];
		if (!data.predictions) {
			data.predictions = {
				immediateOptions: [],
				plotHooks: [],
				warnings: [],
				opportunities: [],
				characterMoments: []
			};
		}
		if (!data.storyAdvice) {
			data.storyAdvice = {
				writingTips: [],
				plotSuggestions: [],
				characterDevelopment: [],
				atmosphereEnhancement: []
			};
		}
		if (!data.timeline) data.timeline = [];
		if (!data.sessionStats) {
			data.sessionStats = {
				duration: 'Неизвестно',
				messagesCount: 0,
				wordsWritten: 0,
				averageMessageLength: 0,
				longestMessage: 0,
				heroMessageCount: 0,
				narratorMessageCount: 0,
				actionVsDialogue: { action: 33, dialogue: 33, description: 34 },
				emotionalJourney: []
			};
		}

		return data;
	}

	getData(): AnalyticsData | null {
		return this.cache.data;
	}

	getLastAnalysisTime(): number | null {
		return this.cache.lastAnalysisTime;
	}
}

export const analyticsService = new AnalyticsService();