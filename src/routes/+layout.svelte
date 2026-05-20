<script lang="ts">
import { onMount, type Snippet } from 'svelte';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { ui } from '$lib/ui/ui.store';
import { settingsStore } from '$lib/domain/settings/settings.store';
import { ensureCatalogSeeded } from '$lib/domain/seed/catalog.seed';
import { attachChatAutosave } from '$lib/domain/chat/chat.persistence';
import { buildSessionRow } from '$lib/domain/chat/chat.sessionRow';
import { systemPromptStore } from '$lib/domain/systemPrompt/systemPrompt.store';
import { cheatmodeStore } from '$lib/domain/cheatmode/cheatmode.store';
import { lorebookStore } from '$lib/domain/lorebook/lorebook.store';
import { providersStore } from '$lib/domain/providers/providers.store';
import { applyTheme } from '$lib/ui/theme';
import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';
import { autoplayStore } from '$lib/domain/autoplay/autoplay.store';

// Общие панели настроек
import ProvidersPanel from '$lib/components/providers/ProvidersPanel.svelte';
import MyChatsPanel from '$lib/components/settings/MyChatsPanel.svelte';
import DesignPanel from '$lib/components/settings/DesignPanel.svelte';
import AISettingsPanel from '$lib/components/settings/AISettingsPanel.svelte';
import SearchQueriesPanel from '$lib/components/settings/SearchQueriesPanel.svelte';

// Модальные окна для ролевого режима
import ScriptModal from '$lib/components/modals/ScriptModal.svelte';
import ExportModal from '$lib/components/modals/ExportModal.svelte';
import SummarizeModal from '$lib/components/modals/SummarizeModal.svelte';
import AnalyticsModal from '$lib/components/modals/AnalyticsModal.svelte';

// Модальные окна для режима героя
import HeroScriptModal from '$lib/components/hero-modals/HeroScriptModal.svelte';
import HeroExportModal from '$lib/components/hero-modals/HeroExportModal.svelte';
import HeroSummarizeModal from '$lib/components/hero-modals/HeroSummarizeModal.svelte';
import HeroAnalyticsModal from '$lib/components/hero-modals/HeroAnalyticsModal.svelte';

// Модальные окна для режима команды
import TeamScriptModal from '$lib/components/team-modals/TeamScriptModal.svelte';
import TeamExportModal from '$lib/components/team-modals/TeamExportModal.svelte';
import TeamSummarizeModal from '$lib/components/team-modals/TeamSummarizeModal.svelte';
import TeamAnalyticsModal from '$lib/components/team-modals/TeamAnalyticsModal.svelte';

// Общие модалки
import FAQModal from '$lib/components/modals/FAQModal.svelte';
import LoggingModal from '$lib/components/modals/LoggingModal.svelte';
import LorebookModal from '$lib/components/modals/LorebookModal.svelte';
import ImportSessionModal from '$lib/components/modals/ImportSessionModal.svelte';
import BackupModal from '$lib/components/modals/BackupModal.svelte';
import MapModal from '$lib/components/modals/MapModal.svelte';
import ConfirmModal from '$lib/components/catalog/ConfirmModal.svelte';
import SupportModal from '$lib/components/modals/SupportModal.svelte';
import ProviderHelpModal from '$lib/components/modals/ProviderHelpModal.svelte';

// Модалки Автоигры и Око Мира
import AutoplayModal from '$lib/components/modals/AutoplayModal.svelte';
import TeamAutoplayModal from '$lib/components/team-modals/TeamAutoplayModal.svelte';
import EyeModal from '$lib/components/modals/EyeModal.svelte';

// Memory Book
import MemoryBookModal from '$lib/components/modals/MemoryBookModal.svelte';

let { children }: { children: Snippet } = $props();
let showSubFooter = $state(false);

// === ПЕРЕМЕННЫЕ ДЛЯ PWA ===
let deferredPrompt = $state<any>(null);
let canInstall = $state(false);

// Определение текущего маршрута
let path = $derived($page.url.pathname);
let isRoleplayMode = $derived(path.startsWith('/roleplay'));
let isHeroMode = $derived(path.startsWith('/hero'));
let isTeamMode = $derived(path.startsWith('/team'));
let isHome = $derived(path === '/');
let isChatPage = $derived(
  path.startsWith('/roleplay/chat/') ||
  path.startsWith('/hero/chat/') ||
  path.startsWith('/team/chat/')
);
let isTeamChat = $derived(path.startsWith('/team/chat/'));
let isModePage = $derived(isRoleplayMode || isHeroMode || isTeamMode);
let isSearchPath = $derived(path.startsWith('/search'));

function closePresetSelectors() {
  const event = new CustomEvent('close-preset-selectors');
  window.dispatchEvent(event);
}

onMount(async () => {
  try {
    await settingsStore.init();
    await providersStore.init();
    await systemPromptStore.loadPresets();
    await cheatmodeStore.loadPresets();
    await lorebookStore.init();
    await ensureCatalogSeeded();
    const s = $settingsStore.values;
    applyTheme(s.active_theme);
    document.documentElement.style.setProperty('--font-family-base', s.active_font);
    document.documentElement.style.fontSize = `${s.font_size}px`;
    attachChatAutosave(buildSessionRow);

    // === СЛУШАТЕЛИ СОБЫТИЙ PWA УСТАНОВКИ ===
    window.addEventListener('beforeinstallprompt', (e) => {
      // Отменяем автоматический показ системного окна
      e.preventDefault();
      // Сохраняем событие для вызова по клику
      deferredPrompt = e;
      // Показываем кнопку в UI
      canInstall = true;
    });

    window.addEventListener('appinstalled', () => {
      // Скрываем кнопку после успешной установки
      canInstall = false;
      deferredPrompt = null;
      ui.notify('Приложение успешно установлено!', 'success');
    });

  } catch (error: any) {
    console.error('[Layout] ❌ Initialization error:', error);
    ui.notify(`Ошибка инициализации: ${error.message || 'Неизвестная ошибка'}`, 'error');
  }
});

// === ФУНКЦИЯ ВЫЗОВА УСТАНОВКИ PWA ===
async function handleInstallApp() {
  if (!deferredPrompt) return;
  
  showSubFooter = false; // Закрываем подменю, если открыто
  
  // Показываем системное окно установки
  deferredPrompt.prompt();
  
  // Ждем ответа пользователя
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    console.log('Пользователь установил PWA');
  }
  
  // Очищаем, так как prompt() можно вызвать только один раз
  deferredPrompt = null;
  canInstall = false;
}

function closeSubFooter() {
  showSubFooter = false;
}

function closeAllUI() {
  ui.closeAll();
  closeSubFooter();
  closePresetSelectors();
}
</script>

<svelte:window 
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      // Если открыто фото на весь экран — закрываем только его
      if ($ui.lightbox && $ui.lightbox.open) {
        ui.closeLightbox();
      } else if (showSubFooter) {
        showSubFooter = false;
      } else {
        closeAllUI();
      }
    }
  }} 
/>

{#if $ui.drawer.open || $ui.modal.open || $ui.confirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="app-overlay visible" onclick={closeAllUI}></div>
{:else}
  <div class="app-overlay"></div>
{/if}

<header class="app-header" id="app-header">
  <div class="header-inner">
    <div class="header-logo">
      <a href="/" class="logo-link">
        <span class="logo-text">Liter<span class="logo-accent">AI</span></span>
      </a>
    </div>
    
    <!-- КОНТЕЙНЕР ДЛЯ КНОПОК СПРАВА -->
    <div class="header-actions">
      <!-- Кнопка Поиска -->
      <button
        class="header-settings-btn"
        aria-label="Поиск по вселенной"
        onclick={() => { ui.closeAll(); goto('/search'); }}
        title="Поиск по вселенной"
      >
        <i class="fas fa-search"></i>
      </button>

      <button
        class="header-boosty-btn"
        aria-label="Поддержать проект"
        onclick={() => ui.openModal('support')}
        title="Поддержка проекта"
      >
        <i class="fas fa-bolt"></i>
        <span class="btn-label">Движ</span>
      </button>
      
      <!-- Кнопка Настройки -->
      <button
        class="header-settings-btn"
        aria-label="Настройки"
        onclick={() => ui.openDrawer('providers')}
        title="Настройки"
      >
        <i class="fas fa-cog"></i>
      </button>
    </div>
  </div>
</header>

<aside class="app-drawer {$ui.drawer.open ? 'open' : ''}" id="app-drawer">
  <div class="drawer-header">
    <h3 class="drawer-title">Настройки</h3>
    <button 
      class="drawer-close-btn" 
      aria-label="Закрыть настройки" 
      onclick={() => ui.closeDrawer()}
    >
      <i class="fas fa-times"></i>
    </button>
  </div>
  <nav class="drawer-nav">
    <button 
      class="drawer-nav-item {$ui.drawer.section === 'providers' ? 'active' : ''}" 
      onclick={() => ui.openDrawer('providers')}
    >
      <i class="fas fa-server"></i> Провайдеры
    </button>
    <button 
      class="drawer-nav-item {$ui.drawer.section === 'design' ? 'active' : ''}" 
      onclick={() => ui.openDrawer('design')}
    >
      <i class="fas fa-palette"></i> Дизайн
    </button>
    <button 
      class="drawer-nav-item {$ui.drawer.section === 'ai-settings' ? 'active' : ''}" 
      onclick={() => ui.openDrawer('ai-settings')}
    >
      <i class="fas fa-sliders-h"></i> ИИ
    </button>
    
    <!-- ПОДМЕНЯЕМ ПАНЕЛЬ ИСТОРИИ В ЗАВИСИМОСТИ ОТ РАЗДЕЛА -->
    {#if isSearchPath}
      <button 
        class="drawer-nav-item {$ui.drawer.section === 'my-searches' ? 'active' : ''}" 
        onclick={() => ui.openDrawer('my-searches')}
      >
        <i class="fas fa-history"></i> Мои запросы
      </button>
    {:else}
      <button 
        class="drawer-nav-item {$ui.drawer.section === 'my-chats' ? 'active' : ''}" 
        onclick={() => ui.openDrawer('my-chats')}
      >
        <i class="fas fa-comments"></i> Мои чаты
      </button>
    {/if}
  </nav>
  <div class="drawer-content" id="drawer-content">
    {#if $ui.drawer.section === 'providers'}
      <ProvidersPanel />
    {:else if $ui.drawer.section === 'design'}
      <DesignPanel />
    {:else if $ui.drawer.section === 'ai-settings'}
      <AISettingsPanel />
    {:else if $ui.drawer.section === 'my-chats'}
      <MyChatsPanel />
    {:else if $ui.drawer.section === 'my-searches'}
      <SearchQueriesPanel />
    {/if}
  </div>
</aside>

<main class="app-main" id="app-main">
  {@render children()}
</main>

<div class="footer-wrapper">
  {#if isChatPage}
    <div class="sub-footer {showSubFooter ? 'visible' : ''}">
      <div class="sub-footer-inner">
        <!-- ДОБАВЛЕНА КНОПКА ОКО МИРА -->
        <button class="sub-footer-btn" onclick={() => { ui.openModal('eye'); showSubFooter = false; }}>
          <i class="fas fa-eye"></i> Око мира
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('memorybook'); showSubFooter = false; }}>
          <i class="fas fa-book"></i> Memory Book
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('summarize'); showSubFooter = false; }}>
          <i class="fas fa-book-open"></i> Саммари
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('export'); showSubFooter = false; }}>
          <i class="fas fa-file-export"></i> Экспорт
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('analytics'); showSubFooter = false; }}>
          <i class="fas fa-chart-bar"></i> Аналитика
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('map'); showSubFooter = false; }}>
          <i class="fas fa-map-marked-alt"></i> Карта
        </button>
        <button class="sub-footer-btn" onclick={() => { ui.openModal('logging'); showSubFooter = false; }}>
          <i class="fas fa-terminal"></i> Логирование
        </button>
      </div>
    </div>
  {/if}

  <footer class="app-footer" id="app-footer">
    <div class="footer-inner">
      {#if isHome}
        <!-- Главная страница -->
        {#if canInstall}
          <button 
            class="footer-btn" 
            onclick={handleInstallApp} 
            title="Установить приложение"
            style="color: var(--txt-gold);"
          >
            <i class="fas fa-download"></i>
            <span class="footer-btn-label">Установить</span>
          </button>
        {/if}

        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('import-session'); }} 
          title="Загрузить сохранение"
        >
          <i class="fas fa-file-import"></i>
          <span class="footer-btn-label">Импорт чата</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('faq'); }} 
          title="FAQ"
        >
          <i class="fas fa-question-circle"></i>
          <span class="footer-btn-label">FAQ</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('backup'); }} 
          title="Полный бэкап"
        >
          <i class="fas fa-database"></i>
          <span class="footer-btn-label">Бэкап</span>
        </button>

      {:else if isModePage}
        <!-- Любая страница режима (каталог или чат) -->
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('script'); }} 
          title="Скрипт"
        >
          <i class="fas fa-scroll"></i>
          <span class="footer-btn-label">Скрипт</span>
        </button>

        {#if isChatPage && (isRoleplayMode || isHeroMode) && $settingsStore.values.show_hints}
          <button 
            class="footer-btn {$autoplayStore.isRunning ? 'active' : ''}" 
            onclick={() => { showSubFooter = false; ui.openModal('autoplay'); }} 
            title="Автоигра"
          >
            <i class="fas fa-play" style={$autoplayStore.isRunning ? 'color: var(--state-success)' : ''}></i>
            <span class="footer-btn-label">Автоигра</span>
          </button>
        {/if}

        {#if isTeamChat}
          <button 
            class="footer-btn" 
            onclick={() => { showSubFooter = false; privateChatStore.open(); }} 
            title="Приватные чаты"
          >
            <i class="fas fa-comments"></i>
            <span class="footer-btn-label">Приват чаты</span>
          </button>
        {/if}
        <button
          class="footer-btn footer-btn-functions {showSubFooter ? 'active' : ''}"
          onclick={() => showSubFooter = !showSubFooter}
          title="Функции"
        >
          <i class="fas fa-puzzle-piece"></i>
          <span class="footer-btn-label">Функции</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('faq'); }} 
          title="FAQ"
        >
          <i class="fas fa-question-circle"></i>
          <span class="footer-btn-label">FAQ</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('backup'); }} 
          title="Полный бэкап"
        >
          <i class="fas fa-database"></i>
          <span class="footer-btn-label">Бэкап</span>
        </button>

      <!-- === НОВЫЙ БЛОК ДЛЯ ПОИСКА === -->
      {:else if isSearchPath}
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('logging'); }} 
          title="Логирование ИИ"
        >
          <i class="fas fa-terminal"></i>
          <span class="footer-btn-label">Логи</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('faq'); }} 
          title="FAQ"
        >
          <i class="fas fa-question-circle"></i>
          <span class="footer-btn-label">FAQ</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('backup'); }} 
          title="Полный бэкап"
        >
          <i class="fas fa-database"></i>
          <span class="footer-btn-label">Бэкап</span>
        </button>

      <!-- === FALLBACK === -->
      {:else}
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('faq'); }} 
          title="FAQ"
        >
          <i class="fas fa-question-circle"></i>
          <span class="footer-btn-label">FAQ</span>
        </button>
        <button 
          class="footer-btn" 
          onclick={() => { showSubFooter = false; ui.openModal('backup'); }} 
          title="Полный бэкап"
        >
          <i class="fas fa-database"></i>
          <span class="footer-btn-label">Бэкап</span>
        </button>
      {/if}
    </div>
  </footer>
</div>

{#if $ui.modal.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="app-modal-container visible" 
    onclick={(e) => {
      if (e.currentTarget === e.target) closeAllUI();
    }}
  >
    {#if $ui.modal.id === 'script'}
      {#if isRoleplayMode}
        <ScriptModal />
      {:else if isHeroMode}
        <HeroScriptModal />
      {:else if isTeamMode}
        <TeamScriptModal />
      {/if}
    {:else if $ui.modal.id === 'export'}
      {#if isRoleplayMode}
        <ExportModal />
      {:else if isHeroMode}
        <HeroExportModal />
      {:else if isTeamMode}
        <TeamExportModal />
      {/if}
    {:else if $ui.modal.id === 'summarize'}
      {#if isRoleplayMode}
        <SummarizeModal />
      {:else if isHeroMode}
        <HeroSummarizeModal />
      {:else if isTeamMode}
        <TeamSummarizeModal />
      {/if}
    {:else if $ui.modal.id === 'analytics'}
      {#if isRoleplayMode}
        <AnalyticsModal />
      {:else if isHeroMode}
        <HeroAnalyticsModal />
      {:else if isTeamMode}
        <TeamAnalyticsModal />
      {/if}
    {:else if $ui.modal.id === 'faq'}
      <FAQModal />
    {:else if $ui.modal.id === 'logging'}
      <LoggingModal />
    {:else if $ui.modal.id === 'lorebook'}
      <LorebookModal />
    {:else if $ui.modal.id === 'import-session'}
      <ImportSessionModal />
    {:else if $ui.modal.id === 'backup'}
      <BackupModal />
    {:else if $ui.modal.id === 'map'}
      <MapModal />
    {:else if $ui.modal.id === 'autoplay'}
      <AutoplayModal />
    {:else if $ui.modal.id === 'team-autoplay'}
      <TeamAutoplayModal />
    {:else if $ui.modal.id === 'eye'}
      <EyeModal />
    {:else if $ui.modal.id === 'support'}
      <SupportModal />
    {:else if $ui.modal.id === 'memorybook'}
      <MemoryBookModal />
    {:else if $ui.modal.id === 'provider-help'}
      <ProviderHelpModal />
    {/if}
  </div>
{:else}
  <div class="app-modal-container"></div>
{/if}

<!-- ✅ ГЛОБАЛЬНЫЙ БЛОК ПОДТВЕРЖДЕНИЙ -->
{#if $ui.confirm}
  <ConfirmModal
    title={$ui.confirm.title}
    message={$ui.confirm.message}
    confirmText="Удалить"
    onCancel={() => ui.resolveConfirm(false)}
    onConfirm={() => ui.resolveConfirm(true)}
  />
{/if}

{#if $ui.notifications.length > 0}
  <div class="notifications-container">
    {#each $ui.notifications as n (n.id)}
      <div class="notification notification-{n.type} show">
        <div class="notification-body">
          <i class="fas fa-{n.type === 'success' ? 'check-circle' : n.type === 'error' ? 'exclamation-circle' : n.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
          <span>{n.message}</span>
        </div>
        <button class="notification-close" onclick={() => ui.removeNotification(n.id)}>
          <i class="fas fa-times"></i>
        </button>
      </div>
    {/each}
  </div>
{/if}

<!-- ✅ ГЛОБАЛЬНЫЙ ПРОСМОТРЩИК ФОТО (LIGHTBOX) -->
{#if $ui.lightbox?.open && $ui.lightbox?.url}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="global-lightbox-overlay" onclick={() => ui.closeLightbox()}>
    <button class="lightbox-close" type="button" title="Закрыть фото">
      <i class="fas fa-times"></i>
    </button>
    <img 
      src={$ui.lightbox.url} 
      alt="Full screen view" 
      class="lightbox-img" 
      onclick={(e) => e.stopPropagation()} 
    />
  </div>
{/if}

<style>
	.logo-link {
		text-decoration: none;
		color: inherit;
		display: inline-block;
	}

  /* СТИЛИ ДЛЯ ПРОСМОТРЩИКА */
  .global-lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999; /* Поверх вообще всего */
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
    animation: fadeIn 0.2s ease-out;
  }
  
  .lightbox-img {
    max-width: 95vw;
    max-height: 95vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    cursor: default;
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
</style>