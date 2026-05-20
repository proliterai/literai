import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { browser } from '$app/environment';

// Настройка marked: переносы строк как <br> и поддержка GitHub Flavored Markdown (таблицы, списки)
marked.setOptions({
  breaks: true,
  gfm: true
});

export function renderMarkdown(text: string): string {
  if (!text) return '';

  // 1. Предварительная обработка: защищаем теги <think>, чтобы Markdown их не сломал
  let processed = text.replace(
    /&lt;think&gt;([\s\S]*?)&lt;\/think&gt;|<think>([\s\S]*?)<\/think>/gi,
    (match, p1, p2) => {
      const content = p1 || p2 || '';
      return `<div class="think-block">${content}</div>`;
    }
  );

  // 2. Парсинг Markdown в HTML
  let html = marked.parse(processed) as string;

  // 3. Кастомное форматирование диалогов (тире в начале строки)
  html = html.replace(/<p>([—–-]\s*.+?)<\/p>/gm, '<p class="dialogue-line">$1</p>');

  // 4. Очистка HTML от потенциального XSS (выполняем только в браузере)
  if (browser) {
    html = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 
        'div', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
      ADD_CLASSES: {
        div: ['think-block'],
        p: ['dialogue-line']
      }
    });
  }

  return html;
}