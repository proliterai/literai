<!-- src/lib/components/modals/BackupModal.svelte -->
<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { getDB } from '$lib/db/db';

  let processing = $state(false);
  let status = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  let fileInput = $state<HTMLInputElement>();

  // Экспорт полного слепка
  async function handleBackupSave() {
    processing = true;
    status = { type: 'info', message: 'Сбор данных для бэкапа...' };
    
    try {
      const db = getDB();
      
      // Читаем все таблицы из Dexie
      const catalog_items = await db.catalog_items.toArray();
      const settings = await db.settings.toArray();
      const providers = await db.providers.toArray();
      const sessions = await db.sessions.toArray();

      // Читаем весь LocalStorage
      const lsData: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          lsData[key] = localStorage.getItem(key) || '';
        }
      }

      // Формируем финальный объект
      const backupData = {
        type: 'literai_full_snapshot',
        version: '1.0',
        timestamp: new Date().toISOString(),
        database: {
          catalog_items,
          settings,
          providers,
          sessions
        },
        localStorage: lsData
      };

      // Скачиваем файл
      const dateStr = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `literai_snapshot_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      status = { type: 'success', message: 'Бэкап успешно сохранен!' };
    } catch (error: any) {
      status = { type: 'error', message: `Ошибка создания бэкапа: ${error.message}` };
    } finally {
      processing = false;
    }
  }

  // Восстановление из слепка
  async function handleBackupRestore(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!confirm('ВНИМАНИЕ! Текущие данные будут полностью УДАЛЕНЫ и заменены данными из бэкапа. Продолжить?')) {
      target.value = '';
      return;
    }

    processing = true;
    status = { type: 'info', message: 'Восстановление данных...' };

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (backupData.type !== 'literai_full_snapshot') {
        throw new Error('Неверный формат файла бэкапа.');
      }

      const db = getDB();

      // Очищаем и перезаписываем БД в одной транзакции
      await db.transaction('rw', db.catalog_items, db.settings, db.providers, db.sessions, async () => {
        await db.catalog_items.clear();
        await db.settings.clear();
        await db.providers.clear();
        await db.sessions.clear();

        if (backupData.database.catalog_items?.length) await db.catalog_items.bulkPut(backupData.database.catalog_items);
        if (backupData.database.settings?.length) await db.settings.bulkPut(backupData.database.settings);
        if (backupData.database.providers?.length) await db.providers.bulkPut(backupData.database.providers);
        if (backupData.database.sessions?.length) await db.sessions.bulkPut(backupData.database.sessions);
      });

      // Восстанавливаем LocalStorage
      localStorage.clear();
      if (backupData.localStorage) {
        for (const [key, value] of Object.entries(backupData.localStorage)) {
          localStorage.setItem(key, value as string);
        }
      }

      status = { type: 'success', message: 'Успешно! Перезагрузка...' };
      
      // Перезагружаем приложение, чтобы все сторы подхватили новые данные
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (error: any) {
      status = { type: 'error', message: `Ошибка восстановления: ${error.message}` };
      processing = false;
    }
    
    target.value = '';
  }
</script>

<div class="modal-panel backup-modal">
  <div class="modal-header">
    <h3><i class="fas fa-database"></i> Резервное копирование</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()} disabled={processing}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  
  <div class="tab-content-area">
    <div class="panel-placeholder" style="text-align: left; align-items: flex-start; margin-bottom: 20px;">
      <p><i class="fas fa-info-circle"></i> Бэкап (слепок) сохраняет <b>абсолютно всё</b>: историю чатов, созданных персонажей, настройки, ваши фоны, API-ключи провайдеров и лорбуки.</p>
      <p style="margin-top: 8px;">Вы можете перенести этот файл на другой компьютер или телефон, чтобы продолжить игру с того же места.</p>
    </div>

    <div class="backup-actions">
      <!-- Кнопка сохранения -->
      <button class="backup-btn save-btn" onclick={handleBackupSave} disabled={processing}>
        <i class="fas fa-download"></i>
        <div class="btn-text">
          <strong>Сохранить Бэкап</strong>
          <span>Скачать полный слепок данных</span>
        </div>
      </button>

      <!-- Кнопка восстановления -->
      <button class="backup-btn restore-btn" onclick={() => fileInput?.click()} disabled={processing}>
        <i class="fas fa-upload"></i>
        <div class="btn-text">
          <strong>Восстановить</strong>
          <span>Загрузить данные из файла</span>
        </div>
      </button>
      <input 
        bind:this={fileInput} 
        type="file" 
        accept=".json" 
        style="display:none" 
        onchange={handleBackupRestore} 
      />
    </div>

    {#if status}
      <div class="status-msg status-{status.type}">
        {#if status.type === 'info' || processing}
          <i class="fas fa-spinner fa-spin"></i>
        {:else if status.type === 'success'}
          <i class="fas fa-check-circle"></i>
        {:else}
          <i class="fas fa-exclamation-triangle"></i>
        {/if}
        <span>{status.message}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .backup-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .backup-btn {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    padding: var(--space-4);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: var(--bg-surface-2);
    color: var(--txt-primary);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .backup-btn i {
    font-size: 2rem;
    color: var(--txt-gold);
  }

  .backup-btn .btn-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .backup-btn .btn-text strong {
    font-size: var(--font-size-md);
  }

  .backup-btn .btn-text span {
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
  }

  .backup-btn:hover:not(:disabled) {
    background: var(--bg-surface-3);
    border-color: var(--accent-primary);
    transform: translateY(-2px);
  }

  .backup-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .restore-btn i {
    color: var(--state-info);
  }

  .status-msg {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .status-info { background: var(--state-info-bg); color: var(--state-info); border: 1px solid var(--state-info); }
  .status-success { background: var(--state-success-bg); color: var(--state-success); border: 1px solid var(--state-success); }
  .status-error { background: var(--state-error-bg); color: var(--state-error); border: 1px solid var(--state-error); }
</style>