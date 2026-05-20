// ================================================================================
// ФАЙЛ: src/lib/domain/private-chat/privateChat.types.ts
// Описание: Единые канонические типы для приватных чатов
// ================================================================================

export interface PrivateMessageVersion {
  content: string;
  createdAt: string;
}

export interface PrivateMessage {
  id: string;
  recipientId: string;
  recipientName: string;
  role: 'user' | 'assistant';
  content: string;
  
  // Для сообщений от пользователя (выбранный персонаж-отправитель)
  senderName?: string;
  senderAvatar?: string;
  senderCharacterId?: string;
  
  // Для сообщений от ИИ (персонаж-получатель)
  characterId?: string;
  characterName?: string;
  characterAvatar?: string;
  
  versions?: PrivateMessageVersion[];
  currentVersion?: number;
  createdAt: string;
}

export interface PrivateChatData {
  messages: PrivateMessage[];
  senderCarouselIndex: number;
}

// Структура хранения: { partIndex: { recipientId: PrivateChatData } }
export type PrivateChatsStore = Record<number, Record<string, PrivateChatData>>;

export interface PrivateChatState {
  characters: Array<{ id: string; name: string; avatar?: string }>;
  privateChats: PrivateChatsStore;
  currentPartIndex: number;
  activeRecipientId: string | null;
  isVisible: boolean;
  mainChatHistory: any[];
  generatedScript: string;
  itemDescriptions: any | null;
  isGenerating: boolean;
}

export interface PrivateChatExportData {
  privateChats: PrivateChatsStore;
  currentPartIndex: number;
  exportedAt: string;
}