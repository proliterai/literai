// ================================================================================
// ФАЙЛ: src/lib/domain/private-chat/privateChat.constants.ts
// Описание: Константы для модуля приватных чатов
// ================================================================================

// Ключ для хранения приватных чатов в localStorage
export const PRIVATE_CHAT_STORAGE_KEY = 'literai_private_chats';

// Маркеры для вставки приватных чатов в контекст основного чата
export const PRIVATE_CHAT_TAG_START = '[PRIVATE_CHAT_START]';
export const PRIVATE_CHAT_TAG_END = '[PRIVATE_CHAT_END]';

// Максимальное количество сообщений из приватного чата, добавляемых в контекст
export const MAX_PRIVATE_MESSAGES_IN_CONTEXT = 40;

// Максимальное количество последних сообщений из основного чата в контексте приватного
export const MAX_MAIN_HISTORY_IN_PRIVATE_CONTEXT = 20;

// Базовый системный промпт для генерации ответа в приватном чате
export const DEFAULT_PRIVATE_CHAT_SYSTEM_PROMPT = `Ты играешь за {recipientName} в приватной сцене.

ОПИСАНИЕ {recipientName}:
{recipientDescription}

ПРАВИЛА:
1. Отвечай ТОЛЬКО от лица {recipientName}
2. Сохраняй характер персонажа
3. Учитывай контекст основной истории
4. Это приватная сцена в которой персонажи взаимодействуют друг с другом наедине

{context}`;

// Текст для вставки в системный промпт, когда описание персонажа отсутствует
export const DEFAULT_CHARACTER_DESCRIPTION = 'Описание не предоставлено.';

// Значения по умолчанию для настроек генерации
export const DEFAULT_PRIVATE_CHAT_TEMPERATURE = 0.8;
export const DEFAULT_PRIVATE_CHAT_MAX_TOKENS = 8000;