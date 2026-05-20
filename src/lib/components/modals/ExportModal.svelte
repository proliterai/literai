<!-- ================================================================================
ФАЙЛ: src/lib/components/modals/ExportModal.svelte
Описание: Экспорт чата с поддержкой шифрования и стеганографии
================================================================================ -->
<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { buildSessionRow } from '$lib/domain/chat/chat.sessionRow';
  import { page } from '$app/stores';
  import { sanitizeFilename, downloadJson } from '$lib/domain/session-io/sessionExport.service';
  import { encodeDataToImage } from '$lib/utils/steganography';
  import { sessionEncryptionService } from '$lib/domain/session-io/sessionEncryption.service';

  let exporting = $state(false);
  let imageInputEl = $state<HTMLInputElement>();
  let exportStatus = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Состояния для шифрования
  let encryptionMode = $state<'none' | 'auto' | 'password'>('none');
  let password = $state('');
  let showPassword = $state(false);

  const isChatRoute = $derived(
    $page.url.pathname.startsWith('/roleplay/chat/') || 
    $page.url.pathname.startsWith('/chat/')
  );

  // Подготовка сырых данных для экспорта
  function getExportPayload() {
    const chatData = buildSessionRow();
    return {
      type: 'chat_export',
      mode: 'roleplay',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      session: chatData
    };
  }

  function getBaseFilename(chatData: any) {
    const uName = sanitizeFilename(chatData.selectedItems?.userCharacter?.name || 'user');
    const sName = sanitizeFilename(chatData.selectedItems?.systemCharacter?.name || 'system');
    const sceneName = sanitizeFilename(chatData.selectedItems?.scene?.name || 'scene');
    const dateStr = new Date().toISOString().slice(0, 10);
    return `literai_roleplay_${uName}_${sName}_${sceneName}_${dateStr}`;
  }

  // Применяем выбранное шифрование к payload
  async function processPayload(rawPayload: any) {
    if (encryptionMode === 'auto') {
      return await sessionEncryptionService.encryptAuto(rawPayload);
    } 
    if (encryptionMode === 'password') {
      if (!password.trim()) throw new Error('Введите пароль для шифрования');
      if (password.length < 4) throw new Error('Пароль должен содержать минимум 4 символа');
      return await sessionEncryptionService.encryptWithPassword(rawPayload, password);
    }
    return rawPayload; // 'none'
  }

  // Обычный экспорт в JSON
  async function exportChat() {
    if (!isChatRoute) return;
    exporting = true;
    exportStatus = null;
    try {
      const rawPayload = getExportPayload();
      const filenameBase = getBaseFilename(rawPayload.session);
      
      const finalPayload = await processPayload(rawPayload);
      
      downloadJson(finalPayload, `${filenameBase}.json`);
      exportStatus = { type: 'success', message: 'Чат успешно экспортирован!' };
    } catch (e: any) {
      exportStatus = { type: 'error', message: e.message || 'Ошибка экспорта чата' };
    } finally {
      exporting = false;
    }
  }

  // Экспорт в картинку
  async function handleImageSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    exporting = true;
    exportStatus = null;
    try {
      const rawPayload = getExportPayload();
      const filenameBase = getBaseFilename(rawPayload.session);
      
      const finalPayload = await processPayload(rawPayload);
      
      const newBlob = await encodeDataToImage(file, finalPayload);
      
      // Скачиваем картинку
      const url = URL.createObjectURL(newBlob);
      const a = document.createElement('a');
      a.href = url;
      // Сохраняем оригинальное расширение картинки
      const ext = file.name.split('.').pop() || 'png';
      a.download = `${filenameBase}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      exportStatus = { type: 'success', message: 'Чат успешно вшит в картинку!' };
    } catch (err: any) {
      exportStatus = { type: 'error', message: err.message || 'Ошибка при вшивании в картинку' };
    } finally {
      exporting = false;
      if (imageInputEl) imageInputEl.value = ''; // очищаем инпут
    }
  }
</script>

<div class="modal-box export-modal">
  <button class="modal-close" aria-label="Закрыть" onclick={() => ui.closeModal()}>
    <i class="fas fa-times"></i>
  </button>

  <h2><i class="fas fa-file-export"></i> Экспорт чата</h2>

  {#if isChatRoute}
    <!-- БЛОК НАСТРОЕК ШИФРОВАНИЯ -->
    <div class="encryption-section">
      <h4 class="encryption-title"><i class="fas fa-shield-alt"></i> Защита файла</h4>
      
      <div class="encryption-options">
        <label class="enc-radio">
          <input type="radio" bind:group={encryptionMode} value="none" />
          <span>Без защиты</span>
        </label>
        <label class="enc-radio">
          <input type="radio" bind:group={encryptionMode} value="auto" />
          <span>Скрыть (Авто-ключ)</span>
        </label>
        <label class="enc-radio">
          <input type="radio" bind:group={encryptionMode} value="password" />
          <span>Защитить паролем</span>
        </label>
      </div>

      {#if encryptionMode === 'auto'}
        <div class="enc-hint info">
          <i class="fas fa-info-circle"></i> Файл будет зашифрован, но ключ сохранится внутри. Это скроет текст от прямого прочтения в блокноте, но приложение откроет его автоматически.
        </div>
      {/if}

      {#if encryptionMode === 'password'}
        <div class="password-input-wrapper">
          <input 
            type={showPassword ? "text" : "password"} 
            class="panel-input" 
            placeholder="Придумайте пароль (от 4 символов)" 
            bind:value={password}
            disabled={exporting}
          />
          <button 
            type="button" 
            class="btn-icon show-pwd-btn" 
            onclick={() => showPassword = !showPassword}
            tabindex="-1"
          >
            <i class="fas fa-eye{showPassword ? '-slash' : ''}"></i>
          </button>
        </div>
        <div class="enc-hint warning">
          <i class="fas fa-exclamation-triangle"></i> Внимание: мы не сохраняем пароль. Если вы его забудете, файл невозможно будет восстановить!
        </div>
      {/if}
    </div>

    <!-- БЛОК ЭКСПОРТА JSON -->
    <div class="export-section">
      <div class="export-section-header">
        <div class="export-section-icon"><i class="fas fa-file-code"></i></div>
        <div>
          <div class="export-section-title">Файл сохранения</div>
          <div class="export-section-desc">Скачать историю в формате JSON</div>
        </div>
      </div>
      <div class="export-buttons">
        <button class="export-btn export-btn-primary" onclick={exportChat} disabled={exporting}>
          <i class="fas fa-download"></i> Скачать файл
        </button>
      </div>
    </div>

    <!-- БЛОК ЭКСПОРТА В КАРТИНКУ -->
    <div class="export-section">
      <div class="export-section-header">
        <div class="export-section-icon"><i class="fas fa-image"></i></div>
        <div>
          <div class="export-section-title">Вшить в картинку</div>
          <div class="export-section-desc">Спрятать историю внутри изображения</div>
        </div>
      </div>
      <div class="export-buttons">
        <button class="export-btn export-btn-primary" onclick={() => imageInputEl?.click()} disabled={exporting}>
          <i class="fas fa-file-image"></i> Выбрать картинку
        </button>
        <input bind:this={imageInputEl} type="file" accept="image/png, image/jpeg, image/webp" style="display:none" onchange={handleImageSelect} />
      </div>
      <div class="export-warning" style="margin-top: 12px;">
        <i class="fas fa-info-circle"></i>
        <span>Внимание: пересылайте картинки в мессенджерах (Telegram, VK) <b>как файл</b> (без сжатия), иначе данные могут стереться.</span>
      </div>
    </div>
  {:else}
    <div class="export-warning">
      <i class="fas fa-exclamation-triangle"></i>
      <span>Для экспорта чата откройте нужную историю.</span>
    </div>
  {/if}

  {#if exportStatus}
    <div class="export-status export-status-{exportStatus.type}">
      <i class="fas fa-{exportStatus.type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>{exportStatus.message}</span>
    </div>
  {/if}
</div>

<style>
  .export-status { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-top: 16px; }
  .export-status-success { background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; color: #2ecc71; }
  .export-status-error { background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; color: #e74c3c; }

  /* Стили для секции шифрования */
  .encryption-section {
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .encryption-title {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-md);
    color: var(--txt-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .encryption-title i {
    color: var(--txt-gold);
  }

  .encryption-options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .enc-radio {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    transition: color 0.2s;
  }

  .enc-radio:hover {
    color: var(--txt-primary);
  }

  .enc-radio input[type="radio"] {
    accent-color: var(--txt-gold);
    width: 16px;
    height: 16px;
  }

  .password-input-wrapper {
    position: relative;
    margin-bottom: var(--space-2);
  }

  .panel-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    padding-right: 40px;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    transition: border-color 0.2s;
  }

  .panel-input:focus {
    outline: none;
    border-color: var(--txt-gold);
  }

  .show-pwd-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--txt-muted);
    cursor: pointer;
    padding: 4px;
  }

  .show-pwd-btn:hover {
    color: var(--txt-primary);
  }

  .enc-hint {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    padding: 10px;
    border-radius: 6px;
  }

  .enc-hint i {
    margin-top: 2px;
  }

  .enc-hint.warning {
    background: rgba(231, 76, 60, 0.1);
    color: #e74c3c;
    border: 1px solid rgba(231, 76, 60, 0.2);
  }

  .enc-hint.info {
    background: rgba(52, 152, 219, 0.1);
    color: #3498db;
    border: 1px solid rgba(52, 152, 219, 0.2);
  }
</style>