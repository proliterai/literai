// src/lib/domain/settings/settings.store.ts

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { settingsRepo } from '$lib/db/repositories/settings.repo';
import {
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  type SettingKey,
  type SettingsShape
} from './settings.keys';
import { applyTheme, applyBackground, applyCustomCss } from '$lib/ui/theme';

const THEME_STORAGE_KEY = 'literai_theme_v1';

type SettingsState = {
  ready: boolean;
  values: SettingsShape;
};

const initial: SettingsState = { ready: false, values: SETTINGS_DEFAULTS };

function safeSetLS(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
}
function safeRemoveLS(k: string) {
  try { localStorage.removeItem(k); } catch {}
}

export function createSettingsStore() {
  const { subscribe, update } = writable<SettingsState>(initial);

  // Функция для обновления системного промпта в чате при изменении show_hints
  async function syncShowHintsToChat() {
    try {
      const { chatStore } = await import('$lib/domain/chat/chat.store');
      const { systemPromptStore } = await import('$lib/domain/systemPrompt/systemPrompt.store');
      if (!chatStore.isSessionActive()) return;
      const basePrompt = get(systemPromptStore.activeContent);
      chatStore.updateSystemPromptInChat(basePrompt);
    } catch {
      // chatStore или systemPromptStore могут быть недоступны
    }
  }

  async function init() {
    if (!browser) return;
    const rows = await settingsRepo.getAll();
    const patch: Partial<SettingsShape> = {};
    for (const r of rows) patch[r.key as SettingKey] = r.value;

    update((s) => {
      const values = { ...SETTINGS_DEFAULTS, ...patch } as SettingsShape;
      const theme = values[SETTINGS_KEYS.ACTIVE_THEME];
      syncTheme(theme);
      applyTheme(theme);
      
      // Применяем сохранённый фон
      applyBackground(values[SETTINGS_KEYS.CUSTOM_BACKGROUND] ?? null);
      
      // Применяем сохранённый кастомный CSS
      applyCustomCss(values[SETTINGS_KEYS.CUSTOM_CSS] ?? null);
      
      return { ...s, ready: true, values };
    });
  }

  function syncTheme(theme: string) {
    if (!browser) return;
    if (!theme || theme === 'default') safeRemoveLS(THEME_STORAGE_KEY);
    else safeSetLS(THEME_STORAGE_KEY, theme);
  }

  async function set<K extends SettingKey>(key: K, value: SettingsShape[K]) {
    update((s) => ({ ...s, values: { ...s.values, [key]: value } }));
    
    if (key === SETTINGS_KEYS.ACTIVE_THEME) {
      syncTheme(String(value));
      applyTheme(String(value));
    }
    
    if (key === SETTINGS_KEYS.CUSTOM_BACKGROUND) {
      applyBackground(value as string | null);
    }

    if (key === SETTINGS_KEYS.CUSTOM_CSS) {
      applyCustomCss(value as string | null);
    }
    
    if (key === SETTINGS_KEYS.SHOW_HINTS) {
      syncShowHintsToChat();
    }
    
    if (browser) await settingsRepo.set(key, value);
  }

  async function setMany(patch: Partial<SettingsShape>) {
    update((s) => ({ ...s, values: { ...s.values, ...(patch as any) } }));
    
    if (patch[SETTINGS_KEYS.ACTIVE_THEME]) {
      const theme = String(patch[SETTINGS_KEYS.ACTIVE_THEME]);
      syncTheme(theme);
      applyTheme(theme);
    }
    
    if (patch[SETTINGS_KEYS.CUSTOM_BACKGROUND] !== undefined) {
      applyBackground(patch[SETTINGS_KEYS.CUSTOM_BACKGROUND] ?? null);
    }

    if (patch[SETTINGS_KEYS.CUSTOM_CSS] !== undefined) {
      applyCustomCss(patch[SETTINGS_KEYS.CUSTOM_CSS] ?? null);
    }
    
    if (patch[SETTINGS_KEYS.SHOW_HINTS] !== undefined) {
      syncShowHintsToChat();
    }
    
    if (browser) await settingsRepo.setMany(patch as any);
  }

  const generation = derived({ subscribe }, (s) => ({
    temperature: s.values[SETTINGS_KEYS.AI_TEMPERATURE],
    max_tokens: s.values[SETTINGS_KEYS.AI_MAX_TOKENS],
    top_p: s.values[SETTINGS_KEYS.AI_TOP_P],
    frequency_penalty: s.values[SETTINGS_KEYS.AI_FREQUENCY_PENALTY],
    presence_penalty: s.values[SETTINGS_KEYS.AI_PRESENCE_PENALTY]
  }));

  const summarizePrompt = derived({ subscribe }, (s) => s.values[SETTINGS_KEYS.SUMMARIZE_PROMPT]);
  const showHints = derived({ subscribe }, (s) => s.values[SETTINGS_KEYS.SHOW_HINTS]);

  return { subscribe, init, set, setMany, generation, summarizePrompt, showHints };
}

export const settingsStore = createSettingsStore();