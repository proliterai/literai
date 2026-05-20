// ================================================================================
// ФАЙЛ: src/lib/domain/systemPrompt/systemPrompt.types.ts
// Описание: Типы для хранилища системных промптов ролевого режима
// ================================================================================

export type SystemPromptPreset = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  content: string;
};

export type SystemPromptState = {
  loaded: boolean;                 // загружены ли системные пресеты
  presets: SystemPromptPreset[];   // системные пресеты (из JSON)
  customPresets: SystemPromptPreset[]; // пользовательские пресеты (сохранённые)
  activePresetId: string;          // ID активного пресета (системного или пользовательского)
  customPrompts: Record<string, string>; // временные изменения для конкретного пресета (не сохранённые как отдельный пресет)
};

export type SystemPromptExportData = {
  activePresetId: string;
  customPrompts: Record<string, string>;
  exportedAt: string;
};