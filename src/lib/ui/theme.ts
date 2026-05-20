// src/lib/ui/theme.ts

import { browser } from '$app/environment';

const VALID = new Set([
  'default', 'ocean', 'cream', 'matrix', 'sunset', 'aurora', 'forest', 'cyberpunk', 'monochrome', 'monochromelight', 'light', 'orangecola', 'rpg', 'visualnovel', 'dark-fantasy'
]);

export function applyTheme(theme: string) {
  if (!browser) return;
  if (!VALID.has(theme)) theme = 'default';
  if (theme === 'default') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export function applyBackground(backgroundDataUrl: string | null) {
  if (!browser) return;
  const body = document.body;
  
  if (backgroundDataUrl) {
    // Устанавливаем фон на body
    body.style.background = `url("${backgroundDataUrl}") center/cover no-repeat fixed`;
    // Добавляем класс для скрытия псевдоэлемента ::before
    body.classList.add('custom-background');
    // Также сбрасываем переменные (на всякий случай)
    body.style.setProperty('--bg-radial-1', 'transparent');
    body.style.setProperty('--bg-radial-2', 'transparent');
    body.style.setProperty('--bg-radial-3', 'transparent');
  } else {
    // Сбрасываем фон
    body.style.background = '';
    body.classList.remove('custom-background');
    // Возвращаем переменные к значениям по умолчанию (они будут взяты из CSS)
    body.style.removeProperty('--bg-radial-1');
    body.style.removeProperty('--bg-radial-2');
    body.style.removeProperty('--bg-radial-3');
  }
}

export function applyCustomCss(css: string | null) {
  if (!browser) return;
  
  const styleId = 'literai-custom-user-css';
  let styleEl = document.getElementById(styleId);
  if (css && css.trim() !== '') {
    // Если тега еще нет - создаем
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    // Применяем стили
    styleEl.textContent = css;
  } else {
    // Если CSS пустой или null - удаляем тег
    if (styleEl) {
      styleEl.remove();
    }
  }
}