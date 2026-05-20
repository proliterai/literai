<!-- src/lib/components/settings/DesignPanel.svelte -->

<script lang="ts">
  import { settingsStore } from '$lib/domain/settings/settings.store';
  import { SETTINGS_KEYS, SETTINGS_DEFAULTS } from '$lib/domain/settings/settings.keys';
  import { applyTheme } from '$lib/ui/theme';
  import { ui } from '$lib/ui/ui.store';

  const THEMES = [
    { id: 'default', label: 'По умолчанию' },
    { id: 'ocean', label: 'Океан' },
    { id: 'matrix', label: 'Матрица' },
    { id: 'cream', label: 'Кремовая' },
    { id: 'sunset', label: 'Закат' },
    { id: 'cyberpunk', label: 'Киберпанк' },
    { id: 'monochrome', label: 'Монохром' },
    { id: 'monochromelight', label: 'Монохром светлая' },
    { id: 'light', label: 'Светлая' },
    { id: 'orangecola', label: 'Оранжевая кола' },
    { id: 'forest', label: 'Лесная' },
    { id: 'rpg', label: 'Retro RPG' },
    { id: 'visualnovel', label: 'Визуальная новелла' },
    { id: 'aurora', label: 'Полярис' },
    { id: 'dark-fantasy', label: 'Темное фэнтази' }
  ];

  const FONTS = [
    { label: 'По умолчанию (Системный)', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { label: 'Arial (Классика)', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Verdana (Широкий, читаемый)', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Tahoma (Компактный)', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Trebuchet MS (Изящный)', value: '"Trebuchet MS", Helvetica, sans-serif' },
    { label: 'Georgia (Книжный, мягкий)', value: 'Georgia, serif' },
    { label: 'Times New Roman (Литературный)', value: '"Times New Roman", Times, serif' },
    { label: 'Palatino (Элегантный с засечками)', value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
    { label: 'Consolas (Код / Хакерский)', value: 'Consolas, monaco, monospace' },
    { label: 'Courier New (Печатная машинка)', value: '"Courier New", Courier, monospace' },
    { label: 'Comic Sans MS (Игровой)', value: '"Comic Sans MS", "Marker Felt", cursive, sans-serif' }
  ];

  let s = $derived($settingsStore.values);
  let themeSelectorOpen = $state(false);

  // Состояние для загрузки фона
  let backgroundPreview = $state<string | null>(s.custom_background ?? null);
  let backgroundFileInput = $state<HTMLInputElement | null>(null);

  // Состояние для пользовательского CSS
  let localCss = $state(s.custom_css ?? '');
  let cssTimer: ReturnType<typeof setTimeout>;

  async function setTheme(theme: string) {
    applyTheme(theme);
    await settingsStore.set(SETTINGS_KEYS.ACTIVE_THEME, theme);
    themeSelectorOpen = false;
  }

  async function setFont(font: string) {
    document.documentElement.style.setProperty('--font-family-base', font);
    await settingsStore.set(SETTINGS_KEYS.ACTIVE_FONT, font);
  }

  async function setFontSize(size: number) {
    document.documentElement.style.fontSize = `${size}px`;
    await settingsStore.set(SETTINGS_KEYS.FONT_SIZE, size);
  }

  // Обработка загрузки файла
  async function handleBackgroundFile(file: File) {
    if (!file.type.startsWith('image/')) {
      ui.notify('Пожалуйста, выберите изображение', 'error');
      return;
    }

    // Ограничим размер, например, 5 МБ
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      ui.notify('Изображение не должно превышать 5 МБ', 'error');
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(file);
      });

      backgroundPreview = dataUrl;
      await settingsStore.set(SETTINGS_KEYS.CUSTOM_BACKGROUND, dataUrl);
      ui.notify('Фон установлен', 'success');
    } catch (err: any) {
      ui.notify(err.message || 'Ошибка загрузки', 'error');
    }
  }

  // Сброс фона
  async function resetBackground() {
    backgroundPreview = null;
    await settingsStore.set(SETTINGS_KEYS.CUSTOM_BACKGROUND, null);
    ui.notify('Фон сброшен', 'success');
  }

  // Обновление CSS с задержкой (Debounce), чтобы не лагало при вводе
  function handleCssInput(value: string) {
    localCss = value;
    clearTimeout(cssTimer);
    cssTimer = setTimeout(() => {
      settingsStore.set(SETTINGS_KEYS.CUSTOM_CSS, value);
    }, 500);
  }

  // Закрытие при клике вне
  function closeSelector() {
    themeSelectorOpen = false;
  }

  // Сброс всех настроек дизайна к значениям по умолчанию
  async function resetToDefault() {
    const confirmed = await ui.confirm('Сброс дизайна', 'Вернуть оформление к стандартному виду?');
    if (confirmed) {
      backgroundPreview = null;
      localCss = '';
      await settingsStore.setMany({
        [SETTINGS_KEYS.ACTIVE_THEME]: SETTINGS_DEFAULTS.active_theme,
        [SETTINGS_KEYS.ACTIVE_FONT]: SETTINGS_DEFAULTS.active_font,
        [SETTINGS_KEYS.FONT_SIZE]: SETTINGS_DEFAULTS.font_size,
        [SETTINGS_KEYS.CUSTOM_BACKGROUND]: SETTINGS_DEFAULTS.custom_background,
        [SETTINGS_KEYS.CUSTOM_CSS]: SETTINGS_DEFAULTS.custom_css,
        [SETTINGS_KEYS.AVATAR_STYLE]: SETTINGS_DEFAULTS.avatar_style
      });
      
      document.documentElement.style.setProperty('--font-family-base', SETTINGS_DEFAULTS.active_font);
      document.documentElement.style.fontSize = `${SETTINGS_DEFAULTS.font_size}px`;
      ui.notify('Настройки дизайна сброшены', 'success');
    }
  }
</script>

<div class="panel-section design-panel">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
    <h4 class="panel-title" style="margin-bottom: 0;"><i class="fas fa-palette"></i> Дизайн</h4>
    <button class="btn-secondary btn-sm" onclick={resetToDefault} title="Вернуть по дефолту">
      <i class="fas fa-undo"></i> Сброс
    </button>
  </div>

  <!-- Тема -->
  <div class="setting-group">
    <span class="setting-label">Тема</span>
    <div class="preset-selector-wrapper">
      <button
        class="preset-selector-trigger {themeSelectorOpen ? 'active' : ''}"
        type="button"
        onclick={() => themeSelectorOpen = !themeSelectorOpen}
        aria-expanded={themeSelectorOpen}
      >
        <div class="preset-selector-trigger-content">
          <i class="preset-selector-trigger-icon fas fa-palette"></i>
          <span class="preset-selector-trigger-text">
            {THEMES.find(t => t.id === s.active_theme)?.label || 'Выберите тему'}
          </span>
        </div>
        <i class="preset-selector-trigger-arrow fas fa-chevron-down"></i>
      </button>
      {#if themeSelectorOpen}
        <div class="preset-selector-dropdown open">
          {#each THEMES as t (t.id)}
            <button
              class="preset-selector-option {s.active_theme === t.id ? 'active' : ''}"
              type="button"
              onclick={() => setTheme(t.id)}
            >
              <i class="preset-selector-option-icon fas fa-circle"></i>
              <span class="preset-selector-option-text">{t.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Шрифт -->
  <div class="setting-group">
    <label class="setting-label" for="font-select">Шрифт</label>
    <select id="font-select" class="panel-select" value={s.active_font} onchange={(e) => setFont(e.currentTarget.value)}>
      {#each FONTS as f (f.value)}
        <option value={f.value}>{f.label}</option>
      {/each}
    </select>
  </div>

  <!-- Размер текста -->
  <div class="setting-group">
    <label class="setting-label" for="font-size">Размер текста: {s.font_size}px</label>
    <input id="font-size" class="panel-range" type="range" min="12" max="22" step="1" value={s.font_size} oninput={(e) => setFontSize(Number(e.currentTarget.value))} />
  </div>

  <!-- ФОН -->
  <div class="setting-group">
    <span class="setting-label">Пользовательский фон</span>
    <div class="background-controls">
      {#if backgroundPreview}
        <div class="background-preview">
          <img src={backgroundPreview} alt="Preview" />
          <button class="btn-icon btn-reset" onclick={resetBackground} title="Сбросить фон">
            <i class="fas fa-times"></i>
          </button>
        </div>
      {/if}
      <button
        class="btn-secondary"
        type="button"
        onclick={() => backgroundFileInput?.click()}
      >
        <i class="fas fa-image"></i>
        {backgroundPreview ? 'Заменить фон' : 'Загрузить фон'}
      </button>
      <input
        bind:this={backgroundFileInput}
        type="file"
        accept="image/*"
        style="display: none"
        onchange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) handleBackgroundFile(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
    <p class="setting-hint">
      Рекомендуемый размер: до 5 МБ. Изображение будет растянуто на весь экран.
    </p>
  </div>

  <!-- ОТОБРАЖЕНИЕ АВАТАРОК -->
  <div class="setting-group" style="margin-top: var(--space-6);">
    <label class="setting-label" for="avatar-style">Отображение аватарок в чате</label>
    <select id="avatar-style" class="panel-select" value={s.avatar_style} onchange={(e) => settingsStore.set(SETTINGS_KEYS.AVATAR_STYLE, e.currentTarget.value)}>
      <option value="small">Маленькие (стандарт)</option>
      <option value="large">Крупные</option>
      <option value="full">На всю ширину (с затемнением)</option>
    </select>
  </div>

  <!-- Пользовательский CSS -->
   <div class="setting-group" style="margin-top: var(--space-6);">
    <span class="setting-label">
      <i class="fas fa-code"></i> Пользовательский CSS
    </span>
    <textarea 
      class="panel-textarea css-editor" 
      placeholder="/* Острые углы у карточек каталога */&#10;.catalog-card &#123; border-radius: 0; &#125;"
      value={localCss}
      oninput={(e) => handleCssInput(e.currentTarget.value)}
      spellcheck="false"
    ></textarea>
    <p class="setting-hint">
      Переопределите любые стили интерфейса. Изменения применяются мгновенно. 
      <br>Например: <code>.user-message .message-content &#123; border-left-color: #ff00ff; &#125;</code>
    </p>
  </div>
</div>

<style>
  .background-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .background-preview {
    position: relative;
    width: 100%;
    max-width: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--glass-border);
  }

  .background-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .btn-reset {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    color: var(--txt-muted);
    width: var(--size-7);
    height: var(--size-7);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    transition: all var(--transition-fast);
  }

  .btn-reset:hover {
    background: var(--state-error-bg);
    color: var(--state-error);
    border-color: var(--state-error);
    opacity: 1;
  }

  .setting-hint {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    margin-top: var(--space-2);
    line-height: var(--leading-relaxed);
  }

  /* Стили для редактора кода */
  .css-editor {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    line-height: 1.5;
    background: var(--bg-sunken);
    color: var(--txt-gold-light);
    white-space: pre;
    overflow-wrap: normal;
    overflow-x: auto;
    min-height: 120px;
  }
</style>