<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
</script>

<div class="modal-panel support-modal">
  <div class="modal-header">
    <h3><i class="fas fa-heart"></i> Поддержка проекта</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  <div class="tab-content-area">
    <p>
      LiterAI — это независимый проект, созданный с ❤️ для всех любителей ролевых игр с ИИ.
      Мы будем рады любой поддержке с вашей стороны! Вы можете купить любые наборы с карточками персонажей или сценариев в нашем магазине. Или поддержать нас на Бусти. 
    </p>
    
    <div class="support-links">
      <a href="https://store.literai.ru/" target="_blank" rel="noopener noreferrer" class="support-link">
        <i class="fas fa-store"></i> Магазин LiterAi 
      </a>
      <a href="https://boosty.to/artxtop" target="_blank" rel="noopener noreferrer" class="support-link">
        <i class="fas fa-bolt"></i> Boosty ❤️
      </a>
      <a href="https://blog.literai.ru" target="_blank" rel="noopener noreferrer" class="support-link">
        <i class="fas fa-blog"></i> Блог проекта
      </a>
      <!-- При необходимости добавьте другие ссылки -->
    </div>
    
    <p>Заходите к нам в Блог, чтобы не пропустить обновления, новые истории и полезные материалы.</p>
  </div>
</div>

<style>
  .support-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: var(--space-5) 0;
  }
  .support-link {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    color: var(--txt-primary);
    font-weight: var(--font-medium);
    transition: all var(--transition-fast);
    text-decoration: none;
  }
  .support-link:hover {
    background: var(--bg-surface-3);
    border-color: var(--glass-border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }
  .support-link i {
    width: 1.5rem;
    text-align: center;
    font-size: 1.2rem;
    color: var(--txt-gold);
  }
  @media (max-width: 480px) {
    .support-links {
      gap: var(--space-2);
    }
    .support-link {
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
    }
  }
</style>