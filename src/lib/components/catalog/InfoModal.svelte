<script lang="ts">
  import type { CatalogItemRow } from '$lib/db/types';
  import { safeUrl } from '$lib/utils/url';

  let { item, onClose, onEdit }: { 
    item: CatalogItemRow; 
    onClose?: () => void; 
    onEdit?: () => void; 
  } = $props();

  let avatar = $derived(safeUrl(item?.avatar));
  
  // Состояние для полноэкранного просмотра картинки
  let isFullscreen = $state(false);
</script>

<!-- Основная модалка карточки -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={(e) => { if (e.currentTarget === e.target) onClose?.(); }}>
  <div class="modal-box character-info-box">
    
    <!-- Плавающие кнопки управления (увеличение, редактирование, закрытие) -->
    <div class="floating-actions">
      <!-- Кнопка увеличения (показываем только если есть картинка) -->
      {#if avatar}
        <button class="hero-btn zoom-btn" type="button" title="Открыть полное фото" onclick={() => isFullscreen = true}>
          <i class="fas fa-search-plus"></i>
        </button>
      {/if}

      {#if onEdit}
        <button class="hero-btn edit-btn" type="button" title="Редактировать" onclick={onEdit}>
          <i class="fas fa-pen"></i>
        </button>
      {/if}

      <button class="hero-btn close-btn" type="button" title="Закрыть" onclick={onClose}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Блок обложки (Аватар) -->
    <div class="info-hero">
      {#if avatar}
        <img 
          class="info-hero-img" 
          src={avatar} 
          alt={item?.name} 
          onerror={(e) => (e.currentTarget.style.display = 'none')} 
        />
      {:else}
        <div class="info-hero-placeholder">
          <!-- Иконка зависит от типа (персонаж, роль, сцена) -->
          <i class="fas {item.type === 'scene' ? 'fa-globe' : item.type === 'role' ? 'fa-briefcase' : 'fa-user'}"></i>
        </div>
      {/if}
      
      <!-- Градиентное затемнение для читаемости текста -->
      <div class="info-hero-gradient"></div>
      
      <!-- Текст поверх картинки -->
      <div class="info-hero-text">
        <h2 class="info-hero-title">{item?.name}</h2>
        
        {#if item?.tags?.length}
          <div class="info-hero-tags">
            {#each item.tags as t (t)}
              <span class="info-tag">{t}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Блок с описанием -->
    <div class="info-content custom-scrollbar">
      <div class="info-desc">{item?.description || 'Описание не задано'}</div>
    </div>

  </div>
</div>

<!-- ========================================== -->
<!-- LIGHTBOX: Полноэкранный просмотр картинки  -->
<!-- ========================================== -->
{#if isFullscreen && avatar}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="lightbox-overlay" onclick={() => isFullscreen = false}>
    <button class="lightbox-close" type="button" title="Закрыть фото">
      <i class="fas fa-times"></i>
    </button>
    <img 
      src={avatar} 
      alt={item?.name} 
      class="lightbox-img" 
      onclick={(e) => e.stopPropagation()} 
    />
  </div>
{/if}

<style>
  /* Переопределяем базовые отступы модалки, чтобы картинка была от края до края */
  .character-info-box {
    padding: 0;
    max-width: 500px;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    background: var(--bg-surface-1);
    position: relative;
  }

  /* Плавающие кнопки поверх картинки */
  .floating-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    display: flex;
    gap: 8px;
  }

  .hero-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1rem;
  }

  .hero-btn.edit-btn, .hero-btn.zoom-btn {
    font-size: 0.9rem;
  }

  .hero-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: var(--txt-gold);
    color: var(--txt-gold);
    transform: scale(1.05);
  }

  .hero-btn.close-btn:hover {
    border-color: var(--state-error);
    color: var(--state-error);
  }

  /* ============================
     HERO СЕКЦИЯ (Аватар)
     ============================ */
  .info-hero {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 45vh;
    min-height: 240px;
    flex-shrink: 0;
    background: var(--bg-surface-3);
  }

  .info-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 20%;
  }

  .info-hero-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5rem;
    color: var(--txt-muted);
    opacity: 0.2;
  }

  .info-hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.5) 0%,
      transparent 20%,
      transparent 50%,
      rgba(0, 0, 0, 0.85) 90%,
      var(--bg-surface-1) 100%
    );
    pointer-events: none;
  }

  .info-hero-text {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: var(--space-4) var(--space-5);
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .info-hero-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
    text-shadow: 0 2px 6px rgba(0,0,0,0.9);
    word-break: break-word;
  }

  .info-hero-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .info-tag {
    font-size: 11px;
    padding: 2px 10px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: var(--txt-gold-light);
    border-radius: var(--radius-full);
    border: 1px solid rgba(196, 163, 90, 0.4);
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }

  /* ============================
     ОПИСАНИЕ
     ============================ */
  .info-content {
    padding: var(--space-4) var(--space-5) var(--space-6);
    overflow-y: auto;
    flex: 1;
  }

  .info-desc {
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--glass-border-hover); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--txt-gold); }

  /* ============================
     LIGHTBOX (Полноэкранное фото)
     ============================ */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999; /* Выше всех остальных модалок */
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out; /* Подсказка, что клик закроет фото */
    animation: fadeIn 0.2s ease-out;
  }

  .lightbox-img {
    max-width: 95vw;
    max-height: 95vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    cursor: default; /* На самой картинке обычный курсор */
  }

  .lightbox-close {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 2;
  }

  .lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ============================
     МОБИЛЬНАЯ АДАПТАЦИЯ
     ============================ */
  @media (max-width: 480px) {
    .info-hero {
      aspect-ratio: 1 / 1;
      max-height: 45vh;
      min-height: 200px;
    }
    
    .info-hero-title {
      font-size: var(--font-size-xl);
    }
    
    .floating-actions {
      top: 12px;
      right: 12px;
    }
    
    .info-content {
      padding: var(--space-3) var(--space-4) var(--space-5);
    }

    .lightbox-close {
      top: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      font-size: 1rem;
    }
  }
</style>