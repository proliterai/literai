// ================================================================================
// ФАЙЛ: src/lib/domain/private-chat/privateChat.store.ts
// Описание: Хранилище приватных чатов между персонажами
// ================================================================================

import { writable, get } from 'svelte/store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { loggingStore } from '$lib/domain/logging/logging.store';

// Путь к плейсхолдеру аватара
const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

export interface PrivateMessage {
  id: string;
  recipientId: string;
  recipientName: string;
  role: 'user' | 'assistant';
  content: string;
  senderName?: string;
  senderAvatar?: string;
  senderCharacterId?: string;
  characterName?: string;
  characterAvatar?: string;
  characterId?: string;
  versions?: Array<{ content: string; createdAt: string }>;
  currentVersion?: number;
  createdAt: string;
}

export interface PrivateChatData {
  messages: PrivateMessage[];
  senderCarouselIndex: number;
}

export interface PrivateChatState {
  isVisible: boolean;
  characters: Array<{ id: string; name: string; avatar?: string }>;
  activeRecipientId: string | null;
  privateChats: Record<number, Record<string, PrivateChatData>>; // partIndex -> recipientId -> data
  currentPartIndex: number;
  mainChatHistory: any[];
  generatedScript: string;
  itemDescriptions: any;
  isGenerating: boolean;
}

const initialState: PrivateChatState = {
  isVisible: false,
  characters: [],
  activeRecipientId: null,
  privateChats: {},
  currentPartIndex: 0,
  mainChatHistory: [],
  generatedScript: '',
  itemDescriptions: null,
  isGenerating: false
};

function mid(): string {
  return `pmsg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createPrivateChatStore() {
  const store = writable<PrivateChatState>(initialState);
  const { subscribe, set, update } = store;

  return {
    subscribe,
    update,

    init(config: {
      characters: Array<{ id: string; name: string; avatar?: string }>;
      mainChatHistory: any[];
      generatedScript: string;
      itemDescriptions: any;
      currentPartIndex?: number;
    }): void {
      update(s => ({
        ...s,
        characters: config.characters.map(c => ({
          ...c,
          avatar: c.avatar || AVATAR_PLACEHOLDER
        })),
        mainChatHistory: config.mainChatHistory,
        generatedScript: config.generatedScript,
        itemDescriptions: config.itemDescriptions,
        currentPartIndex: config.currentPartIndex ?? 0,
        privateChats: s.privateChats[config.currentPartIndex ?? 0] ? s.privateChats : { [config.currentPartIndex ?? 0]: {} }
      }));
    },

    setVisible(visible: boolean): void {
      update(s => ({ ...s, isVisible: visible }));
    },

    open(): void {
      update(s => ({ ...s, isVisible: true }));
    },

    close(): void {
      update(s => ({ ...s, isVisible: false }));
    },

    openChat(recipientId: string): void {
      update(s => {
        const partChats = { ...s.privateChats[s.currentPartIndex] } || {};
        if (!partChats[recipientId]) {
          partChats[recipientId] = { messages: [], senderCarouselIndex: 0 };
        }
        return {
          ...s,
          activeRecipientId: recipientId,
          privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats }
        };
      });
    },

    setCurrentPart(partIndex: number): void {
      update(s => {
        const newPrivateChats = { ...s.privateChats };
        if (!newPrivateChats[partIndex]) {
          newPrivateChats[partIndex] = {};
        }
        return { ...s, currentPartIndex: partIndex, privateChats: newPrivateChats };
      });
    },

    createNewPart(partIndex: number): void {
      update(s => {
        const newPrivateChats = { ...s.privateChats };
        if (!newPrivateChats[partIndex]) {
          newPrivateChats[partIndex] = {};
        }
        return { ...s, currentPartIndex: partIndex, privateChats: newPrivateChats };
      });
    },

    deletePart(partIndex: number): void {
      update(s => {
        const newChats = { ...s.privateChats };
        delete newChats[partIndex];
        // Переиндексация
        const reindexed: Record<number, Record<string, PrivateChatData>> = {};
        Object.keys(newChats).forEach(key => {
          const idx = parseInt(key);
          if (idx > partIndex) {
            reindexed[idx - 1] = newChats[idx];
          } else {
            reindexed[idx] = newChats[idx];
          }
        });
        return {
          ...s,
          privateChats: reindexed,
          currentPartIndex: Math.max(0, s.currentPartIndex - 1)
        };
      });
    },

    // Обновление контекста основного чата
    updateMainChatContext(history: any[], script?: string, descriptions?: any): void {
      update(s => ({
        ...s,
        mainChatHistory: history,
        generatedScript: script ?? s.generatedScript,
        itemDescriptions: descriptions ?? s.itemDescriptions
      }));
    },

    async sendMessage(text: string): Promise<void> {
      const state = get(store);
      if (!state.activeRecipientId || !text.trim()) return;

      const recipientId = state.activeRecipientId;
      const recipient = state.characters.find(c => c.id === recipientId);
      if (!recipient) return;

      // Определяем отправителя из карусели
      const partChats = state.privateChats[state.currentPartIndex] || {};
      const chatData = partChats[recipientId] || { messages: [], senderCarouselIndex: 0 };
      const availableSenders = state.characters.filter(c => c.id !== recipientId);
      const sender = availableSenders[chatData.senderCarouselIndex] || availableSenders[0];

      if (!sender) return;

      const userMsg: PrivateMessage = {
        id: mid(),
        recipientId,
        recipientName: recipient.name,
        role: 'user',
        content: text.trim(),
        senderName: sender.name,
        senderAvatar: sender.avatar || AVATAR_PLACEHOLDER,
        senderCharacterId: sender.id,
        createdAt: nowIso()
      };

      update(s => {
        const partChats = { ...s.privateChats[s.currentPartIndex] } || {};
        const oldChat = partChats[recipientId];
        const newChat: PrivateChatData = oldChat
          ? { ...oldChat, messages: [...oldChat.messages, userMsg] }
          : { messages: [userMsg], senderCarouselIndex: 0 };
        partChats[recipientId] = newChat;
        return {
          ...s,
          isGenerating: true,
          privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats }
        };
      });

      // Генерируем ответ
      try {
        const response = await this.generateResponse(recipientId, recipient, sender, text);

        const botMsg: PrivateMessage = {
          id: mid(),
          recipientId,
          recipientName: recipient.name,
          role: 'assistant',
          content: response,
          characterName: recipient.name,
          characterAvatar: recipient.avatar || AVATAR_PLACEHOLDER,
          characterId: recipient.id,
          versions: [{ content: response, createdAt: nowIso() }],
          currentVersion: 0,
          createdAt: nowIso()
        };

        update(s => {
          const partChats = { ...s.privateChats[s.currentPartIndex] } || {};
          const oldChat = partChats[recipientId];
          const newChat: PrivateChatData = oldChat
            ? { ...oldChat, messages: [...oldChat.messages, botMsg] }
            : { messages: [botMsg], senderCarouselIndex: 0 };
          partChats[recipientId] = newChat;
          return {
            ...s,
            isGenerating: false,
            privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats }
          };
        });
      } catch (e: any) {
        console.error('[PrivateChat] Generation error:', e);
        update(s => ({ ...s, isGenerating: false }));
      }
    },

    async generateResponse(
      recipientId: string,
      recipient: { id: string; name: string; avatar?: string },
      sender: { id: string; name: string; avatar?: string },
      lastMessage: string
    ): Promise<string> {
      const state = get(store);
      const provider = await providersRepo.getActive();
      if (!provider) throw new Error('Нет активного провайдера');

      // Формируем контекст
      let context = `КОНТЕКСТ ИСТОРИИ:\n${state.generatedScript}\n\n`;
      
      // Добавляем историю основного чата (полностью для текущей ветки)
      if (state.mainChatHistory.length > 0) {
        context += 'СОБЫТИЯ В ОСНОВНОЙ ИСТОРИИ (Текущая часть):\n';
        state.mainChatHistory.forEach(msg => {
          if (msg.role === 'system') return;
          const name = msg.role === 'assistant' ? 'Рассказчик' : (msg.characterName || 'Персонаж');
          context += `${name}: ${msg.content}\n\n`;
        });
      }

      // История приватного чата (полностью)
      const partChats = state.privateChats[state.currentPartIndex] || {};
      const chat = partChats[recipientId];
      if (chat?.messages.length) {
        context += `ИСТОРИЯ ПРИВАТНОЙ СЦЕНЫ между ${sender.name} и ${recipient.name}:\n`;
        chat.messages.forEach(m => {
          const name = m.role === 'user' ? m.senderName : m.characterName;
          context += `${name}: ${m.content}\n\n`;
        });
      }

      const systemPrompt = `Ты играешь роль ${recipient.name} в приватной сцене с ${sender.name}.
Отвечай от первого лица как ${recipient.name}. Учитывай контекст истории и отношения между персонажами.
Пиши естественно, развивай историю, взаимодействуй с персонажем, поддерживай диалог, реагируй на реплики собеседника.

${context}`;

      const userPrompt = `${sender.name} говорит ${recipient.name}:\n"${lastMessage}"\n\nРеагируй как ${recipient.name}:`;

      // Получаем настройки генерации из глобального стора
      const gen = get(settingsStore.generation);

      // Формируем тело запроса
      const reqBody = {
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: gen.temperature,
        max_tokens: gen.max_tokens,
        top_p: gen.top_p,
        frequency_penalty: gen.frequency_penalty,
        presence_penalty: gen.presence_penalty,
        stream: false
      };

      // --- ЛОГИРОВАНИЕ ЗАПРОСА ---
      const startTime = Date.now();
      loggingStore.logRequest({
        url: provider.url,
        model: provider.model,
        messages: reqBody.messages,
        params: {
          temperature: reqBody.temperature,
          max_tokens: reqBody.max_tokens,
          top_p: reqBody.top_p,
          frequency_penalty: reqBody.frequency_penalty,
          presence_penalty: reqBody.presence_penalty,
          stream: reqBody.stream
        }
      });

      try {
        const resp = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify(reqBody)
        });

        const text = await resp.text();
        const duration = Date.now() - startTime;

        if (!resp.ok) {
          let errorDetails = text;
          try {
            const json = JSON.parse(text);
            if (json.error?.message) errorDetails = json.error.message;
          } catch {}
          
          // --- ЛОГИРОВАНИЕ ОШИБКИ API ---
          loggingStore.logError({
            error: errorDetails,
            statusCode: resp.status,
            url: provider.url
          });
          
          throw new Error(`API Error ${resp.status}: ${errorDetails}`);
        }

        const data = JSON.parse(text);
        
        // --- ЛОГИРОВАНИЕ УСПЕШНОГО ОТВЕТА ---
        loggingStore.logResponse({
          response: data,
          statusCode: resp.status,
          duration
        });

        return data.choices?.[0]?.message?.content || 'Ошибка генерации';
        
      } catch (e: any) {
        // --- ЛОГИРОВАНИЕ СЕТЕВЫХ ОШИБОК (CORS, Timeout и тд) ---
        if (e.message?.includes('fetch') || e.name === 'TypeError') {
          loggingStore.logError({
            error: 'Не удалось подключиться к провайдеру (CORS или сеть).',
            url: provider.url
          });
        } else if (!e.message?.includes('API Error')) {
          loggingStore.logError({
            error: e.message || 'Неизвестная ошибка',
            url: provider.url
          });
        }
        throw e;
      }
    },

    // Получаем приватные сообщения ТОЛЬКО для текущей части (чтобы не дублировать старые саммари)
    getPrivateMessagesForMainHistory(): PrivateMessage[] {
      const state = get(store);
      const allMessages: PrivateMessage[] = [];

      const partChats = state.privateChats[state.currentPartIndex];
      if (partChats) {
        Object.values(partChats).forEach(chatData => {
          if (chatData.messages) {
            allMessages.push(...chatData.messages);
          }
        });
      }

      return allMessages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    },

    async reroll(messageId: string): Promise<void> {
      const state = get(store);
      if (!state.activeRecipientId) return;

      const recipientId = state.activeRecipientId;
      const partChats = state.privateChats[state.currentPartIndex] || {};
      const chat = partChats[recipientId];
      if (!chat) return;

      const msgIndex = chat.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return;

      const msg = chat.messages[msgIndex];
      if (msg.role !== 'assistant') return;

      const prevUserMsg = chat.messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
      if (!prevUserMsg) return;

      const recipient = state.characters.find(c => c.id === recipientId);
      const sender = state.characters.find(c => c.id === prevUserMsg.senderCharacterId);
      if (!recipient || !sender) return;

      update(s => ({ ...s, isGenerating: true }));

      try {
        const newContent = await this.generateResponse(recipientId, recipient, sender, prevUserMsg.content);

        update(s => {
          const partChats = { ...s.privateChats[s.currentPartIndex] };
          const oldChat = partChats[recipientId];
          if (!oldChat) return { ...s, isGenerating: false };

          const messages = oldChat.messages.map((m, idx) => {
            if (idx !== msgIndex) return m;

            const versions = m.versions 
              ? [...m.versions, { content: newContent, createdAt: nowIso() }]
              : [{ content: m.content, createdAt: m.createdAt }, { content: newContent, createdAt: nowIso() }];

            return {
              ...m,
              versions,
              currentVersion: versions.length - 1,
              content: newContent
            };
          });

          const newChat: PrivateChatData = { ...oldChat, messages };
          partChats[recipientId] = newChat;

          return {
            ...s,
            isGenerating: false,
            privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats }
          };
        });
      } catch (e) {
        console.error('[PrivateChat] Reroll error:', e);
        update(s => ({ ...s, isGenerating: false }));
      }
    },

    editMessage(messageId: string, newContent: string): void {
      update(s => {
        if (!s.activeRecipientId) return s;

        const partChats = { ...s.privateChats[s.currentPartIndex] };
        const oldChat = partChats[s.activeRecipientId];
        if (!oldChat) return s;

        const messages = oldChat.messages.map(m => {
          if (m.id !== messageId) return m;
          
          if (m.versions && m.versions.length > 0 && m.currentVersion !== undefined) {
            const newVersions = m.versions.map((v, idx) => 
              idx === m.currentVersion 
                ? { ...v, content: newContent }
                : v
            );
            return { ...m, content: newContent, versions: newVersions };
          }
          
          return { ...m, content: newContent };
        });

        const newChat: PrivateChatData = { ...oldChat, messages };
        partChats[s.activeRecipientId] = newChat;

        return { ...s, privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats } };
      });
    },

    switchVersion(messageId: string, direction: -1 | 1): void {
      update(s => {
        if (!s.activeRecipientId) return s;

        const partChats = { ...s.privateChats[s.currentPartIndex] };
        const oldChat = partChats[s.activeRecipientId];
        if (!oldChat) return s;

        const messages = oldChat.messages.map(m => {
          if (m.id !== messageId || !m.versions || m.versions.length < 2) return m;

          const total = m.versions.length;
          let next = (m.currentVersion ?? 0) + direction;
          if (next < 0) next = total - 1;
          if (next >= total) next = 0;

          return {
            ...m,
            currentVersion: next,
            content: m.versions[next].content
          };
        });

        const newChat: PrivateChatData = { ...oldChat, messages };
        partChats[s.activeRecipientId] = newChat;

        return { ...s, privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats } };
      });
    },

    deleteMessage(messageId: string): void {
      update(s => {
        if (!s.activeRecipientId) return s;

        const partChats = { ...s.privateChats[s.currentPartIndex] };
        const oldChat = partChats[s.activeRecipientId];
        if (!oldChat) return s;

        const messages = oldChat.messages.filter(m => m.id !== messageId);
        
        const newChat: PrivateChatData = { ...oldChat, messages };
        partChats[s.activeRecipientId] = newChat;

        return { ...s, privateChats: { ...s.privateChats, [s.currentPartIndex]: partChats } };
      });
    },

    exportData(): any {
      const state = get(store);
      return {
        privateChats: state.privateChats,
        currentPartIndex: state.currentPartIndex,
        exportedAt: nowIso()
      };
    },

    importData(data?: any): void {
      if (!data) {
        update(s => ({
          ...s,
          privateChats: {},
          activeRecipientId: null,
          currentPartIndex: 0
        }));
        return;
      }
      update(s => ({
        ...s,
        privateChats: data.privateChats || {},
        currentPartIndex: data.currentPartIndex ?? s.currentPartIndex
      }));
    },

    reset(): void {
      set(initialState);
    }
  };
}

export const privateChatStore = createPrivateChatStore();