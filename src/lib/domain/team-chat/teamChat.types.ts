// ================================================================================
// ФАЙЛ: src/lib/domain/team-chat/teamChat.types.ts
// Описание: Типы для хранилища командного чата
// ================================================================================

import type {
  ChatMessage,
  Branch,
  ChatPart,
  ChatTree,
  PartSummaryRef,
  MsgVersion
} from '$lib/domain/chat/chat.types';

// Исправленный импорт: вместо $lib/db/db.types используем $lib/db/types
import type { CatalogItemRow } from '$lib/db/types';

// Типы для выбранных элементов в командном режиме
export type TeamSelectedItems = {
  teamCharacters: CatalogItemRow[];   // массив до 10 персонажей
  scene: CatalogItemRow | null;
};

// Состояние чата команды
export type TeamChatState = {
  sessionId: string | null;
  title: string;
  selectedItems: TeamSelectedItems | null;
  generatedScript: string;
  itemDescriptions: any | null;
  chatTree: ChatTree;
  chatParts: ChatPart[];
  currentPartIndex: number;
  isSummarizing: boolean;
  isRerolling: boolean;
  isGenerating: boolean;
  analyticsData: any | null;
  mapData: any | null;
};

// Тип для строки сессии при сохранении
export type TeamChatSessionRow = {
  id: string;
  mode: 'team';
  title: string;
  selectedItems: TeamSelectedItems | null;
  generatedScript: string;
  itemDescriptions?: any;
  chatTree: ChatTree;
  chatParts: ChatPart[];
  currentPartIndex: number;
  analyticsData: any | null;
  mapData?: any;
  systemPromptData?: any;
  cheatmodeData?: any;
  lorebookData?: any;
  privateChatsData?: any;
  createdAt: string;
  updatedAt: string;
};

// Реэкспорт общих типов для удобства
export type {
  ChatMessage,
  Branch,
  ChatPart,
  ChatTree,
  PartSummaryRef,
  MsgVersion,
  CatalogItemRow
};