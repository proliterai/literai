<!-- ================================================================================
ФАЙЛ: src/lib/components/story-catalog/StoryInfoModal.svelte
Описание: Модальное окно с подробной информацией о выбранной истории
================================================================================ -->
<script lang="ts">
  import type { StoryManifestItem } from '$lib/domain/story-catalog/storyCatalog.types';
  import { safeUrl } from '$lib/utils/url';

  type Props = {
    story: StoryManifestItem;
    isLoading?: boolean;
    onClose?: () => void;
    onLaunch?: (story: StoryManifestItem) => void;
  };

  let { story, isLoading = false, onClose, onLaunch }: Props = $props();

  let coverUrl = $derived(safeUrl(story.cover));

  const modeConfig = {
    roleplay: { icon: 'fa-comments', label: 'Ролевой чат', cssClass: 'mode-roleplay' },
    hero:     { icon: 'fas fa-gamepad',   label: 'Игра за героя', cssClass: 'mode-hero' },
    team:     { icon: 'fas fa-people-roof',    label: 'Команда',       cssClass: 'mode-team' }
  };

  let currentMode = $derived(modeConfig[story.mode]);
  let displayAuthor = $derived(story.author === 'official' ? 'LiterAI' : story.author);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={(e) => { if (e.currentTarget === e.target) onClose?.(); }}>
  <div class="modal-box story-modal-box">
    
    <button class="modal-close-btn" type="button" aria-label="Закрыть" onclick={onClose}>
      <i class="fas fa-times"></i>
    </button>

    <!-- Верхняя часть с обложкой -->
    <div class="story-hero">
      {#if coverUrl}
        <img class="story-hero-img" src={coverUrl} alt={story.title} />
      {:else}
        <div class="story-hero-placeholder">
          <i class="fas fa-image"></i>
        </div>
      {/if}
      <!-- Градиент для плавного перехода картинки в фон модалки -->
      <div class="story-hero-gradient"></div>
    </div>

    <!-- Основной контент -->
    <div class="story-content custom-scrollbar">
      
      <div class="story-header">
        <h2 class="story-title">{story.title}</h2>
        <div class="story-author">
  Автор: 
  {#if story.authorLink}
    <a href={story.authorLink} target="_blank" rel="noopener noreferrer" class="author-link" title="Перейти на страницу автора">
      {displayAuthor} <i class="fas fa-external-link-alt"></i>
    </a>
  {:else}
    <span>{displayAuthor}</span>
  {/if}
</div>
      </div>

      <!-- Бейджи -->
      <div class="story-badges">
        {#if story.featured}
          <span class="badge badge-featured">
            <i class="fas fa-star"></i> Выбор редакции
          </span>
        {/if}
        <span class="badge {currentMode.cssClass}">
          <i class="fas {currentMode.icon}"></i> {currentMode.label}
        </span>
      </div>

      <!-- Описание -->
      <div class="story-description">
        {story.description}
      </div>

      <!-- Жанры и теги -->
      <div class="story-meta-section">
        <h4 class="meta-title"><i class="fas fa-tags"></i> Жанры и теги</h4>
        <div class="meta-tags">
          {#each story.genres as genre (genre)}
            <span class="tag tag-genre">{genre}</span>
          {/each}
          {#each story.tags as tag (tag)}
            <span class="tag">#{tag}</span>
          {/each}
        </div>
      </div>

    </div>

    <!-- Футер с действиями -->
    <div class="modal-footer">
      <button class="btn-secondary" disabled={isLoading} onclick={onClose}>
        Отмена
      </button>
      <button class="btn-primary launch-btn" disabled={isLoading} onclick={() => onLaunch?.(story)}>
        {#if isLoading}
          <i class="fas fa-spinner fa-spin"></i> Подготовка сессии...
        {:else}
          <i class="fas fa-play"></i> Запустить
        {/if}
      </button>
    </div>

  </div>
</div>

<style>
  /* Переопределение стандартного modal-box для истории */
  .story-modal-box {
    padding: 0; /* Убираем стандартный паддинг, чтобы картинка была от края до края */
    max-width: 600px;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    background: var(--bg-surface-1);
    position: relative;
  }

  .modal-close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: all 0.2s;
  }

  .modal-close-btn:hover {
    background: var(--state-error-bg);
    border-color: var(--state-error);
    color: var(--state-error);
    transform: scale(1.1);
  }

  /* === HERO СЕКЦИЯ === */
  .story-hero {
    position: relative;
    width: 100%;
    height: 320px;
    flex-shrink: 0;
    background: var(--bg-surface-3);
  }

  .story-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .story-hero-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 4rem;
    color: var(--txt-muted);
    opacity: 0.3;
  }

  .story-hero-gradient {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100px;
    background: linear-gradient(to bottom, transparent, var(--bg-surface-1));
  }

  /* === КОНТЕНТ === */
  .story-content {
    padding: 0 var(--space-5) var(--space-4) var(--space-5);
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-top: -40px; /* Наезжаем на градиент картинки */
    position: relative;
    z-index: 2;
  }

  .story-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .story-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 800;
    color: var(--txt-primary);
    line-height: 1.2;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8); /* Читаемость на фоне картинки */
  }

  .story-author {
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
  }

  .story-author span {
    color: var(--txt-gold);
    font-weight: 500;
  }

  /* Бейджи */
  .story-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-featured {
    background: var(--p-gold-500);
    color: var(--p-velvet-900);
  }

  .mode-roleplay { background: rgba(52, 152, 219, 0.15); color: #3498db; border: 1px solid rgba(52, 152, 219, 0.4); }
  .mode-hero { background: rgba(155, 89, 182, 0.15); color: #9b59b6; border: 1px solid rgba(155, 89, 182, 0.4); }
  .mode-team { background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.4); }

  /* Описание */
  .story-description {
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    line-height: 1.6;
    white-space: pre-wrap; /* Сохраняем абзацы из JSON */
    background: var(--bg-surface-2);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
  }

  /* Жанры и теги */
  .story-meta-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .meta-title {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--txt-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .tag {
    font-size: 12px;
    color: var(--txt-muted);
    background: var(--bg-surface-3);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }

  .tag-genre {
    color: var(--txt-gold-light);
    border-color: rgba(196, 163, 90, 0.3);
    background: rgba(196, 163, 90, 0.1);
  }

  /* Футер */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .launch-btn {
    font-size: var(--font-size-md);
    padding: 8px 24px;
  }

  /* Кастомный скролл */
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--glass-border-hover); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--txt-gold); }

  .author-link {
    color: var(--txt-gold);
    font-weight: 600;
    text-decoration: none;
    transition: color 0.2s, text-shadow 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .author-link i {
    font-size: 10px;
    opacity: 0.7;
  }

  .author-link:hover {
    color: #fff;
    text-shadow: 0 0 8px var(--txt-gold);
  }
</style>