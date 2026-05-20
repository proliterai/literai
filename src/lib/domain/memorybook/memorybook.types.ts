// ================================================================================
// ФАЙЛ: src/lib/domain/memorybook/memorybook.types.ts
// Описание: Типы данных для базы знаний (Меморибук)
// ================================================================================

// Возможные категории для автоматического ИИ-анализа
export type MemoryCategory = 
  | 'characters' 
  | 'locations' 
  | 'quests' 
  | 'inventory' 
  | 'relationships' 
  | 'lore' 
  | 'timeline' 
  | 'hooks';

// Пользовательская заметка (жесткие правила от игрока)
export interface UserNote {
  id: string;
  text: string;
  label: string;
  alwaysInContext: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Автоматически генерируемый блок памяти (от ИИ)
export interface MemoryBlock {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  importance: number; // от 1 до 5
  depth: '10' | '30' | '100' | 'all'; // Глубина поиска (пока задел на будущее)
  injection: 'top' | 'bottom' | 'before_last'; // Позиция инжекта в промпт
  isActive: boolean; // Включен ли блок
  isFrozen: boolean; // Защита от изменения ИИ-аналитиком
  
  // Векторное представление текста для умного семантического поиска
  vector?: number[];
  
  // Временные UI-состояния (подсвечиваются в интерфейсе, но не сохраняются в БД)
  isNew?: boolean;
  isChanged?: boolean;
}

// Состояние Svelte-стора
export interface MemoryBookState {
  userNotes: UserNote[];
  blocks: MemoryBlock[];
  isUpdating: boolean; // Флаг генерации выжимки (LLM анализ)
  lastUpdated: string | null;
  
  // Состояния для процесса массовой векторизации
  isVectorizing: boolean;
  vectorizeProgress: { 
    current: number; 
    total: number; 
  };
}