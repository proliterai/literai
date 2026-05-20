// ================================================================================
// ФАЙЛ: src/lib/domain/memorybook/memorybook.store.ts
// Описание: Хранилище базы знаний (Меморибук) с поддержкой ИИ-анализа и векторного поиска
// ================================================================================

import { writable, get } from 'svelte/store';
import { ui } from '$lib/ui/ui.store';
import { providersRepo } from '$lib/db/repositories/providers.repo';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { SETTINGS_KEYS } from '$lib/domain/settings/settings.keys';
import { loggingStore } from '$lib/domain/logging/logging.store';
import { embeddingService, cosineSimilarity } from '$lib/domain/lorebook/embedding.service';
import type { MemoryBookState, MemoryBlock, UserNote, MemoryCategory } from './memorybook.types';

const initialState: MemoryBookState = {
  userNotes: [],
  blocks: [],
  isUpdating: false,
  lastUpdated: null,
  isVectorizing: false,
  vectorizeProgress: { current: 0, total: 0 }
};

function mid() {
  return `mb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Промпт для ИИ-аналитика
const UPDATE_PROMPT = `Ты — аналитик ролевой истории (Memory Book). Проанализируй историю чата и обнови базу знаний.
Отвечай СТРОГО в формате JSON.

КАТЕГОРИИ: characters, locations, quests, inventory, relationships, lore, timeline, hooks.

ПРАВИЛА:
1. Возвращай массив объектов в формате:
{
  "blocks": [
    { "category": "characters", "title": "Имя", "content": "Роль: ...\\nХарактер: ...\\nСтатус: ..." }
  ]
}
2. Добавляй новые блоки, если появились новые сущности.
3. Обновляй контент существующих, если их статус изменился (сохраняй их оригинальные title для перезаписи).
4. Описывай ёмко, без воды.
5. Фиксируй только то, что явно произошло в тексте.`;

export function createMemoryBookStore() {
  const store = writable<MemoryBookState>(initialState);
  const { subscribe, update, set } = store;

  // Динамически получаем историю из активного чата (чтобы не было циклических зависимостей)
  async function gatherHistory(depth: number = 30): Promise<string> {
    let history = '';
    try {
      const { chatStore } = await import('$lib/domain/chat/chat.store');
      if (chatStore.isSessionActive()) {
        const s = get(chatStore);
        const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
        if (branch) history = branch.messages.filter(m => m.role !== 'system').slice(-depth).map(m => `${m.role}: ${m.content}`).join('\n');
        return history;
      }
      
      const { heroChatStore } = await import('$lib/domain/hero-chat/heroChat.store');
      if (heroChatStore.isSessionActive()) {
        const s = get(heroChatStore);
        const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
        if (branch) history = branch.messages.filter(m => m.role !== 'system').slice(-depth).map(m => `${m.role}: ${m.content}`).join('\n');
        return history;
      }

      const { teamChatStore } = await import('$lib/domain/team-chat/teamChat.store');
      if (teamChatStore.isSessionActive()) {
        const s = get(teamChatStore);
        const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
        if (branch) history = branch.messages.filter(m => m.role !== 'system').slice(-depth).map(m => `${m.role}: ${m.content}`).join('\n');
        return history;
      }
    } catch (e) {
      console.warn("Failed to gather history for Memory Book", e);
    }
    return history;
  }

  // Обновление блоков через основную LLM-модель
  async function updateFromAI() {
    const s = get(store);
    if (s.isUpdating) return;
    
    update(state => ({ ...state, isUpdating: true }));

    try {
      const provider = await providersRepo.getActive();
      if (!provider) throw new Error('Нет активного провайдера ИИ');

      const history = await gatherHistory(50); // Берём последние 50 сообщений
      if (!history.trim()) throw new Error('История пуста');

      // Формируем текущие размороженные блоки, чтобы ИИ знал, что обновлять
      const activeBlocksJSON = JSON.stringify(s.blocks.filter(b => !b.isFrozen).map(b => ({
        category: b.category, title: b.title, content: b.content
      })));

      const messages = [
        { role: 'system', content: UPDATE_PROMPT },
        { role: 'user', content: `ТЕКУЩЕЕ СОСТОЯНИЕ БАЗЫ:\n${activeBlocksJSON}\n\nИСТОРИЯ ДЛЯ АНАЛИЗА:\n${history}` }
      ];

      const gen = get(settingsStore.generation);

      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: 0.3, // Низкая температура для аналитики
          max_tokens: gen.max_tokens,
          response_format: { type: "json_object" }, // Запрашиваем JSON
          stream: false
        })
      });

      if (!resp.ok) throw new Error(`Ошибка API: ${await resp.text()}`);
      
      const data = await resp.json();
      let content = data.choices?.[0]?.message?.content || '';
      
      // Очистка от markdown
      content = content.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      const parsed = JSON.parse(content);

      if (!parsed.blocks || !Array.isArray(parsed.blocks)) throw new Error('Неверный формат ответа от ИИ');

      update(state => {
        let newBlocks = [...state.blocks];
        
        // Сбрасываем старые флаги UI
        newBlocks = newBlocks.map(b => ({ ...b, isNew: false, isChanged: false }));

        parsed.blocks.forEach((aiBlock: any) => {
          if (!aiBlock.title || !aiBlock.content) return;
          
          const existingIdx = newBlocks.findIndex(b => b.title.toLowerCase() === aiBlock.title.toLowerCase() && b.category === aiBlock.category);
          
          if (existingIdx !== -1) {
            // Обновляем существующий (если не заморожен)
            if (!newBlocks[existingIdx].isFrozen && newBlocks[existingIdx].content !== aiBlock.content) {
              newBlocks[existingIdx] = { 
                ...newBlocks[existingIdx], 
                content: aiBlock.content,
                isChanged: true 
              };
              // Инвалидируем вектор, т.к. контент изменился
              delete newBlocks[existingIdx].vector;
            }
          } else {
            // Добавляем новый
            newBlocks.push({
              id: mid(),
              category: aiBlock.category || 'lore',
              title: aiBlock.title,
              content: aiBlock.content,
              importance: 3,
              depth: '30',
              injection: 'bottom',
              isActive: true,
              isFrozen: false,
              isNew: true
            });
          }
        });

        return { ...state, blocks: newBlocks, isUpdating: false, lastUpdated: new Date().toISOString() };
      });
      
      ui.notify('Memory Book обновлён', 'success');

    } catch (e: any) {
      console.error(e);
      ui.notify(e.message || 'Ошибка обновления Memory Book', 'error');
      update(state => ({ ...state, isUpdating: false }));
    }
  }

  // МАССОВАЯ ВЕКТОРИЗАЦИЯ
  async function vectorizeAll() {
    const s = get(store);
    const toVectorize = s.blocks.filter(b => !b.vector && b.content.trim().length > 0);
    
    if (toVectorize.length === 0) {
        ui.notify("Все блоки памяти уже векторизованы", "success");
        return;
    }

    update(state => ({ ...state, isVectorizing: true, vectorizeProgress: { current: 0, total: toVectorize.length } }));

    try {
        const BATCH_SIZE = 20;
        let processed = 0;

        for (let i = 0; i < toVectorize.length; i += BATCH_SIZE) {
            const batch = toVectorize.slice(i, i + BATCH_SIZE);
            const texts = batch.map(b => `${b.category}: ${b.title}\n${b.content}`);
            
            const vectors = await embeddingService.getEmbeddings(texts);
            
            update(state => {
                const newBlocks = [...state.blocks];
                batch.forEach((block, idx) => {
                    const bIdx = newBlocks.findIndex(nb => nb.id === block.id);
                    if (bIdx !== -1) newBlocks[bIdx].vector = vectors[idx];
                });
                return { ...state, blocks: newBlocks, vectorizeProgress: { current: processed + batch.length, total: toVectorize.length } };
            });
            processed += batch.length;
        }
        ui.notify(`Успешно векторизовано записей: ${processed}`, "success");
    } catch (e: any) {
        ui.notify(`Ошибка векторизации: ${e.message}`, "error");
    } finally {
        update(state => ({ ...state, isVectorizing: false }));
    }
  }

  return {
    subscribe,
    updateFromAI,
    vectorizeAll,
    
    // Блоки ИИ
    addBlock(block: Partial<MemoryBlock>) {
      update(s => ({ ...s, blocks: [{
        id: mid(), category: 'lore', title: 'Новый блок', content: '', importance: 3, depth: '30', injection: 'bottom', isActive: true, isFrozen: false, ...block
      }, ...s.blocks] }));
    },
    updateBlock(id: string, patch: Partial<MemoryBlock>) {
      update(s => ({ ...s, blocks: s.blocks.map(b => {
        if (b.id === id) {
           const newBlock = { ...b, ...patch, isChanged: false, isNew: false };
           // Если изменился текст или заголовок - инвалидируем вектор, чтобы пересчитать его потом
           if (patch.content !== undefined || patch.title !== undefined) {
              delete newBlock.vector;
           }
           return newBlock;
        }
        return b;
      })}));
    },
    deleteBlock(id: string) {
      update(s => ({ ...s, blocks: s.blocks.filter(b => b.id !== id) }));
    },

    // Пользовательские заметки
    addUserNote() {
      update(s => ({ ...s, userNotes: [{ id: mid(), text: '', label: 'Заметка', alwaysInContext: true, priority: 'medium' }, ...s.userNotes] }));
    },
    updateUserNote(id: string, patch: Partial<UserNote>) {
      update(s => ({ ...s, userNotes: s.userNotes.map(n => n.id === id ? { ...n, ...patch } : n) }));
    },
    deleteUserNote(id: string) {
      update(s => ({ ...s, userNotes: s.userNotes.filter(n => n.id !== id) }));
    },

    // Экспорт для инжекта в промпт (Асинхронный с семантическим поиском)
    async getContextForMainChat(): Promise<string> {
      const s = get(store);
      let context = '';

      // 1. Собираем активные заметки (всегда в контексте)
      const activeNotes = s.userNotes.filter(n => n.alwaysInContext && n.text.trim());
      if (activeNotes.length > 0) {
        context += `\n[ЗАМЕТКИ ИГРОКА (СТРОГО УЧИТЫВАТЬ)]\n`;
        activeNotes.forEach(n => context += `- ${n.label}: ${n.text}\n`);
      }

      // 2. Собираем активные блоки памяти
      let activeBlocks = s.blocks.filter(b => b.isActive && b.content.trim());

      const settings = get(settingsStore).values;
      const useVector = settings[SETTINGS_KEYS.EMBEDDING_ENABLED];
      const threshold = settings[SETTINGS_KEYS.EMBEDDING_THRESHOLD] ?? 0.75;

      // 3. ВЕКТОРНЫЙ ПОИСК
      if (useVector && activeBlocks.length > 0) {
        const history = await gatherHistory(2); // Берем последние 2 сообщения для контекста поиска
        if (history.trim()) {
           try {
             const [queryVector] = await embeddingService.getEmbeddings([history]);
             const debugScores: any[] = [];
             const semanticMatches: any[] = [];

             activeBlocks = activeBlocks.filter(b => {
                if (!b.vector) {
                  debugScores.push({ title: b.title, status: "Нет вектора (нажмите 'Векторизовать')" });
                  return false; // Игнорируем невекторизованные, если включен семантический поиск
                }

                const sim = cosineSimilarity(queryVector, b.vector);
                debugScores.push({ title: b.title, score: sim.toFixed(3), passed: sim >= threshold ? "ДА ✅" : "НЕТ ❌" });
                
                if (sim >= threshold) {
                  // Повышаем важность найденных блоков для сортировки
                  b.importance += Math.round(sim * 3);
                  semanticMatches.push({ title: b.title, similarity: `${(sim * 100).toFixed(1)}%` });
                  return true;
                }
                return false;
             });

             // Отправляем информацию в модалку Логирования ИИ
             loggingStore.logResponse({
                response: { 
                  event: "MemoryBook: Векторный поиск", 
                  threshold_used: threshold, 
                  matches_found: semanticMatches.length, 
                  scores: debugScores 
                },
                duration: 0
             });
           } catch(e) {
             console.error("MemoryBook vector search failed", e);
             // Fallback: если API эмбеддингов упало (или нет интернета), отправляем всё, 
             // так как иначе ИИ потеряет память.
           }
        }
      }

      // 4. Сортировка по важности (с учетом буста от векторного поиска)
      activeBlocks.sort((a, b) => b.importance - a.importance);

      if (activeBlocks.length > 0) {
        context += `\n[ПАМЯТЬ ИСТОРИИ (MEMORY BOOK)]\n`;
        activeBlocks.forEach(b => context += `[${b.title}]: ${b.content}\n`);
      }

      return context ? `\n${context}\n` : '';
    },

    // Сериализация для БД (SessionRow)
    exportData() {
      const s = get(store);
      // Убираем временные флаги isNew/isChanged при сохранении в базу
      const cleanBlocks = s.blocks.map(({ isNew, isChanged, ...rest }) => rest);
      return { userNotes: s.userNotes, blocks: cleanBlocks, lastUpdated: s.lastUpdated };
    },

    importData(data: any) {
      if (data) {
        set({ 
          userNotes: data.userNotes || [], 
          blocks: data.blocks || [], 
          isUpdating: false, 
          lastUpdated: data.lastUpdated || null,
          isVectorizing: false,
          vectorizeProgress: { current: 0, total: 0 }
        });
      } else {
        set(initialState);
      }
    }
  };
}

export const memoryBookStore = createMemoryBookStore();