<!-- ================================================================================
ФАЙЛ: src/lib/components/story-catalog/StoryCard.svelte
Описание: Карточка отдельной истории для каталога
================================================================================ -->
<script lang="ts">
  import type { StoryManifestItem } from '$lib/domain/story-catalog/storyCatalog.types';
  import { lazyImage } from '$lib/ui/lazyImage';
  import { safeUrl } from '$lib/utils/url';

  type Props = {
    story: StoryManifestItem;
    isLoading?: boolean;
    oninfo?: (story: StoryManifestItem) => void;
    onlaunch?: (story: StoryManifestItem) => void;
  };

  let { story, isLoading = false, oninfo, onlaunch }: Props = $props();

  let coverUrl = $derived(safeUrl(story.cover));

  // Конфигурация бейджей в зависимости от режима игры
  const modeConfig = {
    roleplay: { icon: 'fa-comments', label: 'Ролевой чат', cssClass: 'mode-roleplay' },
    hero:     { icon: 'fas fa-gamepad',   label: 'Игра за героя', cssClass: 'mode-hero' },
    team:     { icon: 'fas fa-people-roof',    label: 'Команда',       cssClass: 'mode-team' }
  };

  let currentMode = $derived(modeConfig[story.mode]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article class="story-card" onclick={() => oninfo?.(story)}>
  
  <!-- Обложка с бейджами -->
  <div class="card-cover-wrapper">
    {#if coverUrl}
      <img 
        class="card-cover" 
        src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        alt={story.title} 
        use:lazyImage={{ src: coverUrl }} 
      />
    {:else}
      <div class="card-cover-placeholder">
        <i class="fas fa-book-open"></i>
      </div>
    {/if}

    <div class="card-badges">
      {#if story.featured}
        <span class="badge badge-featured">
          <i class="fas fa-star"></i> Выбор редакции
        </span>
      {/if}
      <span class="badge {currentMode.cssClass}">
        <i class="fas {currentMode.icon}"></i> {currentMode.label}
      </span>
    </div>
  </div>

  <!-- Текстовое содержимое -->
  <div class="card-body">
    <h3 class="card-title">{story.title}</h3>
    <p class="card-desc">{story.description}</p>
    
    <div class="card-tags">
      {#each story.genres.slice(0, 2) as genre (genre)}
        <span class="tag tag-genre">{genre}</span>
      {/each}
      {#each story.tags.slice(0, 3) as tag (tag)}
        <span class="tag">#{tag}</span>
      {/each}
      {#if story.tags.length > 3}
        <span class="tag tag-more">+{story.tags.length - 3}</span>
      {/if}
    </div>
  </div>

  <!-- Футер с кнопками -->
  <div class="card-footer">
    <button 
      class="btn-secondary btn-sm info-btn" 
      title="Подробнее" 
      onclick={(e) => { e.stopPropagation(); oninfo?.(story); }}
    >
      <i class="fas fa-info-circle"></i> Инфо
    </button>
    <button 
      class="btn-primary btn-sm launch-btn" 
      disabled={isLoading} 
      onclick={(e) => { e.stopPropagation(); onlaunch?.(story); }}
    >
      {#if isLoading}
        <i class="fas fa-spinner fa-spin"></i> Запуск...
      {:else}
        <i class="fas fa-play"></i> Запустить
      {/if}
    </button>
  </div>
</article>

<style>
  .story-card {
    display: flex;
    flex-direction: column;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: pointer;
    height: 100%;
  }

  .story-card:hover {
    border-color: var(--accent-primary);
    transform: translateY(-4px);
    box-shadow: var(--shadow-md), var(--fx-glow-gold-subtle);
  }

  /* === ОБЛОЖКА === */
  .card-cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--bg-surface-3);
    border-bottom: 1px solid var(--glass-border);
    overflow: hidden;
  }

  .card-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .story-card:hover .card-cover {
    transform: scale(1.05);
  }

  .card-cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: var(--txt-muted);
    opacity: 0.5;
  }

  /* === БЕЙДЖИ === */
  .card-badges {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    z-index: 2;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  .badge-featured {
    background: var(--p-gold-500);
    color: var(--p-velvet-900);
  }

  .mode-roleplay {
    background: rgba(52, 152, 219, 0.85); /* Синий */
    color: #fff;
    border: 1px solid rgba(52, 152, 219, 1);
  }

  .mode-hero {
    background: rgba(155, 89, 182, 0.85); /* Фиолетовый */
    color: #fff;
    border: 1px solid rgba(155, 89, 182, 1);
  }

  .mode-team {
    background: rgba(46, 204, 113, 0.85); /* Зеленый */
    color: #fff;
    border: 1px solid rgba(46, 204, 113, 1);
  }

  /* === КОНТЕНТ === */
  .card-body {
    padding: var(--space-3);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-title {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--txt-primary);
    line-height: 1.2;
  }

  .card-desc {
    margin: 0;
    font-size: 13px;
    color: var(--txt-secondary);
    line-height: 1.5;
    /* Обрезка до 3 строк */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: auto;
    padding-top: var(--space-2);
  }

  .tag {
    font-size: 10px;
    color: var(--txt-muted);
    background: var(--bg-surface-2);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--glass-border);
    white-space: nowrap;
  }

  .tag-genre {
    color: var(--txt-gold-light);
    border-color: rgba(196, 163, 90, 0.3);
    background: rgba(196, 163, 90, 0.1);
  }

  /* === ФУТЕР === */
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-surface-2);
    border-top: 1px solid var(--glass-border);
  }

  .info-btn {
    padding: 4px 10px;
    font-size: 12px;
  }

  .launch-btn {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
  }
</style>