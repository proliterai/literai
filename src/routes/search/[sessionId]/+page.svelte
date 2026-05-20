<!-- src/routes/search/[sessionId]/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ui } from '$lib/ui/ui.store';
  import { renderMarkdown } from '$lib/utils/markdown';
  
  import { searchStore } from '$lib/domain/search/search.store';
  import { searchService } from '$lib/domain/search/search.service';
  import { sessionsRepo } from '$lib/db/repositories/sessions.repo';
  import { attachSearchAutosave } from '$lib/domain/search/search.persistence';
  import { buildSearchSessionRow } from '$lib/domain/search/search.sessionRow';
  import type { SearchSnippet } from '$lib/db/types';

  let sessionId = $derived($page.params.sessionId);
  let s = $derived($searchStore);
  
  let loadingSession = $state(true);
  let view = $state<'results' | 'article'>('results');
  let clarificationInput = $state('');
  let clarificationContainer = $state<HTMLDivElement | null>(null);
  let detachAutosave: (() => void) | null = null;

  $effect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  });

  onMount(() => {
    detachAutosave = attachSearchAutosave(buildSearchSessionRow);
  });

  onDestroy(() => {
    if (detachAutosave) detachAutosave();
    searchStore.destroy();
  });

  async function loadSession(id: string) {
    loadingSession = true;
    clarificationInput = ''; 
    
    try {
      const session = await sessionsRepo.load(id);
      if (!session || session.mode !== 'search') {
        ui.notify('Поисковая сессия не найдена', 'error');
        goto('/search');
        return;
      }

      searchStore.loadSession(session);
      
      if ($searchStore.currentArticleSnippetId) {
        view = 'article';
      } else {
        view = 'results';
      }

      loadingSession = false;

      if ($searchStore.snippets.length === 0) {
        generateSnippets();
      }

    } catch (e) {
      console.error(e);
      ui.notify('Ошибка загрузки сессии', 'error');
      goto('/search');
    }
  }

  async function generateSnippets() {
    searchStore.setIsGeneratingSnippets(true);
    try {
      const snippets = await searchService.generateSnippets($searchStore.query);
      searchStore.setSnippets(snippets);
    } catch (e: any) {
      ui.notify(e.message, 'error');
    } finally {
      searchStore.setIsGeneratingSnippets(false);
    }
  }

  async function openSnippet(snippet: SearchSnippet) {
    searchStore.openArticle(snippet.id);
    view = 'article';
    
    if (!s.articles[snippet.id] || !s.articles[snippet.id].content) {
      searchStore.setIsGeneratingArticle(true);
      try {
        const content = await searchService.generateArticle(s.query, snippet);
        searchStore.setArticleContent(snippet.id, content);
      } catch (e: any) {
        ui.notify(`Ошибка генерации статьи: ${e.message}`, 'error');
        handleBack(); 
      } finally {
        searchStore.setIsGeneratingArticle(false);
      }
    }
  }

  // --- НОВОЕ: Перегенерация статьи ---
  async function rerollArticle() {
    if (s.isGeneratingArticle || !s.currentArticleSnippetId) return;
    
    const snippetId = s.currentArticleSnippetId;
    const snippet = s.snippets.find(sn => sn.id === snippetId);
    if (!snippet) return;

    searchStore.setIsGeneratingArticle(true);
    try {
      const content = await searchService.generateArticle(s.query, snippet);
      searchStore.setArticleContent(snippetId, content);
      ui.notify('Статья перегенерирована', 'success');
    } catch (e: any) {
      ui.notify(`Ошибка генерации статьи: ${e.message}`, 'error');
    } finally {
      searchStore.setIsGeneratingArticle(false);
    }
  }

  function handleBack() {
    searchStore.goBackToResults();
    view = 'results';
  }

  async function sendClarification() {
    const text = clarificationInput.trim();
    if (!text || s.isClarifying || !s.currentArticleSnippetId) return;

    const snippetId = s.currentArticleSnippetId;
    const article = s.articles[snippetId];
    const snippet = s.snippets.find(sn => sn.id === snippetId);
    if (!article || !snippet) return;

    clarificationInput = '';
    searchStore.addClarificationMessage(snippetId, 'user', text);
    searchStore.setIsClarifying(true);
    scrollToBottom();

    try {
      const response = await searchService.generateClarification(
        s.query, snippet, article.content, article.clarificationHistory, text
      );
      searchStore.addClarificationMessage(snippetId, 'assistant', response);
      scrollToBottom();
    } catch (e: any) {
      ui.notify(`Ошибка уточнения: ${e.message}`, 'error');
    } finally {
      searchStore.setIsClarifying(false);
    }
  }

  async function rerollClarification(msgId: string) {
    if (s.isClarifying || !s.currentArticleSnippetId) return;
    
    const snippetId = s.currentArticleSnippetId;
    const article = s.articles[snippetId];
    const snippet = s.snippets.find(sn => sn.id === snippetId);
    if (!article || !snippet) return;

    const msgIndex = article.clarificationHistory.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const userMsg = article.clarificationHistory.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!userMsg) return;

    searchStore.setIsClarifying(true);
    try {
      const historySlice = article.clarificationHistory.slice(0, msgIndex);
      const response = await searchService.generateClarification(
        s.query, snippet, article.content, historySlice, userMsg.content
      );
      searchStore.addClarificationVersion(snippetId, msgId, response);
      ui.notify('Ответ перегенерирован', 'success');
    } catch (e: any) {
      ui.notify(`Ошибка реролла: ${e.message}`, 'error');
    } finally {
      searchStore.setIsClarifying(false);
    }
  }

  function scrollToBottom() {
    tick().then(() => {
      if (clarificationContainer) {
        clarificationContainer.scrollTop = clarificationContainer.scrollHeight;
      }
    });
  }
</script>

{#if loadingSession}
  <div class="search-loading-state">
    <i class="fas fa-spinner fa-spin"></i>
    <p>Загрузка данных...</p>
  </div>
{:else}
  <div class="search-layout">
    
    <div class="search-header-query">
      <h2><i class="fas fa-search" style="color: var(--txt-gold); font-size: 0.8em; margin-right: 8px;"></i> {s.query}</h2>
      <p class="txt-muted" style="font-size: var(--font-size-sm);">Результаты поиска:</p>
    </div>

    {#if view === 'results'}
      {#if s.isGeneratingSnippets}
        <div class="search-loading-state">
          <i class="fas fa-cog fa-spin"></i>
          <p>Анализ запроса и поиск источников...</p>
        </div>
      {:else}
        <div class="search-snippets-grid">
          {#each s.snippets as snippet (snippet.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="snippet-card" onclick={() => openSnippet(snippet)}>
              <span class="snippet-tag">{snippet.tag}</span>
              <h3 class="snippet-title">{snippet.title}</h3>
              <p class="snippet-desc">{snippet.description}</p>
            </div>
          {/each}
        </div>
        
        {#if s.snippets.length === 0}
          <div class="search-loading-state">
            <p>Ничего не найдено.</p>
            <button class="btn-primary" onclick={generateSnippets}>Повторить поиск</button>
          </div>
        {:else}
          <!-- КНОПКИ УПРАВЛЕНИЯ СНИППЕТАМИ -->
          <div class="snippets-actions-row" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick={generateSnippets} disabled={s.isGeneratingSnippets}>
              <i class="fas fa-sync-alt"></i> Обновить результаты
            </button>

            <!-- НАВИГАЦИЯ ВЕРСИЙ СНИППЕТОВ -->
            {#if s.snippetVersions.length > 1}
              <div style="display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); color: var(--txt-muted); background: var(--bg-surface-3); padding: 4px 8px; border-radius: var(--radius-md);">
                <button class="clarify-action-btn" onclick={() => searchStore.switchSnippetVersion(-1)}>&lt;</button>
                <span class="version-counter">{s.activeSnippetVersion + 1}/{s.snippetVersions.length}</span>
                <button class="clarify-action-btn" onclick={() => searchStore.switchSnippetVersion(1)}>&gt;</button>
              </div>
            {/if}

            <button class="btn-secondary" onclick={() => goto('/search')}>
              <i class="fas fa-home"></i> Новый поиск
            </button>
          </div>
        {/if}
      {/if}

    {:else if view === 'article' && s.currentArticleSnippetId}
      {@const snippet = s.snippets.find(sn => sn.id === s.currentArticleSnippetId)}
      {@const article = s.articles[s.currentArticleSnippetId]}

      <div class="article-view">
        <div class="article-top-bar">
          <button class="btn-secondary btn-sm" onclick={handleBack}>
            <i class="fas fa-arrow-left"></i> Назад к результатам
          </button>
          <span style="color: var(--txt-muted); font-size: var(--font-size-sm);">
            Источник: <strong style="color: var(--txt-primary);">{snippet?.title}</strong>
          </span>
        </div>

        {#if s.isGeneratingArticle}
          <div class="search-loading-state">
            <i class="fas fa-pen-nib fa-spin"></i>
            <p>Идет поиск...</p>
          </div>
        {:else if article?.content}
          <div class="article-content-box" style="position: relative;">
            
            <!-- ШАПКА СТАТЬИ: РЕРОЛЛ И ВЕРСИИ -->
            <div class="clarify-msg-header" style="margin-bottom: 16px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;">
              {#if article.versions && article.versions.length > 1}
                <button class="clarify-action-btn" onclick={() => searchStore.switchArticleVersion(snippet!.id, -1)}>&lt;</button>
                <span class="version-counter">{(article.activeVersion ?? 0) + 1}/{article.versions.length}</span>
                <button class="clarify-action-btn" onclick={() => searchStore.switchArticleVersion(snippet!.id, 1)}>&gt;</button>
              {/if}
              <button class="clarify-action-btn" title="Перегенерировать статью" onclick={rerollArticle} disabled={s.isGeneratingArticle}>
                <i class="fas fa-sync-alt"></i> Реролл статьи
              </button>
            </div>

            <!-- ТЕКСТ СТАТЬИ -->
            {@html renderMarkdown(article.content)}
          </div>
          
          <div style="margin-bottom: var(--space-5);">
             <button class="btn-secondary btn-sm" onclick={handleBack}>
              <i class="fas fa-arrow-left"></i> Назад к результатам
            </button>
          </div>

          <!-- УТОЧНЕНИЯ -->
          <div class="clarification-section">
            <h3>Уточнить детали</h3>
            
            <div class="clarification-history custom-scrollbar" bind:this={clarificationContainer} style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
              {#each article.clarificationHistory as msg}
                <div class="clarify-msg {msg.role}">
                  {#if msg.role === 'assistant'}
                    <div class="clarify-msg-header">
                      {#if msg.versions && msg.versions.length > 1}
                        <button class="clarify-action-btn" onclick={() => searchStore.switchClarificationVersion(s.currentArticleSnippetId!, msg.id, -1)}>&lt;</button>
                        <span class="version-counter">{(msg.activeVersion ?? 0) + 1}/{msg.versions.length}</span>
                        <button class="clarify-action-btn" onclick={() => searchStore.switchClarificationVersion(s.currentArticleSnippetId!, msg.id, 1)}>&gt;</button>
                      {/if}
                      <button class="clarify-action-btn" title="Перегенерировать ответ" onclick={() => rerollClarification(msg.id)} disabled={s.isClarifying}>
                        <i class="fas fa-sync-alt"></i>
                      </button>
                    </div>
                  {/if}
                  
                  {@html renderMarkdown(msg.content)}
                </div>
              {/each}
              
              {#if s.isClarifying}
                <div class="clarify-msg assistant" style="opacity: 0.7; font-style: italic;">
                  <i class="fas fa-ellipsis-h fa-fade"></i> Идет поиск...
                </div>
              {/if}
            </div>

            <div class="chat-input-container" style="margin-bottom: 0;">
              <textarea 
                class="chat-input" 
                placeholder="Задайте вопрос по этой статье..." 
                bind:value={clarificationInput}
                rows="1"
                disabled={s.isClarifying}
                onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendClarification(); } }}
              ></textarea>
              <button class="send-btn" disabled={!clarificationInput.trim() || s.isClarifying} onclick={sendClarification}>
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

  </div>
{/if}