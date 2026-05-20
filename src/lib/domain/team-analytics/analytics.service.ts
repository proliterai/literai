// ================================================================================
// ФАЙЛ: src/lib/domain/team-analytics/analytics.service.ts
// Описание: AI-Аналитика для режима "Командная игра" с учетом приватных чатов
// ================================================================================

import { get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';
import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
import type { TeamAnalyticsData, TeamAnalyticsCache } from './analytics.types';

const ANALYSIS_PROMPT = `Ты — продвинутый аналитический модуль для ролевой игры с КОМАНДОЙ персонажей. Проанализируй историю (включая основные события и приватные переписки между персонажами) и верни ТОЛЬКО валидный JSON (без markdown). Структура строго следующая:

{
  "meta": {
    "storyPhase": "начало | завязка | развитие | кульминация | развязка",
    "overallTension": 0-100,
    "gameDay": 1,
    "chapterSummary": "2-4 абзаца детального описания текущей ситуации в команде и сюжете",
    "sessionDuration": "примерная длительность",
    "totalMessages": 0,
    "wordCount": 0,
    "privateMessageCount": 0
  },
  "storyAnalytics": {
    "currentArc": { "name": "название", "description": "описание", "progress": 0, "startedAt": "когда началась" },
    "pacing": { "current": "умеренный", "recommendation": "совет" },
    "tone": { "primary": "экшен", "secondary": "драма" },
    "themes": [ { "name": "Тема", "icon": "🎭", "prominence": 80, "examples": ["пример"] } ],
    "unresolved": [ { "type": "тайна", "description": "описание", "importance": "high", "suggestedResolution": "идея" } ]
  },
  "characters": [
    {
      "id": "системный id или имя",
      "name": "имя персонажа",
      "avatar": "",
      "role": "team_member | antagonist | ally | neutral | unknown",
      "stats": {
        "health": { "value": 100, "status": "Здоров", "trend": "stable" },
        "energy": { "value": 80, "status": "Бодр", "trend": "down" },
        "morale": { "value": 50, "status": "Сомневается", "trend": "down" }
      },
      "mood": { "primary": "напряжен", "emoji": "😰", "description": "Переживает из-за недавних событий" },
      "statusEffects": [ { "name": "Усталость", "icon": "🥱", "isPositive": false } ],
      "currentGoal": "Найти выход",
      "secretThought": "Не доверяет командиру (спойлер)",
      "strengths": ["Ловкость"],
      "weaknesses": ["Вспыльчивость"]
    }
  ],
  "location": {
    "name": "Тёмный лес",
    "type": "лес",
    "description": "Мрачное место",
    "atmosphere": { "danger": 80, "comfort": 10, "mystery": 90 },
    "pointsOfInterest": [ { "name": "Старый колодец", "icon": "🕳️", "status": "unexplored", "hint": "Кто-то там есть" } ],
    "exits": [ { "direction": "Север", "destination": "Горы", "danger": 50, "locked": false } ]
  },
  "relationships": [
    {
      "fromId": "id1", "fromName": "Имя1",
      "toId": "id2", "toName": "Имя2",
      "value": 50,
      "type": "дружба",
      "status": "Доверяют друг другу",
      "recentChange": "up",
      "hasTension": false,
      "notes": "Помирились после ссоры в приватном чате"
    }
  ],
  "inventory": {
    "resources": { "gold": 100, "food": 5, "special": [] },
    "items": [ { "name": "Меч", "icon": "⚔️", "quantity": 1, "owner": "Имя", "description": "Острый", "rarity": "common" } ]
  },
  "quests": {
    "main": { "name": "Спасти мир", "description": "Найти артефакт", "currentObjective": "Дойти до леса", "progress": 20 },
    "side": [],
    "hints": ["Обратите внимание на колодец"]
  },
  "predictions": {
    "immediateOptions": [ { "action": "Атаковать", "risk": "high", "potentialReward": "Победа", "insertText": "Команда бросается в атаку", "category": "combat" } ],
    "plotHooks": ["Шорох в кустах"],
    "warnings": [ { "text": "Заканчивается еда", "severity": "medium" } ],
    "characterMoments": [ { "character": "Имя", "opportunity": "Шанс проявить лидерство", "type": "развитие" } ]
  },
  "storyAdvice": {
    "writingTips": [ { "category": "pacing", "tip": "Ускорьте темп", "example": "Добавьте экшен сцену" } ],
    "plotSuggestions": [ { "title": "Засада", "description": "Враги атакуют", "impact": "major" } ],
    "atmosphereEnhancement": ["Опишите холодный ветер"]
  },
  "sessionStats": {
    "duration": "Неизвестно",
    "messagesCount": 0,
    "wordsWritten": 0,
    "actionVsDialogue": { "action": 40, "dialogue": 60, "description": 0 }
  }
}

Удели особое внимание разделу relationships и secretThought. В командной игре динамика группы важнее всего. Анализируй приватные чаты, чтобы понять скрытые мотивы персонажей. Возвращай ТОЛЬКО JSON.`;

const CACHE_DURATION = 24 * 60 * 60 * 1000;
const CACHE_VERSION = '2.0';

class TeamAnalyticsService {
	private cache: TeamAnalyticsCache = { data: null, lastAnalysisTime: null, version: CACHE_VERSION };

	constructor() {
		this.loadFromCache();
	}

	private loadFromCache(): void {
		try {
			const cached = localStorage.getItem('team_analytics_cache_v2');
			if (cached) {
				const parsed = JSON.parse(cached);
				if (parsed.version === CACHE_VERSION) {
					this.cache = parsed;
				} else {
					this.clearCache();
				}
			}
		} catch (e) {
			console.error('[TeamAnalytics] Ошибка загрузки кэша:', e);
		}
	}

	private saveToCache(): void {
		try {
			localStorage.setItem('team_analytics_cache_v2', JSON.stringify(this.cache));
		} catch (e) {
			console.error('[TeamAnalytics] Ошибка сохранения кэша:', e);
		}
	}

	isCacheExpired(): boolean {
		if (!this.cache.lastAnalysisTime) return true;
		return Date.now() - this.cache.lastAnalysisTime > CACHE_DURATION;
	}

	getCachedData(): TeamAnalyticsData | null {
		if (!this.cache.data || this.isCacheExpired()) return null;
		return this.cache.data;
	}

	getLastAnalysisTime(): number | null {
		return this.cache.lastAnalysisTime;
	}

	clearCache(): void {
		this.cache = { data: null, lastAnalysisTime: null, version: CACHE_VERSION };
		localStorage.removeItem('team_analytics_cache_v2');
	}

	collectContext(): string {
		let context = '=== КОНТЕКСТ КОМАНДНОЙ ИСТОРИИ ===\n';
		const chatState = get(teamChatStore);
		const privateState = get(privateChatStore);

		if (chatState.generatedScript) {
			context += `=== СЦЕНАРИЙ И МИР ===\n${chatState.generatedScript}\n\n`;
		}

		if (chatState.selectedItems?.teamCharacters) {
			context += `=== КОМАНДА ===\n`;
			chatState.selectedItems.teamCharacters.forEach((char: any) => {
				context += `- ${char.name}: ${char.description || 'Без описания'}\n`;
			});
		}

		const branch = chatState.chatTree.branches[chatState.chatTree.activeBranchIndex];
		if (branch?.messages) {
			context += `\n=== ОСНОВНОЙ ЧАТ (ПУБЛИЧНЫЕ ДЕЙСТВИЯ) ===\n`;
			const messages = branch.messages.filter((m: any) => m.role !== 'system').slice(-40);
			messages.forEach((msg: any) => {
				const content = msg.versions?.length ? (msg.versions[msg.activeVersion ?? 0]?.content ?? msg.content) : msg.content;
				const name = msg.role === 'assistant' ? 'Рассказчик' : (msg.characterName || 'Персонаж');
				context += `${name}: ${content}\n\n`;
			});
		}

		const privateMessages = privateChatStore.getPrivateMessagesForMainHistory();
		if (privateMessages.length > 0) {
			context += `\n=== ПРИВАТНЫЕ ЧАТЫ (СКРЫТЫЕ ОТ ОСТАЛЬНЫХ ДЕЙСТВИЯ И МЫСЛИ) ===\n`;
			privateMessages.slice(-30).forEach((msg: any) => {
				const sender = msg.role === 'user' ? msg.senderName : msg.characterName;
				context += `[Секретно] ${sender} пишет для ${msg.recipientName}: ${msg.content}\n\n`;
			});
		}

		return context;
	}

	syncAvatarsFromSession(analyticsData: TeamAnalyticsData): TeamAnalyticsData {
		try {
			const chatState = get(teamChatStore);
			const teamChars = chatState.selectedItems?.teamCharacters || [];

			if (!analyticsData.characters) return analyticsData;

			const avatarMap: Record<string, string> = {};
			const idMap: Record<string, string> = {};

			teamChars.forEach((char: any) => {
				if (char.avatar) avatarMap[char.name.toLowerCase().trim()] = char.avatar;
				idMap[char.name.toLowerCase().trim()] = char.id;
			});

			analyticsData.characters.forEach((char) => {
				const key = char.name.toLowerCase().trim();
				if (avatarMap[key]) {
					char.avatar = avatarMap[key];
				}
				if (idMap[key] && (!char.id || char.id.includes('unknown'))) {
					char.id = idMap[key];
				}
			});
			console.log('[TeamAnalytics] Аватары и ID синхронизированы из данных сессии');
		} catch (e) {
			console.warn('[TeamAnalytics] Ошибка синхронизации аватаров:', e);
		}
		return analyticsData;
	}

	async callProvider(messages: Array<{ role: string; content: string }>): Promise<string> {
		const provider = await providersRepo.getActive();
		if (!provider) {
			throw new Error('Нет активного провайдера. Настройте провайдера в настройках.');
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 120000);

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
				} catch {}
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

	parseAnalyticsJSON(text: string): TeamAnalyticsData {
		text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) text = jsonMatch[0];

		try {
			return JSON.parse(text);
		} catch (e) {
			console.error('[TeamAnalytics] Ошибка парсинга JSON:', e);
			text = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
			return JSON.parse(text);
		}
	}

	async runAnalysis(forceUpdate: boolean = false): Promise<TeamAnalyticsData> {
		if (!forceUpdate) {
			const cached = this.getCachedData();
			if (cached) {
				console.log('[TeamAnalytics] Использованы кэшированные данные');
				return cached;
			}
		}

		const context = this.collectContext();

		if (!context || context.trim().length < 100) {
			throw new Error('Недостаточно данных для анализа. Начните историю и добавьте несколько сообщений.');
		}

		const messages = [
			{ role: 'system', content: ANALYSIS_PROMPT },
			{ role: 'user', content: context }
		];

		const responseText = await this.callProvider(messages);
		let analyticsData = this.parseAnalyticsJSON(responseText);

		analyticsData = this.syncAvatarsFromSession(analyticsData);
		analyticsData = this.validateAndFillDefaults(analyticsData);

		// Проставляем timestamp
		analyticsData.timestamp = Date.now();

		this.cache.data = analyticsData;
		this.cache.lastAnalysisTime = Date.now();
		this.saveToCache();

		console.log('[TeamAnalytics] Анализ завершён, данные сохранены в кэш');
		return analyticsData;
	}

	private validateAndFillDefaults(data: TeamAnalyticsData): TeamAnalyticsData {
		if (!data.meta) {
			data.meta = {
				storyPhase: 'начало',
				overallTension: 0,
				gameDay: 1,
				chapterSummary: 'Анализ недоступен',
				sessionDuration: 'Неизвестно',
				totalMessages: 0,
				wordCount: 0,
				privateMessageCount: 0
			};
		}
		if (!data.storyAnalytics) {
			data.storyAnalytics = {
				currentArc: { name: 'Начало', description: '', progress: 0, startedAt: 'Сейчас' },
				pacing: { current: 'умеренный', recommendation: '' },
				tone: { primary: 'приключение', secondary: null },
				themes: [],
				unresolved: []
			};
		}
		if (!data.characters) data.characters = [];
		if (!data.relationships) data.relationships = [];
		if (!data.predictions) {
			data.predictions = { immediateOptions: [], plotHooks: [], warnings: [], characterMoments: [] };
		}
		if (!data.storyAdvice) {
			data.storyAdvice = { writingTips: [], plotSuggestions: [], atmosphereEnhancement: [] };
		}
		if (!data.sessionStats) {
			data.sessionStats = {
				duration: 'Неизвестно',
				messagesCount: 0,
				wordsWritten: 0,
				actionVsDialogue: { action: 33, dialogue: 33, description: 34 }
			};
		}
		return data;
	}
}

export const teamAnalyticsService = new TeamAnalyticsService();