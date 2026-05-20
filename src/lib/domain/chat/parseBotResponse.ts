// ================================================================================
// ФАЙЛ: src/lib/domain/chat/parseBotResponse.ts
// ================================================================================

import { renderMarkdown } from '$lib/utils/markdown';

export type ParsedBotResponse = {
  storyRawText: string;
  storyPartHtml: string;
  choices: string[];
};

function stripThinkTags(text: string) {
  return String(text ?? '').replace(/<think[\s\S]*?<\/think>/gi, '').trim();
}

const separatorRegex =
  /(?:\n|^)\s*(?:\[?(?:Варианты|Выбор|Choices|Options|Variations)\]?|#{1,3}\s*Варианты)\s*:?\s*(?:\n|$)/i;

const listRegex = /(?:(?:\n|^)\s*(?:\d+[\.)]|\-|\*)\s+.+){2,}$/;

function splitStoryAndChoices(text: string) {
  const cleaned = stripThinkTags(text);

  const match = cleaned.match(separatorRegex);
  if (match) {
    const story = cleaned.substring(0, match.index).trim();
    const rest = cleaned.substring((match.index ?? 0) + match[0].length).trim();
    return { story, choicesText: rest };
  }

  const fallback = cleaned.match(listRegex);
  if (fallback && fallback.index !== undefined && fallback.index > cleaned.length * 0.5) {
    const story = cleaned.substring(0, fallback.index).trim();
    return { story, choicesText: fallback[0].trim() };
  }

  return { story: cleaned, choicesText: '' };
}

function parseChoices(choicesText: string, max = 2) {
  const out: string[] = [];
  if (!choicesText) return out;
  for (let line of choicesText.split('\n')) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(/^(?:\d+[\.)]|\-|\*)\s+(.+)$/);
    if (!m?.[1]) continue;
    const choice = m[1].trim().replace(/^["']|["']$/g, '');
    if (choice) out.push(choice);
    if (out.length >= max) break;
  }
  return out;
}

export function parseBotResponse(reply: string): ParsedBotResponse {
  // 1. Отделяем сюжет от вариантов ответа
  const { story, choicesText } = splitStoryAndChoices(reply);
  
  const storyRawText = story;
  
  // 2. Превращаем сюжет в красивый и безопасный HTML через marked + dompurify
  const storyPartHtml = renderMarkdown(storyRawText); 
  
  // 3. Парсим варианты ответа в массив строк
  const choices = parseChoices(choicesText, 2);
  
  return { storyRawText, storyPartHtml, choices };
}