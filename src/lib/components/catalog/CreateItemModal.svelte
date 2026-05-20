<script lang="ts">
  import type { CatalogItemType } from '$lib/db/types';
  import { optimizeImage } from '$lib/utils/imageOptimizer';

  // Увеличиваем лимит до 5 МБ, так как тяжелые картинки мы теперь оптимизируем
  let { type, maxAvatarBytes = 5 * 1024 * 1024, onClose, onsubmitItem, onnotify }: {
    type: CatalogItemType;
    maxAvatarBytes?: number;
    onClose?: () => void;
    onsubmitItem?: (data: { name: string; description: string; tags: string[]; avatar?: string }) => void;
    onnotify?: (data: { message: string; type: 'info' | 'success' | 'warning' | 'error' }) => void;
  } = $props();

  const titleMap: Record<CatalogItemType, string> = { character: 'Новый персонаж', role: 'Новая роль', scene: 'Новая сцена' };

  let name = $state('');
  let desc = $state('');
  let tagsStr = $state('');
  let avatar = $state<string | undefined>();
  let isProcessingImage = $state(false); // Для индикации загрузки/сжатия

  async function onAvatarFile(file: File) {
    if (file.size > maxAvatarBytes) {
      onnotify?.({ message: `Файл слишком большой. Максимум ${Math.floor(maxAvatarBytes / 1024 / 1024)}MB`, type: 'error' });
      return;
    }
    
    isProcessingImage = true;
    try {
      // Используем умную оптимизацию: файлы > 1 МБ сжимаем до 1200px (HD)
      avatar = await optimizeImage(file, 1, 1200);
    } catch (e) {
      onnotify?.({ message: 'Ошибка при обработке изображения', type: 'error' });
    } finally {
      isProcessingImage = false;
    }
  }

  function submit() {
    if (!name.trim() || !desc.trim()) {
      onnotify?.({ message: 'Заполните имя и описание', type: 'error' });
      return;
    }
    if (isProcessingImage) {
      onnotify?.({ message: 'Дождитесь окончания загрузки изображения', type: 'warning' });
      return;
    }

    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    onsubmitItem?.({ name: name.trim(), description: desc.trim(), tags, avatar: type === 'character' ? avatar : undefined });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={(e) => { if (e.currentTarget === e.target) onClose?.(); }}>
  <div class="modal-box">
    <button class="modal-close" type="button" onclick={onClose}>&times;</button>
    <h2>{titleMap[type]}</h2>

    <form class="modal-form" onsubmit={(e) => { e.preventDefault(); submit(); }}>
      <div class="modal-field">
        <label>Название</label>
        <input type="text" bind:value={name} placeholder="Введите название" />
      </div>

      {#if type === 'character'}
        <div class="modal-field">
          <label>Аватар</label>
          <input type="file" accept="image/*" disabled={isProcessingImage} onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) onAvatarFile(f);
            e.currentTarget.value = '';
          }} />
          
          {#if isProcessingImage}
            <div class="avatar-processing">
              <i class="fas fa-spinner fa-spin"></i> Обработка изображения...
            </div>
          {:else if avatar}
            <img class="avatar-preview" src={avatar} alt="Preview" />
          {/if}
        </div>
      {/if}

      <div class="modal-field">
        <label>Описание</label>
        <textarea bind:value={desc} rows="5" placeholder="Опишите персонажа/роль/сцену..."></textarea>
      </div>

      <div class="modal-field">
        <label><i class="fas fa-tags"></i> Теги (через запятую)</label>
        <input type="text" bind:value={tagsStr} placeholder="Романтика, Драма, Фэнтези" />
      </div>

      <button type="submit" class="modal-submit-btn" disabled={isProcessingImage}>
        <i class="fas fa-check"></i> Создать
      </button>
    </form>
  </div>
</div>

<style>
  .avatar-processing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-surface-2);
    border: 1px dashed var(--glass-border);
    border-radius: var(--radius-sm);
    color: var(--txt-gold);
    font-size: var(--font-size-sm);
  }
</style>