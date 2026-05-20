// ================================================================================
// ФАЙЛ: src/lib/domain/team-chat/teamChat.store.ts
// Описание: Хранилище состояния чата для режима «Игра за команду»
// ================================================================================

import { writable, derived, get } from 'svelte/store';
import type {
  Branch,
  ChatMessage,
  ChatPart,
  ChatTree,
  MsgVersion,
  PartSummaryRef
} from '$lib/domain/chat/chat.types';
import type { TeamSelectedItems, TeamChatState, TeamChatSessionRow } from './teamChat.types';

// ✅ ИСПРАВЛЕНИЕ P0.2: Правильный путь к типам базы данных
import type { CatalogItemRow } from '$lib/db/types'; 

import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { memoryBookStore } from '$lib/domain/memorybook/memorybook.store';

// Константы для системного промпта команды
export const SUFFIX_MARKER = '[Правило] Рассказчик ведёт историю';

export const SYSTEM_PROMPT_SUFFIX = `
[Правило] Рассказчик ведёт историю от лица мира, описывает события, локации, NPC и продвигает сюжет.
`.trim();

// Путь к плейсхолдеру аватара
export const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

// ================================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================================================================

function sid(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function bid(): string {
  return `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ================================================================================
// ПОСТРОЕНИЕ СИСТЕМНОГО ПРОМПТА
// ================================================================================

function buildTitle(sel: TeamSelectedItems | null): string {
  if (!sel) return 'Новая история';
  
  // Берем имена всех персонажей
  const names = sel.teamCharacters.map(c => c.name).join(', ');
  const scene = sel.scene?.name || '';
  
  const baseTitle = names || 'Команда';
  
  return scene ? `${baseTitle}. ${scene}` : baseTitle;
}

function buildFullSystemPrompt(
  basePrompt: string,
  generatedScript: string,
  summarySection = ''
): string {
  const prompt = basePrompt || 'Ты — рассказчик в интерактивной истории для команды.';
  const showHints = get(settingsStore).values[SETTINGS_KEYS.SHOW_HINTS] ?? true;

  let fullPrompt = `${prompt}

Персонажи и мир:
${generatedScript}${summarySection ? `\n\n${summarySection}` : ''}`;

  if (showHints) {
    fullPrompt += `\n\n${SYSTEM_PROMPT_SUFFIX}`;
  }

  return fullPrompt;
}

// Функция проверяет версии для ЛЮБЫХ ролей (и для ИИ, и для персонажей)
function getActiveContent(m: ChatMessage): string {
  if (m.versions?.length) {
    return m.versions[m.activeVersion ?? 0]?.content ?? m.content;
  }
  return m.content;
}

// ================================================================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ================================================================================

const initialState: TeamChatState = {
  sessionId: null,
  title: 'Новая история',
  selectedItems: null,
  generatedScript: '',
  itemDescriptions: null,
  chatTree: { branches: [], activeBranchIndex: 0 },
  chatParts: [],
  currentPartIndex: 0,
  isSummarizing: false,
  isRerolling: false,
  isGenerating: false,
  analyticsData: null,
  mapData: null // хранилище для карты в оперативной памяти
};

// ================================================================================
// СОЗДАНИЕ STORE
// ================================================================================

export function createTeamChatStore() {
  const store = writable<TeamChatState>(initialState);
  const { subscribe, set, update } = store;

  // Derived stores для удобного доступа
  const activeBranch = derived(store, $s => $s.chatTree.branches[$s.chatTree.activeBranchIndex] ?? null);
  const currentPart = derived(store, $s => $s.chatParts[$s.currentPartIndex] ?? null);

  // Колбэк для загрузки данных (приватные чаты и т.п.)
  let onSessionLoadCallback: ((data: any) => void) | null = null;
  
  // Колбэк для автосохранения
  let autoSaveCallback: (() => void) | null = null;
  
  // Debounce таймер для автосохранения
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const AUTO_SAVE_DELAY = 2000;

  // Функция триггера автосохранения
  function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (autoSaveCallback) autoSaveCallback();
    }, AUTO_SAVE_DELAY);
  }

  // ================================================================================
  // ПУБЛИЧНЫЙ API
  // ================================================================================

  return {
    subscribe,
    activeBranch,
    currentPart,

    // ------------------------------------------------------------------------
    // СБРОС И ОЧИСТКА
    // ------------------------------------------------------------------------

    reset(): void {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      set(initialState);
    },

    onSessionLoad(callback: (data: any) => void): void {
      onSessionLoadCallback = callback;
    },
    
    // Метод для подключения автосохранения
    onAutoSave(callback: () => void): void {
      autoSaveCallback = callback;
    },

    destroy(): void {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      onSessionLoadCallback = null;
      autoSaveCallback = null;
      set(initialState);
    },

    // ------------------------------------------------------------------------
    // ФЛАГИ СОСТОЯНИЯ
    // ------------------------------------------------------------------------

    setIsSummarizing(v: boolean): void {
      update(s => ({ ...s, isSummarizing: v }));
    },

    setIsRerolling(v: boolean): void {
      update(s => ({ ...s, isRerolling: v }));
    },

    setIsGenerating(v: boolean): void {
      update(s => ({ ...s, isGenerating: v }));
    },

    // ------------------------------------------------------------------------
    // ПОЛУЧЕНИЕ СПИСКА ПЕРСОНАЖЕЙ
    // ------------------------------------------------------------------------

    getTeamCharacters(): CatalogItemRow[] {
      return get(store).selectedItems?.teamCharacters ?? [];
    },

    getItemDescriptions(): any {
      return get(store).itemDescriptions;
    },

    getGeneratedScript(): string {
      return get(store).generatedScript;
    },

    // ------------------------------------------------------------------------
    // СОЗДАНИЕ НОВОЙ СЕССИИ
    // ------------------------------------------------------------------------

    startNewSession(
      selections: TeamSelectedItems,
      generatedScript: string,
      basePrompt: string,
      itemDescriptions?: any
    ): string {
      const sessionId = sid();
      const now = nowIso();

      // Первая часть
      const part1: ChatPart = {
        id: 'part_1',
        partNumber: 1,
        name: 'Часть 1',
        summary: '',
        previousSummaries: [],
        branchIds: [],
        createdAt: now
      };

      // Первая ветвь
      const branchId = bid();
      const systemPrompt = buildFullSystemPrompt(basePrompt, generatedScript);

      const branch1: Branch = {
        id: branchId,
        name: 'Ветвь 1',
        createdAt: now,
        partId: part1.id,
        messages: [
          {
            id: mid(),
            role: 'system',
            content: systemPrompt,
            createdAt: now
          }
        ]
      };

      part1.branchIds.push(branchId);

      set({
        ...initialState,
        sessionId,
        title: buildTitle(selections),
        selectedItems: selections,
        generatedScript,
        itemDescriptions: itemDescriptions || null,
        chatParts: [part1],
        currentPartIndex: 0,
        chatTree: { branches: [branch1], activeBranchIndex: 0 }
      });
      
      triggerAutoSave();

      return sessionId;
    },

    // ------------------------------------------------------------------------
    // ЗАГРУЗКА СЕССИИ
    // ------------------------------------------------------------------------

    loadSession(session: TeamChatSessionRow): void {
      const migratedBranches = (session.chatTree?.branches ?? []).map((b: Branch) => ({
        ...b,
        messages: (b.messages ?? []).map((m: ChatMessage) => ({
          ...m,
          id: m.id ?? mid()
        }))
      }));

      set({
        ...initialState,
        sessionId: session.id,
        title: session.title,
        selectedItems: session.selectedItems,
        generatedScript: session.generatedScript,
        itemDescriptions: session.itemDescriptions || null,
        chatTree: { ...session.chatTree, branches: migratedBranches },
        chatParts: session.chatParts ?? [],
        currentPartIndex: session.currentPartIndex ?? 0,
        analyticsData: session.analyticsData ?? null,
        mapData: session.mapData ?? null
      });

      // Импорт данных Memory Book при загрузке сессии
      memoryBookStore.importData(session.memoryBookData);

      // Активируем первую ветку текущей части
      update(s => {
        const part = s.chatParts[s.currentPartIndex];
        if (!part?.branchIds?.length) return s;
        const firstId = part.branchIds[0];
        const idx = s.chatTree.branches.findIndex(b => b.id === firstId);
        if (idx === -1) return s;
        return { ...s, chatTree: { ...s.chatTree, activeBranchIndex: idx } };
      });

      // Вызываем колбэк для прочих восстановлений (читмод, промпты, приватные чаты)
      if (onSessionLoadCallback) {
        onSessionLoadCallback({
          systemPromptData: session.systemPromptData,
          cheatmodeData: session.cheatmodeData,
          lorebookData: session.lorebookData,
          privateChatsData: session.privateChatsData
        });
      }
    },

    // ------------------------------------------------------------------------
    // ЭКСПОРТ ДАННЫХ СЕССИИ
    // ------------------------------------------------------------------------

    toSessionData(): TeamChatSessionRow {
      const s = get(store);
      const now = nowIso();

      return {
        id: s.sessionId!,
        mode: 'team',
        title: s.title,
        selectedItems: s.selectedItems,
        generatedScript: s.generatedScript,
        itemDescriptions: s.itemDescriptions,
        chatTree: s.chatTree,
        chatParts: s.chatParts,
        currentPartIndex: s.currentPartIndex,
        analyticsData: s.analyticsData,
        mapData: s.mapData,
        createdAt: s.chatParts[0]?.createdAt ?? now,
        updatedAt: now
      };
    },

    // ------------------------------------------------------------------------
    // ПОЛУЧЕНИЕ СООБЩЕНИЙ ДЛЯ API
    // ------------------------------------------------------------------------

    getMessagesForAPI(): Array<{ role: string; content: string }> {
      const s = get(store);
      const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
      if (!branch) return [];

      return branch.messages.map(m => ({
        role: m.role,
        content: getActiveContent(m) 
      }));
    },

    // ------------------------------------------------------------------------
    // ОБНОВЛЕНИЕ СИСТЕМНОГО ПРОМПТА В ЧАТЕ
    // ------------------------------------------------------------------------

    updateSystemPromptInChat(newBasePromptOrSet: string | { intro: string; continuation: string; characterActing: string }): void {
      update(s => {
        if (!s.sessionId) return s;

        // Берем ТОЛЬКО intro для корневого системного сообщения
        let newBasePrompt: string;
        if (typeof newBasePromptOrSet === 'string') {
          newBasePrompt = newBasePromptOrSet;
        } else {
          newBasePrompt = newBasePromptOrSet.intro;
        }

        const branches = s.chatTree.branches.map(branch => {
          const messages = branch.messages.map(m => {
            if (m.role !== 'system') return m;

            const part = s.chatParts.find(p => p.id === branch.partId);
            let summarySection = '';
            if (part?.previousSummaries?.length) {
              summarySection =
                'Предыдущая история (краткий пересказ):\n' +
                part.previousSummaries.map(x => `${x.partName}: ${x.summary}`).join('\n');
            }

            const newContent = buildFullSystemPrompt(
              newBasePrompt,
              s.generatedScript,
              summarySection
            );

            return { ...m, content: newContent };
          });

          return { ...branch, messages };
        });

        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // ПОЛУЧЕНИЕ selectedItems
    // ------------------------------------------------------------------------

    getSelectedItems(): TeamSelectedItems | null {
      return get(store).selectedItems;
    },

    isSessionActive(): boolean {
      return !!get(store).sessionId;
    },

    // ------------------------------------------------------------------------
    // СУММАРИЗАЦИЯ И ИНФОРМАЦИЯ О ЧАСТЯХ
    // ------------------------------------------------------------------------

    getAccumulatedSummaries(max = 5): Array<{ partName: string; summary: string }> {
      const s = get(store);
      const start = Math.max(0, s.currentPartIndex - max);
      const out: Array<{ partName: string; summary: string }> = [];

      for (let i = start; i < s.currentPartIndex; i++) {
        const p = s.chatParts[i];
        if (p?.summary) {
          out.push({ partName: p.name, summary: p.summary });
        }
      }
      return out;
    },

    getBranchesForCurrentPart(): Array<{ b: Branch; idx: number }> {
      const s = get(store);
      const part = s.chatParts[s.currentPartIndex];
      if (!part) return [];

      const ids = new Set(part.branchIds);
      return s.chatTree.branches
        .map((b, idx) => ({ b, idx }))
        .filter(({ b }) => ids.has(b.id));
    },
    
    getCurrentState(): TeamChatState {
      return get(store);
    },

    // ------------------------------------------------------------------------
    // ДОБАВЛЕНИЕ СООБЩЕНИЙ
    // ------------------------------------------------------------------------

    addUserMessage(text: string, characterId: string): void {
      const s = get(store);
      const character = s.selectedItems?.teamCharacters?.find(c => c.id === characterId);
      if (!character) {
        console.error('[TeamChatStore] Персонаж не найден:', characterId);
        return;
      }

      update(state => {
        const bi = state.chatTree.activeBranchIndex;
        const branch = state.chatTree.branches[bi];
        if (!branch) return state;

        const msg: ChatMessage = {
          id: mid(),
          role: 'user',
          content: text.trim(),
          createdAt: nowIso(),
          characterId: character.id,
          characterName: character.name,
          characterAvatar: character.avatar || AVATAR_PLACEHOLDER
        };

        const branches = state.chatTree.branches.slice();
        branches[bi] = {
          ...branch,
          messages: [...branch.messages, msg]
        };

        return { ...state, chatTree: { ...state.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    addCharacterMessage(text: string, character: { id: string; name: string; avatar?: string }): void {
      this.addUserMessage(text, character.id);
    },

    addAssistantMessage(content: string, isError = false): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const now = nowIso();
        const msg: ChatMessage = {
          id: mid(),
          role: 'assistant',
          content,
          versions: [{ content, createdAt: now }],
          activeVersion: 0,
          isEdited: false,
          isError,
          createdAt: now
        };

        const branches = s.chatTree.branches.slice();
        branches[bi] = {
          ...branch,
          messages: [...branch.messages, msg]
        };

        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // ОБНОВЛЕНИЕ СООБЩЕНИЙ
    // ------------------------------------------------------------------------

    updateMessage(messageId: string, newContent: string): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const messages = branch.messages.map(m => {
          if (m.id !== messageId) return m;

          // Обновляем версии для ЛЮБЫХ ролей
          if (m.versions?.length) {
            const av = m.activeVersion ?? 0;
            const versions = m.versions.map((v, i) =>
              i === av ? { ...v, content: newContent } : v
            );
            return { ...m, content: newContent, versions, isEdited: true };
          }

          return { ...m, content: newContent, isEdited: true };
        });

        const branches = s.chatTree.branches.slice();
        branches[bi] = { ...branch, messages };
        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    editUserMessageAndTruncate(messageId: string, newContent: string): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const idx = branch.messages.findIndex(m => m.id === messageId);
        if (idx === -1) return s;

        const messages = branch.messages.slice();
        messages[idx] = { ...messages[idx], content: newContent, isEdited: true };
        messages.splice(idx + 1); // удалить всё после

        const branches = s.chatTree.branches.slice();
        branches[bi] = { ...branch, messages };
        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    deleteMessageWithPairRule(messageId: string): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const idx = branch.messages.findIndex(m => m.id === messageId);
        if (idx === -1) return s;

        const target = branch.messages[idx];
        const next = branch.messages[idx + 1];
        const messages = branch.messages.slice();

        messages.splice(idx, 1);

        // Правило парного удаления (если удалили пользователя, удаляем и следующий ответ ИИ)
        if (target.role === 'user' && next?.role === 'assistant') {
          if (messages[idx]?.id === next.id) {
            messages.splice(idx, 1);
          }
        }

        const branches = s.chatTree.branches.slice();
        branches[bi] = { ...branch, messages };
        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // ВЕРСИИ СООБЩЕНИЙ
    // ------------------------------------------------------------------------

    addAssistantVersion(messageId: string, content: string): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const now = nowIso();
        const messages = branch.messages.map(m => {
          if (m.id !== messageId) return m;

          const versions: MsgVersion[] = m.versions?.length
            ? [...m.versions, { content, createdAt: now }]
            : [{ content: m.content, createdAt: m.createdAt }, { content, createdAt: now }];

          return {
            ...m,
            versions,
            activeVersion: versions.length - 1,
            content,
    isError: false
          };
        });

        const branches = s.chatTree.branches.slice();
        branches[bi] = { ...branch, messages };
        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    switchVersion(messageId: string, dir: -1 | 1): void {
      update(s => {
        const bi = s.chatTree.activeBranchIndex;
        const branch = s.chatTree.branches[bi];
        if (!branch) return s;

        const messages = branch.messages.map(m => {
          if (m.id !== messageId) return m;
          if (!m.versions?.length || m.versions.length < 2) return m;

          const total = m.versions.length;
          let next = (m.activeVersion ?? 0) + dir;

          if (next < 0) next = total - 1;
          if (next >= total) next = 0;

          return {
            ...m,
            activeVersion: next,
            content: m.versions[next].content
          };
        });

        const branches = s.chatTree.branches.slice();
        branches[bi] = { ...branch, messages };
        return { ...s, chatTree: { ...s.chatTree, branches } };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // ВЕТВЛЕНИЕ
    // ------------------------------------------------------------------------

    createBranchFromEdit(messageId: string, newContent: string): void {
      update(s => {
        const active = s.chatTree.branches[s.chatTree.activeBranchIndex];
        if (!active) return s;

        const messageIndex = active.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return s;

        const newBranchId = bid();
        const now = nowIso();
        const newBranchName = `Ветвь ${s.chatTree.branches.length + 1}`;

        const prefix = active.messages
          .slice(0, messageIndex + 1)
          .map(m => ({
            ...m,
            versions: m.versions ? m.versions.map(v => ({ ...v })) : undefined
          }));

        prefix[messageIndex] = {
          ...prefix[messageIndex],
          id: mid(),
          content: newContent
        };

        const newBranch: Branch = {
          id: newBranchId,
          name: newBranchName,
          messages: prefix,
          createdAt: now,
          parentBranchId: active.id,
          forkPoint: messageIndex,
          partId: active.partId
        };

        const branches = [...s.chatTree.branches, newBranch];
        const chatParts = s.chatParts.map((p, idx) => {
          if (idx !== s.currentPartIndex) return p;
          if (p.branchIds.includes(newBranchId)) return p;
          return { ...p, branchIds: [...p.branchIds, newBranchId] };
        });

        return {
          ...s,
          chatTree: { branches, activeBranchIndex: branches.length - 1 },
          chatParts
        };
      });
      
      triggerAutoSave();
    },

    switchBranch(branchIndex: number): void {
      update(s => {
        if (branchIndex < 0 || branchIndex >= s.chatTree.branches.length) return s;
        return { ...s, chatTree: { ...s.chatTree, activeBranchIndex: branchIndex } };
      });
    },

    deleteBranch(branchIndex: number): void {
      update(s => {
        if (branchIndex <= 0 || branchIndex >= s.chatTree.branches.length) return s;

        const branch = s.chatTree.branches[branchIndex];
        const branches = s.chatTree.branches.slice();
        branches.splice(branchIndex, 1);

        const chatParts = s.chatParts.map(p =>
          p.branchIds.includes(branch.id)
            ? { ...p, branchIds: p.branchIds.filter(id => id !== branch.id) }
            : p
        );

        let activeBranchIndex = s.chatTree.activeBranchIndex;
        if (activeBranchIndex >= branches.length) activeBranchIndex = branches.length - 1;
        if (activeBranchIndex < 0) activeBranchIndex = 0;

        return { ...s, chatTree: { branches, activeBranchIndex }, chatParts };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // ЧАСТИ ИСТОРИИ
    // ------------------------------------------------------------------------

    switchPart(partIndex: number): void {
      update(s => {
        if (partIndex < 0 || partIndex >= s.chatParts.length) return s;

        const part = s.chatParts[partIndex];
        const firstBranchId = part.branchIds[0];
        const idx = firstBranchId
          ? s.chatTree.branches.findIndex(b => b.id === firstBranchId)
          : 0;

        return {
          ...s,
          currentPartIndex: partIndex,
          chatTree: { ...s.chatTree, activeBranchIndex: idx >= 0 ? idx : 0 }
        };
      });
    },

    deletePart(partIndex: number): void {
      update(s => {
        if (partIndex <= 0 || partIndex >= s.chatParts.length) return s;

        const part = s.chatParts[partIndex];
        const toRemove = new Set(part.branchIds);

        const branches = s.chatTree.branches.filter(b => !toRemove.has(b.id));
        const chatParts = s.chatParts.filter((_, i) => i !== partIndex);

        const nextPartIndex = Math.max(0, partIndex - 1);
        const nextPart = chatParts[nextPartIndex];
        const firstId = nextPart?.branchIds?.[0];
        const activeBranchIndex = firstId
          ? Math.max(0, branches.findIndex(b => b.id === firstId))
          : 0;

        return {
          ...s,
          chatParts,
          currentPartIndex: nextPartIndex,
          chatTree: { branches, activeBranchIndex }
        };
      });
      
      triggerAutoSave();
    },

    updatePreviousPartSummary(summary: string): void {
      update(s => {
        if (s.currentPartIndex <= 0) return s;

        const idx = s.currentPartIndex - 1;
        const chatParts = s.chatParts.map((p, i) => (i === idx ? { ...p, summary } : p));

        const updatedParts = chatParts.map((p, i) => {
          if (i <= idx) return p;
          const newPrevSummaries = p.previousSummaries.map(ps =>
            ps.partName === chatParts[idx].name ? { ...ps, summary } : ps
          );
          return { ...p, previousSummaries: newPrevSummaries };
        });

        return { ...s, chatParts: updatedParts };
      });
      
      triggerAutoSave();
    },

    createNewPartFromSummary(summary: string, basePrompt: string): void {
      update(s => {
        const now = nowIso();
        const currentPart = s.chatParts[s.currentPartIndex];
        if (!currentPart) return s;

        const partsClosed = s.chatParts.map((p, idx) =>
          idx === s.currentPartIndex ? { ...p, summary } : p
        );

        const max = 5;
        const start = Math.max(0, s.currentPartIndex - max);
        const accumulated = partsClosed
          .slice(start, s.currentPartIndex + 1)
          .filter(p => p.summary)
          .map(p => ({ partName: p.name, summary: p.summary }));

        const newPartNumber = partsClosed.length + 1;
        const newPart: ChatPart = {
          id: `part_${newPartNumber}`,
          partNumber: newPartNumber,
          name: `Часть ${newPartNumber}`,
          summary: '',
          previousSummaries: accumulated,
          branchIds: [],
          createdAt: now
        };

        let summarySection = '';
        if (accumulated.length) {
          summarySection =
            'Предыдущая история (краткий пересказ):\n' +
            accumulated.map(x => `${x.partName}: ${x.summary}`).join('\n');
        }

        const systemPrompt = buildFullSystemPrompt(basePrompt, s.generatedScript, summarySection);

        const newBranchId = bid();
        const newBranch: Branch = {
          id: newBranchId,
          name: `Ветвь ${s.chatTree.branches.length + 1}`,
          createdAt: now,
          partId: newPart.id,
          messages: [{ id: mid(), role: 'system', content: systemPrompt, createdAt: now }]
        };

        newPart.branchIds.push(newBranchId);
        const branches = [...s.chatTree.branches, newBranch];

        return {
          ...s,
          chatParts: [...partsClosed, newPart],
          currentPartIndex: partsClosed.length,
          chatTree: { branches, activeBranchIndex: branches.length - 1 }
        };
      });
      
      triggerAutoSave();
    },

    // ------------------------------------------------------------------------
    // РАБОТА С КАРТОЙ (MAP DATA)
    // ------------------------------------------------------------------------

    setMapData(data: any): void {
      update(s => ({ ...s, mapData: data }));
      triggerAutoSave();
    }
  };
}

// ================================================================================
// ЭКСПОРТ
// ================================================================================

export const teamChatStore = createTeamChatStore();