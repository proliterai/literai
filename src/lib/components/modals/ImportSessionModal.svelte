<!-- ================================================================================
ФАЙЛ: src/lib/components/modals/ImportSessionModal.svelte
Описание: Модальное окно импорта сессии (Поддерживает JSON, Картинки и Шифрование)
================================================================================ -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { ui } from '$lib/ui/ui.store';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { parseImportedSession } from '$lib/domain/session-import/sessionImport.service';
  import type { ImportPreview } from '$lib/domain/session-import/sessionImport.types';
  import { catalogImportService } from '$lib/domain/catalog/catalog.import.service';
  import { decodeDataFromImage } from '$lib/utils/steganography';
  import { sessionEncryptionService } from '$lib/domain/session-io/sessionEncryption.service';

  const AVATAR_PLACEHOLDER = '/data/avatars/placeholder.png';

  let fileEl = $state<HTMLInputElement>();
  let preview = $state<ImportPreview | null>(null);
  let fileName = $state('');
  let loading = $state(false);

  let addedCharacters = $state<Set<string>>(new Set());
  let addedRoles = $state<Set<string>>(new Set());
  let sceneAdded = $state(false);

  // === Состояния для шифрования ===
  let needsPassword = $state(false);
  let passwordInput = $state('');
  let encryptedContainer = $state<any>(null);
  let decryptError = $state<string | null>(null);
  let isDecrypting = $state(false);

  function modeLabel(mode: string) {
    if (mode === 'hero') return 'Игра за героя';
    if (mode === 'team') return 'Игра за команду';
    return 'Ролевой чат';
  }

  function modeIcon(mode: string) {
    if (mode === 'hero') return 'fa-gamepad';
    if (mode === 'team') return 'fa-users';
    return 'fa-comments';
  }

  function resetStates() {
    preview = null;
    needsPassword = false;
    passwordInput = '';
    encryptedContainer = null;
    decryptError = null;
  }

  async function onPickFile(f: File) {
    // --- ДОБАВЛЕНО: Защита от зависания браузера (лимит 30 МБ) ---
    if (f.size > 30 * 1024 * 1024) {
      ui.notify('Файл слишком большой. Максимальный размер: 30 МБ', 'error');
      return;
    }
    // -------------------------------------------------------------

    loading = true;
    resetStates();
    fileName = f.name;

    try {
      let json: any;

      // Извлекаем данные из файла (Картинка или JSON)
      if (f.type.startsWith('image/')) {
        const hiddenData = await decodeDataFromImage(f);
        if (!hiddenData) {
          throw new Error('В этом изображении нет скрытой истории чата.');
        }
        json = hiddenData;
      } else {
        const text = await f.text();
        json = JSON.parse(text);
      }

      // Проверяем, зашифрован ли файл
      if (sessionEncryptionService.isEncryptedContainer(json)) {
        if (json.encryption.scheme === 'auto') {
          // Расшифровываем автоматически встроенным ключом
          const decrypted = await sessionEncryptionService.decryptAuto(json);
          processDecryptedPayload(decrypted);
        } else if (json.encryption.scheme === 'password') {
          // Требуется пароль пользователя
          encryptedContainer = json;
          needsPassword = true;
        }
      } else {
        // Обычный, не зашифрованный файл
        processDecryptedPayload(json);
      }

    } catch (e: any) {
      ui.notify('Ошибка файла: ' + (e.message || 'неверный формат'), 'error');
      fileName = '';
    } finally {
      loading = false;
    }
  }

  // Обработка пароля от пользователя
  async function handleDecryptSubmit() {
    if (!passwordInput || !encryptedContainer) return;
    
    isDecrypting = true;
    decryptError = null;

    try {
      const decrypted = await sessionEncryptionService.decryptWithPassword(encryptedContainer, passwordInput);
      processDecryptedPayload(decrypted);
      
      // Сбрасываем состояния пароля после успеха
      needsPassword = false;
      encryptedContainer = null;
      passwordInput = '';
    } catch (e: any) {
      decryptError = e.message;
    } finally {
      isDecrypting = false;
    }
  }

  // Обработка расшифрованного payload
  function processDecryptedPayload(json: any) {
    const res = parseImportedSession(json);
    if (!res.ok) {
      ui.notify(res.message, 'error');
      preview = null;
      return;
    }
    
    preview = res.preview;
    addedCharacters = new Set();
    addedRoles = new Set();
    sceneAdded = false;
  }

  async function addCharacter(c: any) {
    const res = await catalogImportService.addCharacter({
      name: c.name,
      description: c.description,
      avatar: c.avatar
    });
    if (res.status === 'added') {
      addedCharacters.add(c.key);
      addedCharacters = new Set(addedCharacters);
      ui.notify(`Персонаж «${c.name}» добавлен`, 'success');
    } else if (res.status === 'exists') {
      addedCharacters.add(c.key);
      addedCharacters = new Set(addedCharacters);
      ui.notify(`«${c.name}» уже есть в каталоге`, 'info');
    } else {
      ui.notify(res.message || 'Ошибка добавления персонажа', 'error');
    }
  }

  async function addRole(r: any) {
    const res = await catalogImportService.addRole({
      name: r.name,
      description: r.description
    });
    if (res.status === 'added') {
      addedRoles.add(r.key);
      addedRoles = new Set(addedRoles);
      ui.notify(`Роль «${r.name}» добавлена`, 'success');
    } else if (res.status === 'exists') {
      addedRoles.add(r.key);
      addedRoles = new Set(addedRoles);
      ui.notify(`«${r.name}» уже есть в каталоге`, 'info');
    } else {
      ui.notify(res.message || 'Ошибка добавления роли', 'error');
    }
  }

  async function addScene() {
    if (!preview?.scene) return;
    const res = await catalogImportService.addScene({
      name: preview.scene.name,
      description: preview.scene.description
    });
    if (res.status === 'added' || res.status === 'exists') {
      sceneAdded = true;
      ui.notify(
        res.status === 'added'
          ? `Сценарий «${preview.scene.name}» добавлен`
          : `«${preview.scene.name}» уже есть в каталоге`,
        res.status === 'added' ? 'success' : 'info'
      );
    } else {
      ui.notify(res.message || 'Ошибка добавления сценария', 'error');
    }
  }

  function newImportedSessionId(mode: string) {
    return `imported_${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async function launchChat() {
    if (!preview) return;
    try {
      const now = new Date().toISOString();
      const rawCopy = JSON.parse(JSON.stringify(preview.rawSession));

      const session = {
        ...rawCopy,
        id: newImportedSessionId(preview.mode),
        mode: preview.mode,
        createdAt: rawCopy.createdAt || now,
        updatedAt: now
      };

      await sessionsRepo.save(session as any);

      const path =
        preview.mode === 'hero'
          ? `/hero/chat/${session.id}`
          : preview.mode === 'team'
          ? `/team/chat/${session.id}`
          : `/roleplay/chat/${session.id}`;

      ui.closeModal();
      await goto(path);
    } catch (e: any) {
      console.error('[ImportSessionModal] Failed to launch chat:', e);
      ui.notify('Ошибка при запуске чата: ' + (e.message || 'неизвестная ошибка'), 'error');
    }
  }
</script>

<div class="modal-panel import-session-modal">
  <div class="modal-header">
    <h3><i class="fas fa-file-import"></i> Импорт истории</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>

  <div class="modal-body custom-scrollbar">
    <!-- Зона загрузки файла (Скрываем, если нужно ввести пароль, чтобы не отвлекать) -->
    {#if !needsPassword}
      <div class="upload-zone" class:has-file={!!fileName}>
        <div class="upload-content">
          <i class="fas fa-cloud-upload-alt upload-icon"></i>
          <div class="upload-text">
            {#if fileName}
              <span class="file-name">{fileName}</span>
              <span class="file-action">Нажмите, чтобы выбрать другой файл</span>
            {:else}
              <span class="file-name">Выберите JSON-файл или Картинку</span>
              <span class="file-action">Поддерживаются .json, .png, .jpg, .webp</span>
            {/if}
          </div>
        </div>
        <button class="upload-overlay-btn" onclick={() => fileEl?.click()} aria-label="Выбрать файл"></button>
        <input
          bind:this={fileEl}
          type="file"
          accept=".json,application/json,image/*"
          style="display:none"
          onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) onPickFile(f);
            e.currentTarget.value = '';
          }}
        />
      </div>
    {/if}

    <!-- Состояния загрузки, пароля и превью -->
    {#if loading}
      <div class="state-container">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Чтение и анализ файла...</p>
      </div>

    {:else if needsPassword}
      <div class="password-prompt-card">
        <div class="lock-icon"><i class="fas fa-lock"></i></div>
        <h4 class="prompt-title">Файл защищён паролем</h4>
        <p class="prompt-desc">Этот файл ({fileName}) был зашифрован при экспорте.</p>

        <div class="password-input-group">
          <input
            type="password"
            class="panel-input"
            placeholder="Введите пароль..."
            bind:value={passwordInput}
            onkeydown={(e) => e.key === 'Enter' && handleDecryptSubmit()}
            disabled={isDecrypting}
          />
          <button class="btn-primary" onclick={handleDecryptSubmit} disabled={isDecrypting || !passwordInput}>
            {#if isDecrypting}
              <i class="fas fa-spinner fa-spin"></i>
            {:else}
              <i class="fas fa-unlock"></i>
            {/if}
          </button>
        </div>
        
        {#if decryptError}
          <div class="decrypt-error"><i class="fas fa-exclamation-triangle"></i> {decryptError}</div>
        {/if}
        
        <button class="btn-secondary cancel-pwd-btn" onclick={() => fileEl?.click()}>
          Выбрать другой файл
        </button>
      </div>

    {:else if !preview}
      <div class="state-container empty">
        <i class="fas fa-file-archive"></i>
        <p>Здесь появится информация о персонажах и мире после выбора файла.</p>
      </div>

    {:else}
      <div class="import-preview">
        <!-- Мета информация -->
        <div class="preview-meta">
          <div class="meta-title">
            <span class="label">Название:</span>
            <span class="value">{preview.title}</span>
          </div>
          <div class="meta-mode">
            <span class="mode-badge">
              <i class="fas {modeIcon(preview.mode)}"></i> {modeLabel(preview.mode)}
            </span>
          </div>
        </div>

        <!-- Раздел: Персонажи -->
        {#if preview.characters.length > 0}
          <div class="preview-section">
            <h4 class="section-heading"><i class="fas fa-users"></i> Персонажи</h4>
            <div class="cards-grid">
              {#each preview.characters as c (c.key)}
                <div class="import-card">
                  <div class="card-header">
                    <img
                      class="card-avatar"
                      src={c.avatar || AVATAR_PLACEHOLDER}
                      alt={c.name}
                      onerror={(e) => ((e.currentTarget as HTMLImageElement).src = AVATAR_PLACEHOLDER)}
                    />
                    <div class="card-title" title={c.name}>{c.name}</div>
                  </div>
                  <div class="card-body custom-scrollbar">
                    {c.description || 'Описание отсутствует.'}
                  </div>
                  <div class="card-footer">
                    <button
                      class="btn-secondary btn-sm w-full"
                      disabled={addedCharacters.has(c.key)}
                      onclick={() => addCharacter(c)}
                    >
                      {#if addedCharacters.has(c.key)}
                        <i class="fas fa-check"></i> Добавлено
                      {:else}
                        <i class="fas fa-plus"></i> В каталог
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Раздел: Роли -->
        {#if preview.roles.length > 0}
          <div class="preview-section">
            <h4 class="section-heading"><i class="fas fa-briefcase"></i> Роли</h4>
            <div class="cards-grid">
              {#each preview.roles as r (r.key)}
                <div class="import-card text-only">
                  <div class="card-header">
                    <div class="card-title" title={r.name}>{r.name}</div>
                  </div>
                  <div class="card-body custom-scrollbar">
                    {r.description || 'Описание отсутствует.'}
                  </div>
                  <div class="card-footer">
                    <button
                      class="btn-secondary btn-sm w-full"
                      disabled={addedRoles.has(r.key)}
                      onclick={() => addRole(r)}
                    >
                      {#if addedRoles.has(r.key)}
                        <i class="fas fa-check"></i> Добавлено
                      {:else}
                        <i class="fas fa-plus"></i> В каталог
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Раздел: Сценарий -->
        {#if preview.scene}
          <div class="preview-section">
            <h4 class="section-heading"><i class="fas fa-globe"></i> Сценарий и мир</h4>
            <div class="import-card text-only full-width">
              <div class="card-header">
                <div class="card-title" title={preview.scene.name}>{preview.scene.name}</div>
              </div>
              <div class="card-body custom-scrollbar large-scroll">
                {preview.scene.description || 'Описание отсутствует.'}
              </div>
              <div class="card-footer">
                <button
                  class="btn-secondary btn-sm"
                  disabled={sceneAdded}
                  onclick={addScene}
                >
                  {#if sceneAdded}
                    <i class="fas fa-check"></i> Добавлено
                  {:else}
                    <i class="fas fa-plus"></i> Сохранить в каталог
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="modal-footer">
    <button class="btn-secondary" onclick={() => ui.closeModal()}>Отмена</button>
    <button class="btn-primary" disabled={!preview} onclick={launchChat}>
      <i class="fas fa-play"></i> Запустить историю
    </button>
  </div>
</div>

<style>
  /* ============================================
     ОСНОВНОЙ КОНТЕЙНЕР
     ============================================ */
  .import-session-modal {
    max-width: 800px;
    width: 95%;
    display: flex;
    flex-direction: column;
    max-height: 90vh; 
  }

  .modal-body {
    padding: var(--space-4);
    overflow-y: auto; 
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .modal-footer {
    padding: var(--space-4);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--glass-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  /* ============================================
     ЗОНА ЗАГРУЗКИ ФАЙЛА
     ============================================ */
  .upload-zone {
    position: relative;
    border: 2px dashed var(--glass-border);
    border-radius: var(--radius-lg);
    background: var(--bg-surface-2);
    transition: all 0.2s ease;
    overflow: hidden;
  }

  .upload-zone:hover {
    border-color: var(--txt-gold);
    background: var(--bg-surface-3);
  }

  .upload-zone.has-file {
    border-color: var(--state-success);
    background: rgba(46, 204, 113, 0.05);
  }

  .upload-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-5);
    text-align: left;
  }

  .upload-icon {
    font-size: 2.5rem;
    color: var(--txt-muted);
    transition: color 0.2s;
  }

  .upload-zone:hover .upload-icon {
    color: var(--txt-gold);
  }

  .upload-zone.has-file .upload-icon {
    color: var(--state-success);
  }

  .upload-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-name {
    font-size: var(--font-size-md);
    font-weight: var(--font-semibold);
    color: var(--txt-primary);
  }

  .file-action {
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
  }

  .upload-overlay-btn {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
  }

  /* ============================================
     БЛОК ПАРОЛЯ
     ============================================ */
  .password-prompt-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    text-align: center;
    box-shadow: var(--shadow-md);
  }

  .lock-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface-3);
    border-radius: 50%;
    margin-bottom: var(--space-3);
    color: var(--txt-gold);
    font-size: 2rem;
    border: 2px solid var(--glass-border);
  }

  .prompt-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    color: var(--txt-primary);
    margin-bottom: var(--space-1);
  }

  .prompt-desc {
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    margin-bottom: var(--space-5);
  }

  .password-input-group {
    display: flex;
    gap: var(--space-2);
    width: 100%;
    max-width: 320px;
  }

  .panel-input {
    flex: 1;
    padding: 10px 14px;
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    color: var(--txt-primary);
    font-family: inherit;
    font-size: var(--font-size-md);
    transition: border-color 0.2s;
  }

  .panel-input:focus {
    outline: none;
    border-color: var(--txt-gold);
  }

  .decrypt-error {
    margin-top: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: var(--radius-sm);
    color: var(--state-error);
    font-size: var(--font-size-sm);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cancel-pwd-btn {
    margin-top: var(--space-6);
    font-size: var(--font-size-sm);
  }

  /* ============================================
     СОСТОЯНИЯ (ПУСТО / ЗАГРУЗКА)
     ============================================ */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) 0;
    color: var(--txt-muted);
    text-align: center;
  }

  .state-container i {
    font-size: 3rem;
    margin-bottom: var(--space-3);
  }

  .state-container.empty i {
    opacity: 0.3;
  }

  /* ============================================
     ПРЕВЬЮ ИНФОРМАЦИИ
     ============================================ */
  .import-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .preview-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-surface-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .meta-title {
    display: flex;
    flex-direction: column;
  }

  .meta-title .label {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-title .value {
    font-size: var(--font-size-md);
    font-weight: var(--font-bold);
    color: var(--txt-primary);
  }

  .mode-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-3);
    background: var(--bg-surface-3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    color: var(--txt-gold);
    font-weight: var(--font-medium);
  }

  /* ============================================
     СЕКЦИИ И КАРТОЧКИ
     ============================================ */
  .preview-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-heading {
    font-size: var(--font-size-md);
    color: var(--txt-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--glass-border);
  }

  .section-heading i {
    color: var(--txt-gold);
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-3);
  }

  .import-card {
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .import-card:hover {
    border-color: var(--glass-border-hover);
  }

  .import-card.full-width {
    grid-column: 1 / -1;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-surface-3);
    border-bottom: 1px solid var(--glass-border);
  }

  .card-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--txt-gold);
    flex-shrink: 0;
  }

  .card-title {
    font-weight: var(--font-semibold);
    color: var(--txt-primary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .card-body {
    padding: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--txt-secondary);
    line-height: 1.5;
    max-height: 110px;
    overflow-y: auto;
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .card-body.large-scroll {
    max-height: 200px;
  }

  .card-footer {
    padding: var(--space-3);
    border-top: 1px solid var(--glass-border);
    background: var(--bg-surface-1);
    margin-top: auto;
  }

  .w-full {
    width: 100%;
    justify-content: center;
  }

  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--glass-border-hover); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--txt-gold); }

  @media (max-width: 600px) {
    .cards-grid { grid-template-columns: 1fr; }
    .preview-meta { flex-direction: column; align-items: flex-start; }
    .upload-content { flex-direction: column; text-align: center; padding: var(--space-4); }
    .card-body { max-height: 90px; }
    .card-body.large-scroll { max-height: 150px; }
    .modal-footer { flex-direction: column-reverse; }
    .modal-footer button { width: 100%; justify-content: center; }
  }
</style>