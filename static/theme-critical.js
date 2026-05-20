// Синхронное применение темы ДО рендера — предотвращает FOUC
(function () {
  const STORAGE_KEY = 'literai_theme_v1';
  const VALID_THEMES = new Set([
    'default', 'ocean', 'matrix', 'sunset',
    'monochrome', 'monochromelight', 'light', 'forest', 'aurora', 'cyberpunk', 'orangecola', 'cream', 'rpg', 'visualnovel', 'dark-fantasy'
  ]);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_THEMES.has(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    // localStorage недоступен (приватный режим и т.д.) — игнорируем
  }
})();