<!-- ================================================================================
ФАЙЛ: src/lib/components/team-modals/TeamExportModal.svelte
Описание: Модальное окно экспорта для режима "Игра за команду" с поддержкой шифрования
================================================================================ -->
<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
  import { buildTeamSessionRow } from '$lib/domain/team-chat/teamChat.sessionRow';
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
  import { page } from '$app/stores';
  import { sanitizeFilename, downloadJson } from '$lib/domain/session-io/sessionExport.service';
  import { encodeDataToImage } from '$lib/utils/steganography';
  import { sessionEncryptionService } from '$lib/domain/session-io/sessionEncryption.service';

  let exporting = $state(false);
  let imageInputEl = $state<HTMLInputElement>();
  let exportStatus = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Новые состояния для шифрования
  let protectionMode = $state<'none' | 'auto' | 'password'>('none');
  let password = $state('');
  let showPassword = $state(false);

  const isChatRoute = $derived($page.url.pathname.startsWith('/team/chat'));

  function getExportPayload() {
    const chatData = buildTeamSessionRow();
    const privateData = privateChatStore.exportData();
    return {
      type: 'chat_export', // Для импорта используем единый тип
      mode: 'team',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      session: {
        ...chatData,
        privateChatsData: privateData
      }
    };
  }

  function getBaseFilename(chatData: any) {
    const teamChars = chatData.selectedItems?.teamCharacters || [];
    const firstNames = teamChars.slice(0, 3).map((c: any) => sanitizeFilename(c.name)).join('_');
    const teamNames = teamChars.length > 3 ? `${firstNames}_and_others` : firstNames;
    const sceneName = sanitizeFilename(chatData.selectedItems?.scene?.name || 'scene');
    const dateStr = new Date().toISOString().slice(0, 10);
    return `literai_teamplay_${teamNames}_${sceneName}_${dateStr}`;
  }

  // Валидация перед началом экспорта
  function validateBeforeExport(): boolean {
    if (protectionMode === 'password' && password.length < 4) {
      exportStatus = { type: 'error', message: 'Пароль должен содержать минимум 4 символа' };
      return false;
    }
    return true;
  }

  // Обработка Payload (шифрование, если требуется)
  async function processPayload(rawPayload: any) {
    if (protectionMode === 'none') {
      return rawPayload;
    } else if (protectionMode === 'auto') {
      return await sessionEncryptionService.encryptAuto(rawPayload);
    } else if (protectionMode === 'password') {
      return await sessionEncryptionService.encryptWithPassword(rawPayload, password);
    }
  }

  async function exportChat() {
    if (!isChatRoute || !validateBeforeExport()) return;
    
    exporting = true;
    exportStatus = null;
    
    try {
      const rawPayload = getExportPayload();
      const finalPayload = await processPayload(rawPayload);
      
      downloadJson(finalPayload, `${getBaseFilename(rawPayload.session)}.json`);
      exportStatus = { type: 'success', message: 'Командный чат успешно экспортирован!' };
    } catch (e: any) {
      exportStatus = { type: 'error', message: e.message || 'Ошибка экспорта' };
    } finally {
      exporting = false;
    }
  }

  function triggerImageSelect() {
    if (!isChatRoute || !validateBeforeExport()) return;
    imageInputEl?.click();
  }

  async function handleImageSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    exporting = true;
    exportStatus = null;
    
    try {
      const rawPayload = getExportPayload();
      const finalPayload = await processPayload(rawPayload);
      
      const newBlob = await encodeDataToImage(file, finalPayload);
      const url = URL.createObjectURL(newBlob);
      const a = document.createElement('a');
      a.href = url;
      const ext = file.name.split('.').pop() || 'png';
      a.download = `${getBaseFilename(rawPayload.session)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      exportStatus = { type: 'success', message: 'История команды успешно вшита в картинку!' };
    } catch (err: any) {
      exportStatus = { type: 'error', message: err.message || 'Ошибка при вшивании' };
    } finally {
      exporting = false;
      if (imageInputEl) imageInputEl.value = '';
    }
  }
</script>

<div class="modal-box export-modal">
  <button class="modal-close" onclick={() => ui.closeModal()}><i class="fas fa-times"></i></button>
  <h2><i class="fas fa-users"></i> Экспорт команды</h2>

  <!-- БЛОК НАСТРОЕК ШИФРОВАНИЯ -->
  <div class="export-section">
    <div class="export-section-header">
      <div class="export-section-icon"><i class="fas fa-shield-alt"></i></div>
      <div>
        <div class="export-section-title">Защита файла</div>
        <div class="export-section-desc">Выберите уровень безопасности экспорта</div>
      </div>
    </div>
    
    <div class="protection-options">
      <label class="radio-label">
        <input type="radio" bind:group={protectionMode} value="none" />
        <span>Без шифрования (Обычный файл)</span>
      </label>
      <label class="radio-label">
        <input type="radio" bind:group={protectionMode} value="auto" />
        <span>Зашифровать автоматически (Скрывает текст внутри JSON/Картинки)</span>
      </label>
      <label class="radio-label">
        <input type="radio" bind:group={protectionMode} value="password" />
        <span>Зашифровать паролем (Потребуется пароль при импорте)</span>
      </label>
    </div>

    {#if protectionMode === 'password'}
      <div class="password-input-wrap">
        <input 
          type={showPassword ? "text" : "password"} 
          bind:value={password} 
          placeholder="Придумайте пароль (мин. 4 символа)"
          class="panel-input"
          disabled={exporting}
        />
        <button class="btn-icon" onclick={() => showPassword = !showPassword} title="Показать/скрыть">
          <i class="fas fa-eye{showPassword ? '-slash' : ''}"></i>
        </button>
      </div>
      <div class="export-warning warning-text">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Пароль нигде не сохраняется. Восстановить файл без пароля будет <b>невозможно</b>.</span>
      </div>
    {/if}
  </div>

  <div class="export-section">
    <div class="export-section-header">
      <div class="export-section-icon"><i class="fas fa-file-code"></i></div>
      <div><div class="export-section-title">JSON файл</div><div class="export-section-desc">Классический файл сохранения</div></div>
    </div>
    <div class="export-buttons">
      <button class="export-btn export-btn-primary" onclick={exportChat} disabled={exporting || !isChatRoute}>
        {#if exporting}
          <i class="fas fa-spinner fa-spin"></i> Обработка...
        {:else}
          <i class="fas fa-download"></i> Скачать JSON
        {/if}
      </button>
    </div>
  </div>

  <div class="export-section">
    <div class="export-section-header">
      <div class="export-section-icon"><i class="fas fa-image"></i></div>
      <div><div class="export-section-title">Вшить в картинку</div><div class="export-section-desc">Спрятать историю в изображение</div></div>
    </div>
    <div class="export-buttons">
      <button class="export-btn export-btn-primary" onclick={triggerImageSelect} disabled={exporting || !isChatRoute}>
        {#if exporting}
          <i class="fas fa-spinner fa-spin"></i> Обработка...
        {:else}
          <i class="fas fa-file-image"></i> Выбрать картинку
        {/if}
      </button>
      <input bind:this={imageInputEl} type="file" accept="image/png, image/jpeg, image/webp" style="display:none" onchange={handleImageSelect} />
    </div>
    <div class="export-warning" style="margin-top: 12px;">
      <i class="fas fa-info-circle"></i>
      <span>При отправке в мессенджерах отправляйте <b>как документ/файл</b> (без сжатия).</span>
    </div>
  </div>

  {#if !isChatRoute}
    <div class="export-warning"><i class="fas fa-info-circle"></i><span>Откройте чат для экспорта.</span></div>
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

  .protection-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-surface-2);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--txt-primary);
  }

  .radio-label input[type="radio"] {
    accent-color: var(--txt-gold);
    width: 16px;
    height: 16px;
  }

  .password-input-wrap {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .panel-input {
    flex: 1;
    padding: 10px 12px;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
  }

  .panel-input:focus {
    outline: none;
    border-color: var(--txt-gold);
  }

  .btn-icon {
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    color: var(--txt-muted);
    cursor: pointer;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--bg-hover);
    color: var(--txt-gold);
  }

  .warning-text {
    margin-top: 8px;
    color: var(--state-error);
    background: rgba(231, 76, 60, 0.1);
    border-color: rgba(231, 76, 60, 0.3);
  }
</style>