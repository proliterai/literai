// ================================================================================
// ФАЙЛ: src/lib/domain/eye/eye.store.ts
// Описание: Стор для функции "Око мира" (Всевидящий экран)
// ================================================================================
import { writable, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { providersRepo } from '$lib/db/repositories/providers.repo';

export type EyeMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	isEdited?: boolean;
	createdAt: string;
};

type EyeState = {
	messages: EyeMessage[];
	isGenerating: boolean;
};

const initialState: EyeState = {
	messages: [],
	isGenerating: false
};

export const EYE_PRESETS = [
	{
		id: 'place',
		name: 'Показать место',
		prompt: 'Ты всевидящее око мира, которое может увидеть любую сцену и любое место в мире. Ты выводишь текст в ответе, который показывает что происходит в этом месте. Пришли описание того, что сейчас происходит в '
	},
	{
		id: 'character',
		name: 'Показать персонажа',
		prompt: 'Ты всевидящее око мира, которое может увидеть любого персонажа или существо этого мира. Ты выводишь текст, который показывает что сейчас делает этот персонаж, где находится, о чем думает и что замышляет. Пришли описание того, что сейчас происходит с персонажем по имени '
	},
	{
		id: 'strategist',
		name: 'Стратег',
		prompt: 'Ты стратег-планировщик в контексте ролевой игры. На основе текущей ситуации в истории составь пошаговый план действий для достижения указанной цели. Учитывай риски, альтернативные варианты и план Б. Составь план для достижения цели: '
	},
	{
		id: 'prediction',
		name: 'Прогноз событий',
		prompt: 'Ты всевидящее око мира, которое может спрогнозировать любое событие в этом мире. Ты выводишь текст, который показывает прогноз событий или возможный вариант события. Пришли описание того, что произойдет если '
	},
	{
		id: 'help',
		name: 'Помощь в игре',
		prompt: 'Ты всевидящее око мира, которое может подсказать как мне действовать или что необходимо сделать, для получения желаемого результата. Ты выводишь текст, который показывает инструкцию о том, что необходимо сделать чтобы '
	}
];

function mid() {
	return `eye_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEyeStore() {
	const store = writable<EyeState>(initialState);
	const { subscribe, update, set } = store;

	// ================================================================================
	// СБРОС СОСТОЯНИЯ
	// ================================================================================
	/**
	 * Полностью сбрасывает состояние Ока Мира к начальному (очищает память)
	 */
	function reset(): void {
		set({ messages: [], isGenerating: false });
	}

	// Сбор контекста из активного чата (динамический импорт, чтобы избежать циклических зависимостей)
	async function gatherMainContext(): Promise<string> {
		let context = '';
		try {
			// Проверяем ролевой
			const { chatStore } = await import('$lib/domain/chat/chat.store');
			if (chatStore.isSessionActive()) {
				const s = get(chatStore);
				context += `СЦЕНАРИЙ И МИР:\n${s.generatedScript}\n\n`;
				const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
				if (branch) {
					const recent = branch.messages.filter(m => m.role !== 'system').slice(-20);
					context += `ТЕКУЩИЕ СОБЫТИЯ:\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`;
				}
				return context;
			}

			// Проверяем героя
			const { heroChatStore } = await import('$lib/domain/hero-chat/heroChat.store');
			if (heroChatStore.isSessionActive()) {
				const s = get(heroChatStore);
				context += `СЦЕНАРИЙ И МИР:\n${s.generatedScript}\n\n`;
				const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
				if (branch) {
					const recent = branch.messages.filter(m => m.role !== 'system').slice(-20);
					context += `ТЕКУЩИЕ СОБЫТИЯ:\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`;
				}
				return context;
			}

			// Проверяем команду
			const { teamChatStore } = await import('$lib/domain/team-chat/teamChat.store');
			if (teamChatStore.isSessionActive()) {
				const s = get(teamChatStore);
				context += `СЦЕНАРИЙ И МИР:\n${s.generatedScript}\n\n`;
				const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
				if (branch) {
					const recent = branch.messages.filter(m => m.role !== 'system').slice(-20);
					context += `ТЕКУЩИЕ СОБЫТИЯ:\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`;
				}
				return context;
			}
		} catch (e) {
			console.warn('Failed to gather context for Eye', e);
		}
		return context;
	}

	async function sendRequest(prompt: string) {
		if (!prompt.trim()) return;

		const userMsg: EyeMessage = {
			id: mid(),
			role: 'user',
			content: prompt.trim(),
			createdAt: new Date().toISOString()
		};

		update(s => ({ ...s, messages: [...s.messages, userMsg], isGenerating: true }));

		try {
			const provider = await providersRepo.getActive();
			if (!provider) throw new Error('Нет активного провайдера ИИ');

			const mainContext = await gatherMainContext();

			const systemPrompt = `Ты всевидящий и всезнающий помощник пользователя. 
Опирайся на контекст текущей истории. Отвечай абсолютно на все вопросы.

${mainContext ? `[КОНТЕКСТ ТЕКУЩЕЙ ИСТОРИИ ДЛЯ СПРАВКИ]\n${mainContext}` : ''}`;

			// Передаем историю самого Ока мира (последние 100 сообщений)
			const eyeHistory = get(store).messages.slice(-100).map(m => ({
				role: m.role,
				content: m.content
			}));

			const messages = [
				{ role: 'system', content: systemPrompt },
				...eyeHistory
			];

			const gen = get(settingsStore.generation);

			const resp = await fetch(provider.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${provider.apiKey}`
				},
				body: JSON.stringify({
					model: provider.model,
					messages,
					temperature: gen.temperature,
					max_tokens: gen.max_tokens,
					top_p: gen.top_p,
					frequency_penalty: gen.frequency_penalty,
					presence_penalty: gen.presence_penalty,
					stream: false
				})
			});

			if (!resp.ok) {
				const err = await resp.text();
				throw new Error(`Ошибка API (${resp.status}): ${err}`);
			}

			const data = await resp.json();
			const responseContent = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text;

			if (!responseContent) throw new Error('Пустой ответ от ИИ');

			const botMsg: EyeMessage = {
				id: mid(),
				role: 'assistant',
				content: responseContent,
				createdAt: new Date().toISOString()
			};

			update(s => ({ ...s, messages: [...s.messages, botMsg], isGenerating: false }));
		} catch (error: any) {
			console.error(error);
			ui.notify(error.message || 'Ошибка генерации видения', 'error');
			update(s => ({ ...s, isGenerating: false }));
		}
	}

	return {
		subscribe,
		sendRequest,
		reset,

		editMessage(id: string, newContent: string) {
			update(s => ({
				...s,
				messages: s.messages.map(m => m.id === id ? { ...m, content: newContent, isEdited: true } : m)
			}));
		},

		deleteMessage(id: string) {
			update(s => ({
				...s,
				messages: s.messages.filter(m => m.id !== id)
			}));
		},

		clearHistory() {
			if (confirm('Очистить историю Ока Мира?')) {
				reset();
			}
		},

		// Получение текста для инжекта в основной чат
		getContextForMainChat(): string {
			const s = get(store);
			if (s.messages.length === 0) return '';

			// Берем последние успешные ответы Ока, чтобы не перегружать контекст
			const recentVisions = s.messages
				.filter(m => m.role === 'assistant')
				.slice(-50)
				.map(m => `- ${m.content}`)
				.join('\n\n');

			if (!recentVisions) return '';

			return `\n[ИНФОРМАЦИЯ ИЗ "ОКА МИРА" (Видения, инсайды и факты, которые стали известны)]\n${recentVisions}\n`;
		},

		exportData() {
			return { messages: get(store).messages };
		},

		importData(data: any) {
			if (data && Array.isArray(data.messages)) {
				set({ messages: data.messages, isGenerating: false });
			} else {
				reset();
			}
		}
	};
}

export const eyeStore = createEyeStore();