// ================================================================================
// ФАЙЛ: src/lib/domain/session-io/sessionExport.service.ts
// Описание: Единый сервис для экспорта данных (сессий, бэкапов, каталогов)
// ================================================================================

/**
 * Очищает строку, оставляя только безопасные символы для имени файла.
 * Заменяет спецсимволы и пробелы на нижнее подчеркивание.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'unknown';
  return name
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

/**
 * Конвертирует JS-объект в JSON и вызывает скачивание файла в браузере.
 */
export function downloadJson(obj: any, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  
  // Добавляем временно в DOM для совместимости с некоторыми браузерами
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

/**
 * Общая функция экспорта сессии чата для любого режима.
 * 
 * @param mode Режим игры ('roleplay', 'hero', 'team')
 * @param sessionData Собранные данные сессии (результат buildSessionRow())
 * @param characterName Имя главного персонажа или команды для названия файла
 * @param sceneName Название сцены для названия файла
 */
export function exportSession(
  mode: 'roleplay' | 'hero' | 'team',
  sessionData: any,
  characterName: string,
  sceneName: string
): void {
  const data = {
    type: mode === 'roleplay' ? 'chat_export' : `${mode}_chat_export`, // Сохраняем 'chat_export' для совместимости старого roleplay
    mode: mode,
    version: '2.0',
    exportedAt: new Date().toISOString(),
    session: sessionData
  };
  
  const cName = sanitizeFilename(characterName || 'character');
  const sName = sanitizeFilename(sceneName || 'scene');
  const dateStr = new Date().toISOString().slice(0, 10);
  
  const filename = `literai_${mode}_${cName}_${sName}_${dateStr}.json`;

  downloadJson(data, filename);
}

/**
 * Общая функция экспорта полного бэкапа для конкретного режима.
 * 
 * @param mode Режим игры ('roleplay', 'hero', 'team')
 * @param backupData Объект со всеми данными (каталог, настройки, лорбук и т.д.)
 */
export function exportFullBackup(
  mode: 'roleplay' | 'hero' | 'team',
  backupData: any
): void {
  const data = {
    type: mode === 'roleplay' ? 'full_export' : `${mode}_full_export`,
    mode: mode,
    version: '2.0',
    exportedAt: new Date().toISOString(),
    ...backupData
  };
  
  const dateStr = new Date().toISOString().slice(0, 10);
  const prefix = mode === 'roleplay' ? 'full' : `${mode}_full`;
  const filename = `literai_${prefix}_backup_${dateStr}.json`;

  downloadJson(data, filename);
}