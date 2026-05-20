// ================================================================================
// ФАЙЛ: src/lib/domain/analytics/analytics.service.ts
// Описание: Расширенный сервис для AI-анализа игровой истории
// ================================================================================

import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { chatStore } from '$lib/domain/chat/chat.store';
import type { AnalyticsData, AnalyticsCache } from './analytics.types';

const ANALYSIS_PROMPT = `Ты — продвинутый аналитический модуль для ролевой игры. Проанализируй предоставленную историю максимально детально и верни ТОЛЬКО валидный JSON (без markdown, без комментариев) следующей структуры:

{
  "meta": {
    "storyPhase": "начало | завязка | развитие | кульминация | развязка",
    "overallTension": 0-100,
    "gameDay": число,
    "chapterSummary": "2-4 абзаца детального описания текущей ситуации",
    "sessionDuration": "примерная длительность сессии",
    "totalMessages": число сообщений,
    "wordCount": примерное количество слов
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
  "characters": [
    {
      "id": "id персонажа",
      "name": "имя",
      "avatar": "",
      "role": "protagonist | antagonist | ally | neutral | unknown",
      "stats": {
        "health": { "value": 0-100, "status": "описание", "trend": "up|down|stable", "criticalThreshold": 25 },
        "energy": { "value": 0-100, "status": "описание", "trend": "up|down|stable" },
        "hunger": { "value": 0-100, "status": "описание", "trend": "up|down|stable" },
        "sanity": { "value": 0-100, "status": "описание", "trend": "up|down|stable" },
        "mana": { "value": 0-100 или null, "status": "описание", "trend": "up|down|stable" }
      },
      "mood": {
        "primary": "название эмоции",
        "emoji": "эмодзи",
        "description": "краткое описание",
        "intensity": 0-100
      },
      "statusEffects": [
        { "name": "название", "icon": "эмодзи", "isPositive": true/false, "severity": "низкая|средняя|высокая", "duration": "длительность", "source": "источник" }
      ],
      "currentGoal": "чего хочет персонаж",
      "secretThought": "скрытая мысль (спойлер)",
      "screenTime": 0-100,
      "dialogueCount": число реплик,
      "characterArc": {
        "name": "название арки персонажа",
        "stage": "начало | развитие | кризис | трансформация | завершение",
        "description": "описание развития",
        "keyMoments": ["момент 1", "момент 2"],
        "potentialOutcomes": ["исход 1", "исход 2"]
      },
      "strengths": ["сильная сторона 1", "сильная сторона 2"],
      "weaknesses": ["слабость 1", "слабость 2"],
      "relationships": ["краткое описание отношений с другими"]
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
      "magic": 0-100 или null,
      "hostility": 0-100 или null
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
        "locked": true/false,
        "requirement": "что нужно или null",
        "description": "краткое описание пути",
        "travelTime": "время в пути"
      }
    ],
    "history": "история локации",
    "secrets": ["секрет 1", "секрет 2"],
    "inhabitants": ["обитатель 1", "обитатель 2"]
  },
  "relationships": [
    {
      "fromId": "id",
      "fromName": "имя",
      "toId": "id",
      "toName": "имя",
      "value": от -100 до +100,
      "type": "романтика|симпатия|дружба|уважение|нейтралитет|неприязнь|вражда|соперничество|страх|зависимость|наставничество|преданность",
      "status": "описание отношений",
      "recentChange": "up|down|stable",
      "hasTension": true/false,
      "history": ["событие 1", "событие 2"],
      "sharedMemories": ["общее воспоминание"]
    }
  ],
  "inventory": {
    "resources": {
      "gold": число,
      "food": число,
      "special": [{ "name": "название", "amount": число, "icon": "эмодзи" }]
    },
    "items": [
      {
        "name": "название",
        "icon": "эмодзи",
        "quantity": число,
        "category": "weapon|armor|potion|key|scroll|food|valuable|tool|artifact|clothing|document|unknown",
        "owner": "имя персонажа или shared",
        "description": "описание",
        "questRelated": true/false,
        "hint": "подсказка или null",
        "rarity": "common|uncommon|rare|epic|legendary",
        "usable": true/false
      }
    ],
    "capacity": {
      "current": число,
      "max": число
    }
  },
  "quests": {
    "main": {
      "name": "название главного квеста",
      "description": "описание",
      "currentObjective": "текущая цель",
      "progress": 0-100,
      "stages": [
        { "name": "название этапа", "status": "pending|current|completed|skipped", "completedAt": "когда завершен или null" }
      ],
      "deadline": "дедлайн или null",
      "stakes": "что на кону"
    },
    "side": [
      {
        "name": "название",
        "description": "описание",
        "progress": 0-100,
        "status": "active|completed|failed|hidden",
        "giver": "кто дал квест",
        "reward": "награда",
        "timeLimit": "ограничение по времени или null"
      }
    ],
    "hints": ["подсказка 1", "подсказка 2"],
    "completed": число завершённых,
    "failed": число проваленных
  },
  "predictions": {
    "immediateOptions": [
      {
        "action": "описание действия",
        "risk": "low|medium|high",
        "potentialReward": "описание награды",
        "insertText": "текст для вставки в чат",
        "category": "combat|social|exploration|stealth|magic|other",
        "requiredItem": "необходимый предмет или null",
        "successChance": 0-100
      }
    ],
    "plotHooks": ["зацепка 1", "зацепка 2"],
    "warnings": [
      { 
        "text": "текст предупреждения", 
        "severity": "low|medium|high",
        "category": "combat|social|resource|time|story",
        "suggestion": "что делать"
      }
    ],
    "opportunities": ["возможность 1", "возможность 2"],
    "characterMoments": [
      {
        "character": "имя персонажа",
        "opportunity": "описание момента",
        "type": "развитие|конфликт|откровение|выбор"
      }
    ]
  },
  "storyAdvice": {
    "writingTips": [
      {
        "category": "pacing|character|dialogue|description|conflict",
        "tip": "совет",
        "example": "пример применения"
      }
    ],
    "plotSuggestions": [
      {
        "title": "название предложения",
        "description": "описание",
        "impact": "minor|moderate|major",
        "insertText": "текст для вставки"
      }
    ],
    "characterDevelopment": [
      {
        "character": "имя",
        "suggestion": "предложение по развитию",
        "trigger": "что может это запустить"
      }
    ],
    "atmosphereEnhancement": ["совет по атмосфере 1", "совет 2"]
  },
  "timeline": [
    {
      "id": "уникальный id",
      "timestamp": "время события",
      "title": "заголовок",
      "description": "описание",
      "type": "action|dialogue|discovery|combat|relationship|plot",
      "importance": "low|medium|high",
      "characters": ["персонаж 1", "персонаж 2"],
      "location": "локация"
    }
  ],
  "sessionStats": {
    "duration": "длительность",
    "messagesCount": число,
    "wordsWritten": число,
    "averageMessageLength": число слов,
    "longestMessage": число слов,
    "characterDistribution": { "имя": процент экранного времени },
    "actionVsDialogue": {
      "action": процент,
      "dialogue": процент,
      "description": процент
    },
    "emotionalJourney": [
      {
        "point": 0-100 (позиция в истории),
        "emotion": "эмоция",
        "trigger": "что вызвало"
      }
    ]
  }
}

Анализируй историю внимательно и глубоко. Ищи скрытые смыслы, нераскрытый потенциал персонажей, сюжетные дыры и возможности. Если данных недостаточно, делай разумные предположения на основе контекста. Возвращай ТОЛЬКО JSON, без пояснений.`;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа
const CACHE_VERSION = '2.0';

export class AnalyticsService {
	private cache: AnalyticsCache = { data: null, lastAnalysisTime: null, version: CACHE_VERSION };

	constructor() {
		this.loadFromCache();
	}

	private loadFromCache(): void {
		try {
			const cached = localStorage.getItem('analytics_cache_v2');
			if (cached) {
				const parsed = JSON.parse(cached);
				if (parsed.version === CACHE_VERSION) {
					this.cache = parsed;
				} else {
					this.clearCache();
				}
			}
		} catch (e) {
			console.error('[Analytics] Ошибка загрузки кэша:', e);
		}
	}

	private saveToCache(): void {
		try {
			localStorage.setItem('analytics_cache_v2', JSON.stringify(this.cache));
		} catch (e) {
			console.error('[Analytics] Ошибка сохранения кэша:', e);
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
		localStorage.removeItem('analytics_cache_v2');
	}

	collectContext(): string {
		let context = '=== КОНТЕКСТ ИСТОРИИ ===\n';

		const chatState = get(chatStore);

		// Добавляем скрипт сессии
		if (chatState.generatedScript) {
			context += `=== СЦЕНАРИЙ ===\n${chatState.generatedScript}\n\n`;
		}

		// Добавляем информацию о персонажах из selectedItems
		if (chatState.selectedItems) {
			context += `=== ПЕРСОНАЖИ ===\n`;
			if (chatState.selectedItems.systemCharacter) {
				context += `Система (ИИ): ${chatState.selectedItems.systemCharacter.name}\n`;
				if (chatState.selectedItems.systemCharacter.description) {
					context += `Описание: ${chatState.selectedItems.systemCharacter.description}\n`;
				}
				if (chatState.selectedItems.systemCharacter.avatar) {
					context += `Аватар системы: ${chatState.selectedItems.systemCharacter.avatar}\n`;
				}
			}
			if (chatState.selectedItems.userCharacter) {
				context += `Игрок: ${chatState.selectedItems.userCharacter.name}\n`;
				if (chatState.selectedItems.userCharacter.description) {
					context += `Описание: ${chatState.selectedItems.userCharacter.description}\n`;
				}
				if (chatState.selectedItems.userCharacter.avatar) {
					context += `Аватар игрока: ${chatState.selectedItems.userCharacter.avatar}\n`;
				}
			}
			if (chatState.selectedItems.scene) {
				context += `\n=== СЦЕНА ===\n`;
				context += `Название: ${chatState.selectedItems.scene.name}\n`;
				context += `Описание: ${chatState.selectedItems.scene.description || 'Нет описания'}\n`;
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
				const name =
					msg.role === 'assistant'
						? (chatState.selectedItems?.systemCharacter?.name ?? 'Рассказчик')
						: (chatState.selectedItems?.userCharacter?.name ?? 'Персонаж');
				context += `${name}: ${content}\n\n`;
				messageCount++;
				wordCount += content.split(/\s+/).length;
			});

			context += `\n=== СТАТИСТИКА ===\n`;
			context += `Сообщений: ${messageCount}\n`;
			context += `Примерно слов: ${wordCount}\n`;
		}

		// Добавляем суммаризации предыдущих частей
		const summaries = chatStore.getAccumulatedSummaries(10);
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
			const chatState = get(chatStore);
			const selectedItems = chatState.selectedItems;

			if (!selectedItems || !analyticsData.characters) {
				return analyticsData;
			}

			const avatarMap: Record<string, string> = {};

			if (selectedItems.systemCharacter?.avatar) {
				avatarMap[selectedItems.systemCharacter.name.toLowerCase().trim()] =
					selectedItems.systemCharacter.avatar;
			}

			if (selectedItems.userCharacter?.avatar) {
				avatarMap[selectedItems.userCharacter.name.toLowerCase().trim()] =
					selectedItems.userCharacter.avatar;
			}

			analyticsData.characters.forEach((char) => {
				if (char.name) {
					const key = char.name.toLowerCase().trim();
					if (avatarMap[key]) {
						char.avatar = avatarMap[key];
					}
				}
			});

			console.log('[Analytics] Аватары синхронизированы из данных сессии');
		} catch (e) {
			console.warn('[Analytics] Ошибка синхронизации аватаров:', e);
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
			console.error('[Analytics] Ошибка парсинга JSON:', e);
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
				console.log('[Analytics] Использованы кэшированные данные');
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

		console.log('[Analytics] Анализ завершён, данные сохранены в кэш');

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

		if (!data.characters) data.characters = [];
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
				characterDistribution: {},
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