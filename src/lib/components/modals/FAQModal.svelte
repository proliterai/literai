<!-- ================================================================================
ФАЙЛ: src/lib/components/modals/FAQModal.svelte
Описание: Модальное окно с часто задаваемыми вопросами (FAQ)
================================================================================ -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ui } from '$lib/ui/ui.store';

  type FAQItem = {
    id: string;
    question: string;
    answer: string;
  };

  let faqData = $state<FAQItem[]>([]);
  let loading = $state(true);
  let openItems = $state<Set<string>>(new Set());

  onMount(async () => {
    try {
      const resp = await fetch('/data/faq.json');
      if (resp.ok) {
        faqData = await resp.json();
        // Автоматически открываем первый вопрос для наглядности
        if (faqData.length > 0) {
          openItems.add(faqData[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load FAQ:', e);
    } finally {
      loading = false;
    }
  });

  function toggleItem(id: string) {
    const newSet = new Set(openItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    openItems = newSet;
  }

  function isOpen(id: string): boolean {
    return openItems.has(id);
  }
</script>

<div class="modal-panel faq-modal">
  <div class="modal-header">
    <h3><i class="fas fa-question-circle"></i> Частые вопросы</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  
  <div class="modal-body custom-scrollbar">
    {#if loading}
      <div class="state-container">
        <i class="fas fa-circle-notch fa-spin"></i>
        <p>Загрузка ответов...</p>
      </div>
    {:else if faqData.length === 0}
      <div class="state-container empty">
        <i class="fas fa-info-circle"></i>
        <p>База знаний пока пуста.</p>
      </div>
    {:else}
      <div class="faq-list">
        {#each faqData as item (item.id)}
          <div class="faq-item" class:is-open={isOpen(item.id)}>
            <button 
              class="faq-question" 
              type="button"
              onclick={() => toggleItem(item.id)}
              aria-expanded={isOpen(item.id)}
            >
              <div class="faq-q-badge">Q</div>
              <span class="faq-q-text">{item.question}</span>
              <span class="faq-icon">
                <i class="fas fa-chevron-down"></i>
              </span>
            </button>
            
            {#if isOpen(item.id)}
              <div class="faq-answer-wrapper" transition:slide={{ duration: 250, axis: 'y' }}>
                <div class="faq-answer">
                  <div class="faq-a-badge">A</div>
                  <div class="faq-a-text">{item.answer}</div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ============================================
     ОСНОВНОЙ КОНТЕЙНЕР
     ============================================ */
  .faq-modal {
    max-width: 760px; /* Делаем чуть шире для комфортного чтения */
    width: 95%;
    display: flex;
    flex-direction: column;
    max-height: 85vh;
  }

  .modal-body {
    padding: var(--space-5);
    overflow-y: auto;
    flex: 1;
  }

  /* ============================================
     СОСТОЯНИЯ ЗАГРУЗКИ / ПУСТОТЫ
     ============================================ */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) 0;
    color: var(--txt-muted);
    text-align: center;
  }

  .state-container i {
    font-size: 3rem;
    margin-bottom: var(--space-4);
    color: var(--txt-gold);
  }

  .state-container.empty i {
    opacity: 0.4;
  }

  /* ============================================
     СПИСОК FAQ
     ============================================ */
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    /* Небольшой отступ для теней */
    padding: var(--space-1); 
  }

  .faq-item {
    background: var(--bg-surface-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .faq-item:hover {
    border-color: var(--glass-border-hover);
    box-shadow: var(--shadow-sm);
  }

  /* Открытое состояние карточки */
  .faq-item.is-open {
    border-color: var(--txt-gold);
    background: var(--bg-surface-3);
    box-shadow: var(--shadow-md), var(--fx-glow-gold-subtle);
  }

  /* ============================================
     ВОПРОС (КНОПКА)
     ============================================ */
  .faq-question {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .faq-q-badge {
    flex-shrink: 0;
    width: var(--size-8);
    height: var(--size-8);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface-4);
    color: var(--txt-gold);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-weight: var(--font-bold);
    transition: all 0.3s ease;
  }

  .faq-item.is-open .faq-q-badge {
    background: var(--grad-burgundy);
    color: var(--txt-gold-light);
    box-shadow: var(--fx-shadow-gold);
  }

  .faq-q-text {
    flex: 1;
    font-size: var(--font-size-md);
    font-weight: var(--font-semibold);
    color: var(--txt-primary);
    line-height: var(--leading-snug);
    transition: color 0.2s ease;
  }

  .faq-item:hover .faq-q-text {
    color: var(--txt-gold-light);
  }

  .faq-icon {
    flex-shrink: 0;
    color: var(--txt-muted);
    font-size: var(--font-size-sm);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease;
  }

  .faq-item.is-open .faq-icon {
    transform: rotate(180deg);
    color: var(--txt-gold);
  }

  /* ============================================
     ОТВЕТ
     ============================================ */
  .faq-answer-wrapper {
    border-top: 1px dashed var(--glass-border);
    background: var(--bg-surface-1);
  }

  .faq-answer {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-5);
  }

  .faq-a-badge {
    flex-shrink: 0;
    width: var(--size-8);
    height: var(--size-8);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--txt-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-bold);
    opacity: 0.6;
  }

  .faq-a-text {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--txt-secondary);
    line-height: 1.7;
    white-space: pre-wrap; /* Сохраняет переносы строк из JSON */
  }

  /* ============================================
     КАСТОМНЫЙ СКРОЛЛБАР
     ============================================ */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--glass-border-hover);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--txt-gold);
  }
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--glass-border-hover) transparent;
  }

  /* ============================================
     МОБИЛЬНАЯ АДАПТАЦИЯ
     ============================================ */
  @media (max-width: 600px) {
    .modal-body {
      padding: var(--space-3);
    }

    .faq-question {
      padding: var(--space-3) var(--space-4);
      gap: var(--space-3);
    }

    .faq-q-badge, .faq-a-badge {
      width: var(--size-7);
      height: var(--size-7);
      font-size: 10px;
    }

    .faq-q-text {
      font-size: var(--font-size-sm);
    }

    .faq-answer {
      padding: var(--space-4);
      gap: var(--space-3);
    }

    .faq-a-text {
      font-size: 13px; /* чуть меньше для вместимости */
    }
  }
</style>