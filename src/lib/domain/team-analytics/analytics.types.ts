// src/lib/domain/team-analytics/analytics.types.ts

/**
 * Уровни напряжения в группе
 */
export type TensionLevel = 'low' | 'medium' | 'high';

/**
 * Степень влияния предложенной идеи на сюжет
 */
export type SuggestionImpact = 'low' | 'medium' | 'high';

/**
 * Критичность логической ошибки/предупреждения
 */
export type WarningSeverity = 'low' | 'medium' | 'high';

/**
 * Детальный анализ конкретного персонажа
 */
export interface CharacterAnalysis {
	id: string;
	name: string;
	role: string;
	mood: string;
	participationScore: number;
	alignmentScore: number;
	summary: string;
}

/**
 * Анализ напряжения между участниками чата
 */
export interface TeamTension {
	level: TensionLevel;
	reason: string;
	involvedCharacters: string[];
}

/**
 * Идеи для дальнейшего развития сюжета от ИИ
 */
export interface StorySuggestion {
	title: string;
	description: string;
	impact: SuggestionImpact;
}

/**
 * Предупреждения о логических дырах, забытых фактах или ООС
 */
export interface LogicWarning {
	severity: WarningSeverity;
	message: string;
	suggestion: string;
}

/**
 * Полный результат работы аналитического движка (legacy)
 */
export interface AnalyticsResult {
	summary: string;
	characters: Record<string, CharacterAnalysis>;
	teamTension: TeamTension;
	suggestions: StorySuggestion[];
	logicWarnings: LogicWarning[];
	timestamp: number;
}

/**
 * Состояние Svelte-стора для управления аналитикой (legacy)
 */
export interface AnalyticsState {
	isAnalyzing: boolean;
	result: AnalyticsResult | null;
	error: string | null;
	lastAnalyzedMessageCount: number;
}

// ================================================================================
// Типы для TeamAnalyticsModal и TeamAnalyticsService
// ================================================================================

export interface CharacterStatData {
	value: number;
	status?: string;
	trend: 'up' | 'down' | 'stable';
}

export interface CharacterMood {
	primary: string;
	emoji?: string;
	description?: string;
}

export interface StatusEffect {
	name: string;
	icon: string;
	isPositive: boolean;
}

export interface TeamCharacterData {
	id: string;
	name: string;
	avatar?: string;
	role?: string;
	stats?: Record<string, CharacterStatData>;
	mood?: CharacterMood;
	statusEffects?: StatusEffect[];
	currentGoal?: string;
	secretThought?: string;
	strengths?: string[];
	weaknesses?: string[];
}

export interface RelationshipData {
	fromId: string;
	fromName: string;
	toId: string;
	toName: string;
	value: number;
	type: string;
	status: string;
	recentChange?: string;
	hasTension: boolean;
	notes?: string;
}

export interface LocationAtmosphere {
	[key: string]: number;
}

export interface PointOfInterest {
	name: string;
	icon: string;
	status: string;
	hint?: string;
}

export interface LocationExit {
	direction: string;
	destination: string;
	danger: number;
	locked: boolean;
}

export interface LocationData {
	name?: string;
	type?: string;
	description?: string;
	atmosphere?: LocationAtmosphere;
	pointsOfInterest?: PointOfInterest[];
	exits?: LocationExit[];
}

export interface InventoryItem {
	name: string;
	icon: string;
	quantity: number;
	owner: string;
	description?: string;
	rarity?: string;
}

export interface InventoryData {
	resources?: {
		gold?: number;
		food?: number;
		special?: unknown[];
	};
	items?: InventoryItem[];
}

export interface StoryArc {
	name: string;
	description: string;
	progress: number;
	startedAt?: string;
}

export interface UnresolvedItem {
	type: string;
	description: string;
	importance: string;
	suggestedResolution?: string;
}

export interface StoryAnalyticsData {
	currentArc?: StoryArc;
	pacing?: { current: string; recommendation: string };
	tone?: { primary: string; secondary: string | null };
	themes?: Array<{ name: string; icon: string; prominence: number; examples: string[] }>;
	unresolved?: UnresolvedItem[];
}

export interface PredictionAction {
	action: string;
	risk: string;
	potentialReward: string;
	insertText: string;
	category: string;
}

export interface PredictionWarning {
	text: string;
	severity: string;
	suggestion?: string;
}

export interface PredictionsData {
	immediateOptions?: PredictionAction[];
	plotHooks?: string[];
	warnings?: PredictionWarning[];
	characterMoments?: Array<{ character: string; opportunity: string; type: string }>;
}

export interface PlotSuggestion {
	title: string;
	description: string;
	impact: string;
}

export interface StoryAdviceData {
	writingTips?: Array<{ category: string; tip: string; example: string }>;
	plotSuggestions?: PlotSuggestion[];
	atmosphereEnhancement?: string[];
}

export interface SessionStatsData {
	duration: string;
	messagesCount: number;
	wordsWritten: number;
	actionVsDialogue: { action: number; dialogue: number; description: number };
}

export interface MetaData {
	storyPhase: string;
	overallTension: number;
	gameDay: number;
	chapterSummary: string;
	sessionDuration: string;
	totalMessages: number;
	wordCount: number;
	privateMessageCount: number;
}

/**
 * Полная структура данных аналитики команды (возвращается от AI)
 */
export interface TeamAnalyticsData {
	meta?: MetaData;
	storyAnalytics?: StoryAnalyticsData;
	characters?: TeamCharacterData[];
	relationships?: RelationshipData[];
	location?: LocationData;
	inventory?: InventoryData;
	quests?: {
		main?: { name: string; description: string; currentObjective: string; progress: number };
		side?: unknown[];
		hints?: string[];
	};
	predictions?: PredictionsData;
	storyAdvice?: StoryAdviceData;
	sessionStats?: SessionStatsData;
	timestamp?: number;
}

/**
 * Кэш аналитики для localStorage
 */
export interface TeamAnalyticsCache {
	data: TeamAnalyticsData | null;
	lastAnalysisTime: number | null;
	version: string;
}

/**
 * UI-состояние модального окна аналитики
 */
export interface TeamAnalyticsUIState {
	activeTab: 'overview' | 'characters' | 'world' | 'story' | 'predictions';
	expandedSections: Set<string>;
	revealedSpoilers: Set<string>;
	selectedCharacter: string | null;
}