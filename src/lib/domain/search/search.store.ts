// ================================================================================
// ФАЙЛ: src/lib/domain/search/search.store.ts
// Описание: Управление состоянием поисковой сессии
// ================================================================================

import { writable, get } from 'svelte/store';
import type { SearchSnippet, SearchArticle, SearchSessionData, SessionRow } from '$lib/db/types';

export interface SearchState {
  sessionId: string | null;
  title: string;
  query: string;
  
  snippets: SearchSnippet[];
  snippetVersions: SearchSnippet[][];
  activeSnippetVersion: number;

  currentArticleSnippetId: string | null;
  articles: Record<string, SearchArticle>;
  
  isGeneratingSnippets: boolean;
  isGeneratingArticle: boolean;
  isClarifying: boolean;
}

const initialState: SearchState = {
  sessionId: null,
  title: 'Новый поиск',
  query: '',
  snippets: [],
  snippetVersions: [],
  activeSnippetVersion: 0,
  currentArticleSnippetId: null,
  articles: {},
  isGeneratingSnippets: false,
  isGeneratingArticle: false,
  isClarifying: false,
};

function sid(): string {
  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSearchStore() {
  const store = writable<SearchState>(initialState);
  const { subscribe, set, update } = store;

  let autoSaveCallback: (() => void) | null = null;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (autoSaveCallback) autoSaveCallback();
    }, 1000);
  }

  return {
    subscribe,

    startNewSession(query: string): string {
      const sessionId = sid();
      set({
        ...initialState,
        sessionId,
        title: query.length > 50 ? query.slice(0, 50) + '...' : query,
        query
      });
      triggerAutoSave();
      return sessionId;
    },

    loadSession(session: SessionRow): void {
      const data = session.searchData;
      if (!data) return;

      // Миграция старых данных: если нет snippetVersions, создаем из текущих сниппетов
      const snippetVersions = data.snippetVersions || (data.snippets?.length ? [data.snippets] : []);
      const activeSnippetVersion = data.activeSnippetVersion ?? (snippetVersions.length ? snippetVersions.length - 1 : 0);

      set({
        ...initialState,
        sessionId: session.id,
        title: session.title,
        query: data.query,
        snippets: data.snippets || [],
        snippetVersions,
        activeSnippetVersion,
        currentArticleSnippetId: data.currentArticleSnippetId || null,
        articles: data.articles || {}
      });
    },

    setIsGeneratingSnippets(val: boolean) { update(s => ({ ...s, isGeneratingSnippets: val })); },
    setIsGeneratingArticle(val: boolean) { update(s => ({ ...s, isGeneratingArticle: val })); },
    setIsClarifying(val: boolean) { update(s => ({ ...s, isClarifying: val })); },

    // --- УПРАВЛЕНИЕ СНИППЕТАМИ ---
    setSnippets(snippets: SearchSnippet[]) {
      update(s => {
        const versions = [...s.snippetVersions, snippets];
        return {
          ...s,
          snippets,
          snippetVersions: versions,
          activeSnippetVersion: versions.length - 1
        };
      });
      triggerAutoSave();
    },

    switchSnippetVersion(dir: -1 | 1) {
      update(s => {
        if (s.snippetVersions.length < 2) return s;
        const total = s.snippetVersions.length;
        let next = s.activeSnippetVersion + dir;
        if (next < 0) next = total - 1;
        if (next >= total) next = 0;
        
        return {
          ...s,
          activeSnippetVersion: next,
          snippets: s.snippetVersions[next]
        };
      });
      triggerAutoSave();
    },

    openArticle(snippetId: string) {
      update(s => ({ ...s, currentArticleSnippetId: snippetId }));
      triggerAutoSave();
    },

    goBackToResults() {
      update(s => ({ ...s, currentArticleSnippetId: null }));
      triggerAutoSave();
    },

    // --- УПРАВЛЕНИЕ СТАТЬЕЙ ---
    setArticleContent(snippetId: string, content: string) {
      update(s => {
        const now = new Date().toISOString();
        const article: SearchArticle = s.articles[snippetId] || {
          snippetId,
          content: '',
          clarificationHistory: []
        };

        const versions = article.versions 
          ? [...article.versions, { content, createdAt: now }] 
          : (article.content ? [{ content: article.content, createdAt: now }, { content, createdAt: now }] : [{ content, createdAt: now }]);

        return {
          ...s,
          articles: { 
            ...s.articles, 
            [snippetId]: { 
              ...article, 
              content, 
              versions, 
              activeVersion: versions.length - 1 
            } 
          }
        };
      });
      triggerAutoSave();
    },

    switchArticleVersion(snippetId: string, dir: -1 | 1) {
      update(s => {
        const article = s.articles[snippetId];
        if (!article || !article.versions || article.versions.length < 2) return s;

        const total = article.versions.length;
        let next = (article.activeVersion ?? 0) + dir;
        if (next < 0) next = total - 1;
        if (next >= total) next = 0;

        return {
          ...s,
          articles: {
            ...s.articles,
            [snippetId]: {
              ...article,
              activeVersion: next,
              content: article.versions[next].content
            }
          }
        };
      });
      triggerAutoSave();
    },

    // --- УПРАВЛЕНИЕ УТОЧНЕНИЯМИ ---
    addClarificationMessage(snippetId: string, role: 'user' | 'assistant', content: string) {
      update(s => {
        const article = s.articles[snippetId];
        if (!article) return s;
        
        const now = new Date().toISOString();
        const newMsg = {
          id: 'cmsg_' + Date.now() + Math.random().toString(36).slice(2),
          role,
          content,
          versions: [{ content, createdAt: now }],
          activeVersion: 0
        };
        
        return {
          ...s,
          articles: { 
            ...s.articles, 
            [snippetId]: {
              ...article,
              clarificationHistory: [...article.clarificationHistory, newMsg]
            } 
          }
        };
      });
      triggerAutoSave();
    },

    addClarificationVersion(snippetId: string, msgId: string, content: string) {
      update(s => {
        const article = s.articles[snippetId];
        if (!article) return s;

        const now = new Date().toISOString();
        const history = article.clarificationHistory.map(m => {
          if (m.id !== msgId || m.role !== 'assistant') return m;
          const versions = m.versions ? [...m.versions, { content, createdAt: now }] : [{ content: m.content, createdAt: now }, { content, createdAt: now }];
          return { ...m, content, versions, activeVersion: versions.length - 1 };
        });

        return { ...s, articles: { ...s.articles, [snippetId]: { ...article, clarificationHistory: history } } };
      });
      triggerAutoSave();
    },

    switchClarificationVersion(snippetId: string, msgId: string, dir: -1 | 1) {
      update(s => {
        const article = s.articles[snippetId];
        if (!article) return s;

        const history = article.clarificationHistory.map(m => {
          if (m.id !== msgId || m.role !== 'assistant' || !m.versions) return m;
          const total = m.versions.length;
          let next = (m.activeVersion ?? 0) + dir;
          if (next < 0) next = total - 1;
          if (next >= total) next = 0;
          return { ...m, activeVersion: next, content: m.versions[next].content };
        });

        return { ...s, articles: { ...s.articles, [snippetId]: { ...article, clarificationHistory: history } } };
      });
      triggerAutoSave();
    },

    // --- ЭКСПОРТ ---
    toSearchData(): SearchSessionData {
      const s = get(store);
      return {
        query: s.query,
        snippets: s.snippets,
        snippetVersions: s.snippetVersions,
        activeSnippetVersion: s.activeSnippetVersion,
        currentArticleSnippetId: s.currentArticleSnippetId || undefined,
        articles: s.articles
      };
    },

    onAutoSave(callback: () => void) {
      autoSaveCallback = callback;
    },

    destroy() {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveCallback = null;
      set(initialState);
    }
  };
}

export const searchStore = createSearchStore();