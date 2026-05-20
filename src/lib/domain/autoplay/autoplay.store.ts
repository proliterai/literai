// ================================================================================
// ФАЙЛ: src/lib/domain/autoplay/autoplay.store.ts
// Описание: Стор для управления Автоигрой (одиночной и командной)
// ================================================================================
import { writable, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import { chatStore } from '$lib/domain/chat/chat.store';
import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store';
import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';
import { sendMessage as chatSendMessage } from '$lib/domain/chat/chat.actions';
import { sendMessage as heroSendMessage } from '$lib/domain/hero-chat/heroChat.actions';
import { sendAsNarrator, sendAsCharacter } from '$lib/domain/team-chat/teamChat.actions';
import { parseBotResponse } from '$lib/domain/chat/parseBotResponse';

const GENERATION_TIMEOUT_MS = 180_000;

export type TeamTurn = {
	id: string;
	actorId: string;
	actorName: string;
};

type AutoplayState = {
	isRunning: boolean;
	isPaused: boolean;
	mode: 'roleplay' | 'hero' | 'team' | null;

	// Настройки
	delaySeconds: number;

	// Для ролевой и героя
	targetMessages: number;
	currentMessages: number;

	// Для команды
	teamSequence: TeamTurn[];
	currentSequenceIndex: number;

	// Защита от старых параллельных циклов
	sessionId: number;
};

const initial: AutoplayState = {
	isRunning: false,
	isPaused: false,
	mode: null,
	delaySeconds: 16, // Дефолтная задержка
	targetMessages: 5,
	currentMessages: 0,
	teamSequence: [],
	currentSequenceIndex: 0,
	sessionId: 0
};

function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getActiveBranch(state: any) {
	return state?.chatTree?.branches?.[state?.chatTree?.activeBranchIndex] ?? null;
}

function getLastAssistantMessage(storeRef: any) {
	const state = get(storeRef);
	const branch = getActiveBranch(state);
	if (!branch?.messages?.length) return null;

	for (let i = branch.messages.length - 1; i >= 0; i--) {
		const msg = branch.messages[i];
		if (msg?.role === 'assistant') {
			return msg;
		}
	}

	return null;
}

function getLastAssistantMessageId(storeRef: any): string | null {
	const msg = getLastAssistantMessage(storeRef);
	return msg?.id ?? null;
}

function waitForGeneration(storeRef: any, timeoutMs = GENERATION_TIMEOUT_MS): Promise<void> {
	return new Promise((resolve, reject) => {
		const current = get(storeRef);

		if (!current || typeof current.isGenerating === 'undefined' || !current.isGenerating) {
			resolve();
			return;
		}

		let unsub = () => {};
		const timer = setTimeout(() => {
			unsub();
			reject(new Error('Таймаут ожидания генерации'));
		}, timeoutMs);

		unsub = storeRef.subscribe((s: any) => {
			if (!s?.isGenerating) {
				clearTimeout(timer);
				unsub();
				resolve();
			}
		});
	});
}

function waitForNewAssistantMessage(
	storeRef: any,
	previousMessageId: string | null,
	timeoutMs = GENERATION_TIMEOUT_MS
): Promise<any> {
	return new Promise((resolve, reject) => {
		const currentMsg = getLastAssistantMessage(storeRef);

		if (currentMsg?.id && currentMsg.id !== previousMessageId) {
			resolve(currentMsg);
			return;
		}

		let unsub = () => {};
		const timer = setTimeout(() => {
			unsub();
			reject(new Error('Таймаут ожидания нового сообщения ассистента'));
		}, timeoutMs);

		unsub = storeRef.subscribe(() => {
			const msg = getLastAssistantMessage(storeRef);
			if (msg?.id && msg.id !== previousMessageId) {
				clearTimeout(timer);
				unsub();
				resolve(msg);
			}
		});
	});
}

export function createAutoplayStore() {
	const store = writable<AutoplayState>(initial);
	const { subscribe, update } = store;

	function isMySession(sessionId: number) {
		const state = get(store);
		return state.isRunning && state.sessionId === sessionId;
	}

	async function interruptibleDelay(ms: number, sessionId: number): Promise<boolean> {
		const step = 200;
		const iterations = Math.ceil(ms / step);

		for (let i = 0; i < iterations; i++) {
			const state = get(store);
			if (!state.isRunning || state.sessionId !== sessionId || state.isPaused) {
				return false;
			}
			await delay(step);
		}

		const state = get(store);
		return state.isRunning && state.sessionId === sessionId && !state.isPaused;
	}

	async function waitWhilePaused(sessionId: number): Promise<boolean> {
		while (get(store).isPaused) {
			if (!isMySession(sessionId)) return false;
			await delay(300);
		}
		return isMySession(sessionId);
	}

	// =========================================================================
	// ЦИКЛ ДЛЯ РОЛЕВОЙ И ГЕРОЯ
	// =========================================================================
	async function runStandardLoop(sessionId: number) {
		let lastProcessedAssistantId: string | null = null;
		let isFirstTurn = true;

		try {
			while (isMySession(sessionId)) {
				if (get(store).isPaused) {
					const canContinue = await waitWhilePaused(sessionId);
					if (!canContinue) break;
					continue;
				}

				const state = get(store);

				if (state.currentMessages >= state.targetMessages) {
					stop();
					ui.notify('Автоигра успешно завершена', 'success');
					break;
				}

				const activeStore = state.mode === 'hero' ? heroChatStore : chatStore;

				let assistantMsg: any = null;

				if (isFirstTurn) {
					assistantMsg = getLastAssistantMessage(activeStore);

					if (!assistantMsg) {
						try {
							await waitForGeneration(activeStore);
						} catch {
							stop();
							ui.notify('Таймаут генерации. Автоигра остановлена.', 'error');
							break;
						}

						if (!isMySession(sessionId)) break;
						assistantMsg = getLastAssistantMessage(activeStore);
					}

					if (!assistantMsg) {
						stop();
						ui.notify('Ошибка: нет сообщения ассистента для первого хода', 'error');
						break;
					}
				} else {
					try {
						await waitForGeneration(activeStore);
					} catch {
						stop();
						ui.notify('Таймаут генерации. Автоигра остановлена.', 'error');
						break;
					}

					if (!isMySession(sessionId)) break;

					try {
						assistantMsg = await waitForNewAssistantMessage(
							activeStore,
							lastProcessedAssistantId
						);
					} catch {
						stop();
						ui.notify('Не удалось дождаться нового ответа ассистента', 'error');
						break;
					}
				}

				if (!isMySession(sessionId)) break;
				if (!assistantMsg) {
					await delay(500);
					continue;
				}

				const assistantMsgId = assistantMsg.id ?? null;
				if (!assistantMsgId) {
					await delay(1000);
					continue;
				}

				if (assistantMsgId === lastProcessedAssistantId) {
					await delay(1000);
					continue;
				}

				const content = assistantMsg.versions?.length
					? (assistantMsg.versions[assistantMsg.activeVersion ?? 0]?.content ??
						assistantMsg.content)
					: assistantMsg.content;

				const parsed = parseBotResponse(content);

				if (parsed.choices.length < 2) {
					stop();
					ui.notify(
						'Автоигра остановлена: нейросеть не предложила вариантов действий',
						'warning'
					);
					break;
				}

				// Берем задержку из стора
				const currentDelayMs = get(store).delaySeconds * 1000;
				const canProceed = await interruptibleDelay(currentDelayMs, sessionId);
				if (!canProceed) continue;

				const randomChoice =
					parsed.choices[Math.floor(Math.random() * parsed.choices.length)];

				lastProcessedAssistantId = assistantMsgId;
				isFirstTurn = false;

				if (state.mode === 'hero') {
					heroSendMessage(randomChoice);
				} else {
					chatSendMessage(randomChoice);
				}

				update((s) => ({ ...s, currentMessages: s.currentMessages + 1 }));

				// Даём времени стору переключить isGenerating в true
				await delay(1500);
			}
		} catch (error) {
			console.error('[Autoplay] Ошибка стандартного цикла:', error);
			stop();
			ui.notify('Автоигра остановлена из-за ошибки', 'error');
		}
	}

	// =========================================================================
	// ЦИКЛ ДЛЯ КОМАНДЫ
	// =========================================================================
	async function runTeamLoop(sessionId: number) {
		try {
			while (isMySession(sessionId)) {
				if (get(store).isPaused) {
					const canContinue = await waitWhilePaused(sessionId);
					if (!canContinue) break;
					continue;
				}

				const state = get(store);

				if (state.currentSequenceIndex >= state.teamSequence.length) {
					stop();
					ui.notify('Командная автоигра завершила все ходы', 'success');
					break;
				}

				try {
					await waitForGeneration(teamChatStore);
				} catch {
					stop();
					ui.notify('Таймаут генерации. Командная автоигра остановлена.', 'error');
					break;
				}

				if (!isMySession(sessionId)) break;

				// Берем задержку из стора
				const currentDelayMs = get(store).delaySeconds * 1000;
				const canProceed = await interruptibleDelay(currentDelayMs, sessionId);
				if (!canProceed) continue;

				const freshState = get(store);
				const turn = freshState.teamSequence[freshState.currentSequenceIndex];
				if (!turn) {
					stop();
					ui.notify('Ошибка: не найден следующий ход команды', 'error');
					break;
				}

				if (turn.actorId === 'narrator') {
					sendAsNarrator();
				} else {
					sendAsCharacter(turn.actorId);
				}

				update((s) => ({
					...s,
					currentSequenceIndex: s.currentSequenceIndex + 1
				}));

				await delay(1500);
			}
		} catch (error) {
			console.error('[Autoplay] Ошибка командного цикла:', error);
			stop();
			ui.notify('Командная автоигра остановлена из-за ошибки', 'error');
		}
	}

	// =========================================================================
	// УПРАВЛЕНИЕ
	// =========================================================================
	function start(mode: 'roleplay' | 'hero' | 'team') {
		const state = get(store);
		if (state.isRunning) return;

		const newSessionId = state.sessionId + 1;

		update((s) => ({
			...s,
			isRunning: true,
			isPaused: false,
			mode,
			currentMessages: 0,
			currentSequenceIndex: 0,
			sessionId: newSessionId
		}));

		if (mode === 'team') {
			runTeamLoop(newSessionId);
		} else {
			runStandardLoop(newSessionId);
		}
	}

	function pause() {
		update((s) => ({ ...s, isPaused: true }));
	}

	function resume() {
		update((s) => ({ ...s, isPaused: false }));
	}

	function stop() {
		update((s) => ({
			...s,
			isRunning: false,
			isPaused: false,
			currentMessages: 0,
			currentSequenceIndex: 0,
			sessionId: s.sessionId + 1
		}));
	}

	return {
		subscribe,
		setTargetMessages: (count: number) =>
			update((s) => ({ ...s, targetMessages: count })),

		setDelaySeconds: (seconds: number) =>
			update((s) => ({ ...s, delaySeconds: Math.max(1, seconds) })), // Не меньше 1 сек

		addTeamTurn: (actorId: string, actorName: string) =>
			update((s) => ({
				...s,
				teamSequence: [
					...s.teamSequence,
					{
						id: Math.random().toString(36).slice(2, 9),
						actorId,
						actorName
					}
				]
			})),

		removeTeamTurn: (turnId: string) =>
			update((s) => ({
				...s,
				teamSequence: s.teamSequence.filter((t) => t.id !== turnId)
			})),

		clearTeamTurns: () =>
			update((s) => ({
				...s,
				teamSequence: [],
				currentSequenceIndex: 0
			})),

		start,
		pause,
		resume,
		stop
	};
}

export const autoplayStore = createAutoplayStore();