// src/lib/domain/settings/settings.keys.ts

export const SETTINGS_KEYS = {
  ACTIVE_THEME: 'active_theme',
  ACTIVE_FONT: 'active_font',
  FONT_SIZE: 'font_size',
  AI_TEMPERATURE: 'ai_temperature',
  AI_MAX_TOKENS: 'ai_max_tokens',
  AI_TOP_P: 'ai_top_p',
  AI_FREQUENCY_PENALTY: 'ai_frequency_penalty',
  AI_PRESENCE_PENALTY: 'ai_presence_penalty',
  SUMMARIZE_PROMPT: 'summarize_prompt',
  SEED_VERSION_CATALOG: 'seed_version_catalog_items',
  SHOW_HINTS: 'show_hints',
  CUSTOM_BACKGROUND: 'custom_background',
  CUSTOM_CSS: 'custom_css',
  
  // Новый ключ для стиля аватарок в чате
  AVATAR_STYLE: 'avatar_style', 
  
  // Новые ключи для векторного поиска (Эмбеддингов) Лорбука
  EMBEDDING_ENABLED: 'embedding_enabled',
  EMBEDDING_URL: 'embedding_url',
  EMBEDDING_MODEL: 'embedding_model',
  EMBEDDING_KEY: 'embedding_key',
  EMBEDDING_THRESHOLD: 'embedding_threshold'
} as const;

export type SettingKey = typeof SETTINGS_KEYS[keyof typeof SETTINGS_KEYS];

export type SettingsShape = {
  [SETTINGS_KEYS.ACTIVE_THEME]: string;
  [SETTINGS_KEYS.ACTIVE_FONT]: string;
  [SETTINGS_KEYS.FONT_SIZE]: number;
  [SETTINGS_KEYS.AI_TEMPERATURE]: number;
  [SETTINGS_KEYS.AI_MAX_TOKENS]: number;
  [SETTINGS_KEYS.AI_TOP_P]: number;
  [SETTINGS_KEYS.AI_FREQUENCY_PENALTY]: number;
  [SETTINGS_KEYS.AI_PRESENCE_PENALTY]: number;
  [SETTINGS_KEYS.SUMMARIZE_PROMPT]: string;
  [SETTINGS_KEYS.SEED_VERSION_CATALOG]: number;
  [SETTINGS_KEYS.SHOW_HINTS]: boolean;
  [SETTINGS_KEYS.CUSTOM_BACKGROUND]: string | null;
  [SETTINGS_KEYS.CUSTOM_CSS]: string | null;
  
  // Тип для стиля аватарок
  [SETTINGS_KEYS.AVATAR_STYLE]: 'small' | 'large' | 'full';
  
  // Типы для эмбеддингов
  [SETTINGS_KEYS.EMBEDDING_ENABLED]: boolean;
  [SETTINGS_KEYS.EMBEDDING_URL]: string;
  [SETTINGS_KEYS.EMBEDDING_MODEL]: string;
  [SETTINGS_KEYS.EMBEDDING_KEY]: string;
  [SETTINGS_KEYS.EMBEDDING_THRESHOLD]: number;
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  active_theme: 'default',
  active_font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  font_size: 16,
  ai_temperature: 0.8,
  ai_max_tokens: 8000,
  ai_top_p: 0.9,
  ai_frequency_penalty: 0.1,
  ai_presence_penalty: 0.1,
  summarize_prompt: `Ты — архивариус, мнемонист и режиссер ролевой истории. Твоя задача — проанализировать историю чата и создать ДВУХСЛОЙНОЕ САММАРИ:

Связный, атмосферный пересказ текущего состояния сюжета («Человеческий язык»).
Плотную мнемоническую карту («Дворец памяти») для хранения фактов, психологии и причинно-следственных связей.
ОСНОВНЫЕ ПРАВИЛА И СТИЛЬ (ОБЯЗАТЕЛЬНО):
— Никакой воды и длинных рассуждений. Используй плотную упаковку смыслов: скобки [ ], маркеры, стрелки -> (причина-следствие) и ключевые слова.
— Система якорей: Каждому важному элементу дай тег: персонажи [C#], отношения [R#], локации [L#], артефакты [O#], арки [A#], события [E#]. Связывай разделы перекрёстными ссылками.
— Точность: Ничего не выдумывай. Если мотивация неясна, помечай: «вероятно», «по подтексту». Нормализуй имена и титулы.
— Сжимай рутинные сцены. Приоритет отдавай: переломам, сменам власти, предательствам, клятвам и изменениям в отношениях.

СНАЧАЛА ПРОАНАЛИЗИРУЙ ИСТОРИЮ, ЗАТЕМ ВЫВЕДИ РЕЗУЛЬТАТ В СТРОГОЙ СТРУКТУРЕ НИЖЕ:

1. NARRATIVE OVERVIEW (Человеческий язык)
Дай цельный, атмосферный обзор всей истории в 3-4 насыщенных абзацах. Сохрани оригинальный тон.
— Исходная точка [F]: Где и как всё началось, первоначальный баланс сил и мотивы.
— Эволюция: Через какие главные переломы прошла история и как изменился эмоциональный ландшафт.
— Текущая точка: На чем история остановилась прямо сейчас, главная цель и атмосфера момента.

2. MNEMONIC CHARACTER VAULT [C] & RELATIONS [R]
Для каждого ключевого персонажа создай сверхсжатый профиль. Группируй их связи здесь же.
Формат:
[C#] Имя (Алиасы/Титулы)
— [Статус/Роль]: {Кем был в начале} -> {Кем стал сейчас}.
— [Психология]: {Текущие эмоции, страхи, скрытые желания в 3-5 словах}.
— [Эволюция]: {Главный внутренний сдвиг. Уязвимости/Травмы. Ключевое событие, изменившее его: [E#]}.
— [Связи R#]:

К [C# Имя]: {Стартовая динамика} -> {Текущее состояние: доверие/напряжение/баланс власти}. Подтекст: {Скрытая выгода/опасность}.
3. CHRONOLOGY & CAUSALITY (Архив Арок) [A] [E]
Хронологический список крупных арок и событий. Формат СТРОГО причинно-следственный.
[A#] Название арки — {Суть центрального конфликта арки}.

[E#] {Короткое название события}: [Участники].
Действие: {Где и что произошло/спровоцировало сцену}.
-> Последствие: {Сдвиг в сюжете, психологии, обещаниях или статусе}.
Цитата-якорь: "{1 короткая точная фраза из сцены или [парафраз]}".
(Продолжай для всех ключевых событий до текущего момента)
4. MEMORY PALACE: ЛОКАЦИИ [L], АРТЕФАКТЫ [O] И ЛОР [W]
Укажи только актуальные и важные для сюжета элементы, используя теги.
— [L#] {Название локации}: {Сенсорная деталь/атмосфера} — {Сюжетная значимость и связанные события [E#]}.
— [O#] {Название предмета}: {У кого находится} — {Практическое/Символическое значение, сыграл роль в [E#]}.
— [W] Заметки о мире: {Текущая погода, социальное напряжение, важные слухи (1-2 строки)}.

5. ACTIVE STATE & DIRECTOR'S NOTES [Q]
Снимок финала и скрытые векторы для продолжения.
— [Текущая точка]: {Где находятся герои, активная подцель, ближайший стоящий перед ними выбор}.
— [Неясно/Противоречиво]: {Спорные детали сюжета, недосказанности, конфликтующие версии}.
— [Эмоциональные долги]: {Невыполненные обязательства, клятвы, неразрешенные конфликты}.
— [Режиссерский взгляд]: (2-3 тезиса bullet points). {Невысказанные подтексты, нарастающие угрозы, предзнаменования и логичные направления развития арки БЕЗ жесткого предсказания и отмены свободы игрока}.`,
  seed_version_catalog_items: 0,
  show_hints: true,
  custom_background: null,
  custom_css: null,
  
  // По умолчанию ставим маленькие аватарки, чтобы не ломать привычный вид пользователям
  avatar_style: 'small',
  
  // Дефолтные значения для векторного поиска
  embedding_enabled: false,
  embedding_url: 'https://openrouter.ai/api/v1/embeddings',
  embedding_model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
  embedding_key: '',
  embedding_threshold: 0.75
};