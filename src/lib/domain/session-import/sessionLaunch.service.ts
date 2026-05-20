import { goto } from '$app/navigation';
import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
import { ui } from '$lib/ui/ui.store';
import type { ImportPreview } from './sessionImport.types';

function generateNewId(mode: string): string {
  return `story_${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const sessionLaunchService = {
  /**
   * Запускает чат на основе шаблона (из каталога или импорта):
   * 1. Создает новый ID сессии
   * 2. Сохраняет сессию в локальную БД (Dexie) с сохранением ВСЕГО контекста шаблона
   * 3. Делает редирект на нужный роут чата
   */
  async launchFromPreview(preview: ImportPreview): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Делаем глубокую копию сырой сессии, чтобы не мутировать исходный объект (шаблон)
      const rawCopy = JSON.parse(JSON.stringify(preview.rawSession));

      // Формируем новый объект сессии
      const newSessionId = generateNewId(preview.mode);
      
      const sessionToSave = {
        ...rawCopy,
        id: newSessionId,
        mode: preview.mode,
        // Оставляем оригинальную дату создания для атмосферы, если есть, или ставим текущую
        createdAt: rawCopy.createdAt || now, 
        // Дата обновления всегда текущая, чтобы чат всплыл наверх в списке "Мои чаты"
        updatedAt: now 
      };

      // Сохраняем сессию в БД
      await sessionsRepo.save(sessionToSave as any);

      // Закрываем все открытые модальные окна
      ui.closeAll();

      // Определяем правильный путь в зависимости от режима
      let path = `/roleplay/chat/${newSessionId}`;
      if (preview.mode === 'hero') {
        path = `/hero/chat/${newSessionId}`;
      } else if (preview.mode === 'team') {
        path = `/team/chat/${newSessionId}`;
      }

      // Переходим в чат
      await goto(path);
      
    } catch (e: any) {
      console.error('[SessionLaunchService] Failed to launch session:', e);
      ui.notify('Ошибка при запуске истории: ' + (e.message || 'неизвестная ошибка'), 'error');
      throw e;
    }
  }
};