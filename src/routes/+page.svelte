<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<div class="landing">
  <div class="landing-center">
    <!-- ── Hero-блок со слоганом ── -->
    <div class="landing-hero">
      <div class="slogan-banner">
        <div class="slogan-glow"></div>

        <div class="slogan-content">
          <h3 class="landing-title">Войди в <span class="accent-text">Историю</span></h3>
          <p class="landing-subtitle">Ролевые приключения с Ai</p>
        </div>
      </div>
    </div>

    <!-- ── Основной блок действий ── -->
    <div class="landing-actions">
      <!-- ── Карточки режимов ── -->
      <div class="landing-cards">
        <button class="landing-card" onclick={() => goto('/roleplay')}>
          <div class="card-icon"><i class="fas fa-comments"></i></div>
          <h2>Ролевой чат</h2>
          <p>Классика жанра ролевых</p>
          <span class="card-cta">Начать <i class="fas fa-arrow-right"></i></span>
        </button>

        <button class="landing-card featured" onclick={() => goto('/hero')}>
          <div class="card-icon"><i class="fas fa-gamepad"></i></div>
          <h2>Игра за героя</h2>
          <p>Один герой покоряет мир</p>
          <span class="card-cta">Начать <i class="fas fa-arrow-right"></i></span>
        </button>

        <button class="landing-card" onclick={() => goto('/team')}>
          <div class="card-icon"><i class="fas fa-people-roof"></i></div>
          <h2>Игра за команду</h2>
          <p>Персонажи в любом мире</p>
          <span class="card-cta">Начать <i class="fas fa-arrow-right"></i></span>
        </button>
      </div>

      <!-- ── Двойной блок: Каталог историй + Магазин допов ── -->
      <div class="landing-cta-pair">
        <button class="landing-cta-item" onclick={() => goto('/stories')}>
          <div class="catalog-cta-orb"></div>

          <div class="catalog-cta-icon">
            <i class="fas fa-dice"></i>
          </div>

          <div class="catalog-cta-content">
            <div class="catalog-cta-kicker">Открыть подборку</div>
            <h2>Каталог историй</h2>
            <p>Готовые миры, идеи и сценарии</p>
          </div>

          <span class="catalog-cta-arrow">
            <i class="fas fa-arrow-right"></i>
          </span>
        </button>

        <a class="landing-cta-item" href="https://store.literai.ru/" target="_blank" rel="noopener noreferrer">
          <div class="catalog-cta-orb"></div>
          <div class="catalog-cta-icon">
            <i class="fas fa-shopping-cart"></i>
          </div>
          <div class="catalog-cta-content">
            <div class="catalog-cta-kicker">Дополнения</div>
            <h2>Магазин LiterAi</h2>
            <p>Эксклюзивные персонажи, миры и стили</p>
          </div>
          <span class="catalog-cta-arrow">
            <i class="fas fa-external-link-alt"></i>
          </span>
        </a>
      </div>
    </div>
  </div>

  <!-- ── Нижние ссылки ── -->
  <nav class="landing-links" aria-label="Полезные ссылки">
    <a href="https://blog.literai.ru/gayd-novichka/" target="_blank" rel="noopener noreferrer">
      <i class="fas fa-book-open"></i> Гайд новичка
    </a>
    <span class="divider"></span>
    <a href="https://blog.literai.ru/dokumentatsiya/" target="_blank" rel="noopener noreferrer">
      <i class="fas fa-layer-group"></i> Справочник
    </a>
    <span class="divider"></span>
    <a href="https://blog.literai.ru/category/blog-proekta/" target="_blank" rel="noopener noreferrer">
      <i class="fas fa-layer-group"></i> Блог проекта
    </a>
    <span class="divider"></span>
    <a href="https://blog.literai.ru/o-proekte/" target="_blank" rel="noopener noreferrer">
      <i class="fas fa-layer-group"></i> О сайте
    </a>
  </nav>
</div>