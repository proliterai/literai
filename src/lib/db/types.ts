// ================================================================================
// ФАЙЛ: src/lib/db/types.ts
// ================================================================================

export type CatalogItemType = 'character' | 'role' | 'scene';

export type CatalogItemMeta = {
  author: 'system' | 'user';
  createdAt?: string;
  updatedAt?: string;
  seedVersion?: number;
};

export type CatalogItemRow = {
  id: string;
  type: CatalogItemType;
  name: string;
  description?: string;
  tags?: string[];
  avatar?: string;
  meta?: CatalogItemMeta;
};

export type ProviderRow = {
  id: string;
  name: string;
  url: string;
  model: string;
  apiKey: string;
  order: number;
  isActive: boolean;
  createdAt: string;
};

export type SettingRow = {
  key: string;
  value: any;
};

// --- НОВЫЕ ТИПЫ ДЛЯ ПОИСКА ---
export interface SearchSnippet {
  id: string;           
  tag: string;          
  title: string;        
  description: string;  
}

export interface SearchClarification {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  versions?: { content: string; createdAt: string }[];
  activeVersion?: number;
}

export interface SearchArticle {
  snippetId: string;
  content: string;
  versions?: { content: string; createdAt: string }[]; // <-- ВЕРСИИ СТАТЬИ
  activeVersion?: number;                              // <-- АКТИВНАЯ ВЕРСИЯ
  clarificationHistory: SearchClarification[];
}

export interface SearchSessionData {
  query: string;
  snippets: SearchSnippet[];
  snippetVersions?: SearchSnippet[][]; // <-- ИСТОРИЯ ГЕНЕРАЦИЙ СНИППЕТОВ
  activeSnippetVersion?: number;       // <-- АКТИВНАЯ ВЕРСИЯ СНИППЕТОВ
  currentArticleSnippetId?: string;
  articles: Record<string, SearchArticle>;
}
// -----------------------------

// Добавлен режим 'search'
export type SessionMode = 'roleplay' | 'hero' | 'team' | 'search';

export type SessionRow = {
  id: string;
  mode: SessionMode;
  title: string;
  selectedItems: any;
  generatedScript: string;
  chatTree: any;
  chatParts: any;
  currentPartIndex: number;
  analyticsData?: any;
  systemPromptData?: any;
  cheatmodeData?: any;
  lorebookData?: any;
  privateChatsData?: any;
  eyeData?: any;
  mapData?: any;
  memoryBookData?: any;
  searchData?: SearchSessionData;
  createdAt: string;
  updatedAt: string;
};