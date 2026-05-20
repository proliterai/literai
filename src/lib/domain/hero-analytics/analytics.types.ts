// ================================================================================
// ФАЙЛ: src/lib/domain/hero-analytics/analytics.types.ts
// Описание: Расширенные типы для модуля аналитики (режим "Игра за героя")
// ================================================================================

export type StoryPhase = 'начало' | 'завязка' | 'развитие' | 'кульминация' | 'развязка';
export type Trend = 'up' | 'down' | 'stable';
export type Severity = 'низкая' | 'средняя' | 'высокая';
export type RiskLevel = 'low' | 'medium' | 'high';
export type LocationType = 'город' | 'лес' | 'подземелье' | 'здание' | 'дорога' | 'пещера' | 'гора' | 'море' | 'пустыня' | 'болото' | 'храм' | 'руины' | 'таверна' | 'замок' | 'деревня' | 'другое';
export type WeatherType = 'ясно' | 'дождь' | 'снег' | 'туман' | 'шторм' | 'облачно' | 'ветрено';
export type TimePeriod = 'рассвет' | 'утро' | 'день' | 'вечер' | 'закат' | 'ночь' | 'полночь';
export type RelationshipType = 'романтика' | 'симпатия' | 'дружба' | 'уважение' | 'нейтралитет' | 'неприязнь' | 'вражда' | 'соперничество' | 'страх' | 'зависимость' | 'наставничество' | 'преданность';
export type ItemCategory = 'weapon' | 'armor' | 'potion' | 'key' | 'scroll' | 'food' | 'valuable' | 'tool' | 'artifact' | 'clothing' | 'document' | 'unknown';
export type QuestStatus = 'active' | 'completed' | 'failed' | 'hidden';
export type StageStatus = 'pending' | 'current' | 'completed' | 'skipped';
export type POIStatus = 'unexplored' | 'exploring' | 'explored' | 'blocked' | 'dangerous';
export type PacingType = 'очень медленный' | 'медленный' | 'умеренный' | 'быстрый' | 'стремительный';
export type ToneType = 'комедия' | 'драма' | 'экшен' | 'романтика' | 'хоррор' | 'мистика' | 'приключение' | 'триллер';

// Мета-информация о истории
export interface AnalyticsMeta {
	storyPhase: StoryPhase;
	overallTension: number;
	gameDay: number;
	chapterSummary: string;
	sessionDuration: string;
	totalMessages: number;
	wordCount: number;
}

// Расширенная аналитика сюжета
export interface StoryAnalytics {
	currentArc: {
		name: string;
		description: string;
		progress: number;
		startedAt: string;
	};
	pacing: {
		current: PacingType;
		recommendation: string;
		actionToDialogRatio: number;
	};
	tone: {
		primary: ToneType;
		secondary: ToneType | null;
		shifts: Array<{ from: ToneType; to: ToneType; trigger: string }>;
	};
	themes: Array<{
		name: string;
		icon: string;
		prominence: number;
		examples: string[];
	}>;
	narrativeDevices: Array<{
		name: string;
		description: string;
		effectiveness: number;
	}>;
	unresolved: Array<{
		type: 'вопрос' | 'конфликт' | 'тайна' | 'обещание';
		description: string;
		importance: RiskLevel;
		suggestedResolution: string;
	}>;
}

// Статистика героя (упрощённо)
export interface HeroStat {
	value: number | null;
	status: string;
	trend: Trend;
	criticalThreshold?: number;
}

// Настроение героя
export interface HeroMood {
	primary: string;
	emoji: string;
	description: string;
	intensity: number;
}

// Герой (главный персонаж)
export interface Hero {
	id: string;
	name: string;
	avatar: string;
	stats: Record<string, HeroStat>;
	mood: HeroMood;
	currentGoal: string;
	secretThought: string;
	screenTime: number;      // количество сообщений героя
	dialogueCount: number;    // количество диалоговых реплик (можно считать все сообщения)
	strengths: string[];
	weaknesses: string[];
}

// NPC (второстепенные персонажи)
export interface NPC {
	id: string;
	name: string;
	avatar?: string;
	role: 'ally' | 'neutral' | 'enemy' | 'unknown';
	firstAppearance: string;
	lastSeen: string;
	meetingCount: number;
	description?: string;
}

// Атмосфера локации
export interface Atmosphere {
	danger: number;
	comfort: number;
	mystery: number;
	visibility: number;
	magic?: number;
	hostility?: number;
}

// Погода
export interface Weather {
	type: WeatherType;
	icon: string;
	temperature: string;
	impact: string;
	changeChance: number;
}

// Время суток
export interface TimeOfDay {
	period: TimePeriod;
	icon: string;
	lightLevel: number;
	description: string;
}

// Точка интереса
export interface PointOfInterest {
	name: string;
	icon: string;
	status: POIStatus;
	hint: string | null;
	requirement: string | null;
	reward?: string;
	danger?: number;
}

// Выход из локации
export interface Exit {
	direction: string;
	destination: string;
	danger: number;
	locked: boolean;
	requirement: string | null;
	description?: string;
	travelTime?: string;
}

// Локация
export interface Location {
	name: string;
	type: LocationType;
	description: string;
	atmosphere: Atmosphere;
	weather: Weather;
	timeOfDay: TimeOfDay;
	pointsOfInterest: PointOfInterest[];
	exits: Exit[];
	history?: string;
	secrets?: string[];
	inhabitants?: string[]; // ID NPC, которые здесь обитают
}

// Отношения героя с NPC
export interface Relationship {
	npcId: string;
	npcName: string;
	value: number; // -100 .. 100
	type: RelationshipType;
	status: string;
	recentChange: Trend;
	hasTension: boolean;
	history?: string[];
	sharedMemories?: string[];
}

// Ресурсы героя
export interface Resources {
	gold: number;
	food: number;
	special: Array<{ name: string; amount: number; icon?: string }>;
}

// Предмет инвентаря
export interface InventoryItem {
	name: string;
	icon: string;
	quantity: number;
	category: ItemCategory;
	description: string;
	questRelated: boolean;
	hint: string | null;
	rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
	usable?: boolean;
}

// Инвентарь героя
export interface Inventory {
	resources: Resources;
	items: InventoryItem[];
	capacity?: {
		current: number;
		max: number;
	};
}

// Этап квеста
export interface QuestStage {
	name: string;
	status: StageStatus;
	completedAt?: string;
}

// Главный квест
export interface MainQuest {
	name: string;
	description: string;
	currentObjective: string;
	progress: number;
	stages: QuestStage[];
	deadline?: string;
	stakes?: string;
}

// Побочный квест
export interface SideQuest {
	name: string;
	description: string;
	progress: number;
	status: QuestStatus;
	giver?: string; // имя NPC
	reward?: string;
	timeLimit?: string;
}

// Квесты
export interface Quests {
	main: MainQuest;
	side: SideQuest[];
	hints: string[];
	completed: number;
	failed: number;
}

// Опция действия
export interface ActionOption {
	action: string;
	risk: RiskLevel;
	potentialReward: string;
	insertText: string;
	category: 'combat' | 'social' | 'exploration' | 'stealth' | 'magic' | 'other';
	requiredItem?: string;
	successChance?: number;
}

// Предупреждение
export interface Warning {
	text: string;
	severity: RiskLevel;
	category: 'combat' | 'social' | 'resource' | 'time' | 'story';
	suggestion?: string;
}

// Предсказания
export interface Predictions {
	immediateOptions: ActionOption[];
	plotHooks: string[];
	warnings: Warning[];
	opportunities: string[];
	characterMoments: Array<{
		npcId?: string;
		heroMoment?: boolean;
		opportunity: string;
		type: 'развитие' | 'конфликт' | 'откровение' | 'выбор';
	}>;
}

// Советы по сюжету
export interface StoryAdvice {
	writingTips: Array<{
		category: 'pacing' | 'character' | 'dialogue' | 'description' | 'conflict';
		tip: string;
		example?: string;
	}>;
	plotSuggestions: Array<{
		title: string;
		description: string;
		impact: 'minor' | 'moderate' | 'major';
		insertText?: string;
	}>;
	characterDevelopment: Array<{
		character: string; // имя героя или NPC
		suggestion: string;
		trigger?: string;
	}>;
	atmosphereEnhancement: string[];
}

// Временная шкала событий
export interface TimelineEvent {
	id: string;
	timestamp: string;
	title: string;
	description: string;
	type: 'action' | 'dialogue' | 'discovery' | 'combat' | 'relationship' | 'plot';
	importance: RiskLevel;
	characters: string[]; // имена участвующих (герой + NPC)
	location?: string;
}

// Статистика сессии
export interface SessionStats {
	duration: string;
	messagesCount: number;
	wordsWritten: number;
	averageMessageLength: number;
	longestMessage: number;
	heroMessageCount: number;
	narratorMessageCount: number;
	actionVsDialogue: {
		action: number;
		dialogue: number;
		description: number;
	};
	emotionalJourney: Array<{
		point: number;
		emotion: string;
		trigger: string;
	}>;
}

// Полные данные аналитики для героя
export interface AnalyticsData {
	meta: AnalyticsMeta;
	storyAnalytics: StoryAnalytics;
	hero: Hero;                          // главный герой
	npcs: NPC[];                         // все встреченные NPC
	location: Location;
	relationships: Relationship[];        // отношения героя с NPC
	inventory: Inventory;
	quests: Quests;
	predictions: Predictions;
	storyAdvice: StoryAdvice;
	timeline: TimelineEvent[];
	sessionStats: SessionStats;
}

// Кэш аналитики
export interface AnalyticsCache {
	data: AnalyticsData | null;
	lastAnalysisTime: number | null;
	version: string;
}

// Состояние UI аналитики (можно оставить без изменений или упростить)
export interface AnalyticsUIState {
	activeTab: 'overview' | 'hero' | 'world' | 'story' | 'predictions';
	expandedSections: Set<string>;
	revealedSpoilers: Set<string>;
	selectedNpc: string | null;
}