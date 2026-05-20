<!-- src/lib/components/modals/MapModal.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { ui } from '$lib/ui/ui.store';
  import { Network } from 'vis-network';
  import { mapService } from '$lib/domain/map/map.service';
  
  // Импорты сторов чата
  import { chatStore } from '$lib/domain/chat/chat.store';
  import { heroChatStore } from '$lib/domain/hero-chat/heroChat.store';
  import { teamChatStore } from '$lib/domain/team-chat/teamChat.store';
  let mapContainer: HTMLDivElement | null = $state(null);
  let network: Network | null = null;
  
  let loading = $state(true);
  let generating = $state(false);
  let error = $state<string | null>(null);
  
  let mapData = $state<any>(null);
  let selectedNodeInfo = $state<{label: string, description: string} | null>(null);
  let currentMode = $derived($page.url.pathname.split('/')[1]); 
  function getActiveStore() {
    if (currentMode === 'hero') return heroChatStore;
    if (currentMode === 'team') return teamChatStore;
    return chatStore;
  }
  function getCssVar(variableName: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    return value || fallback;
  }
  onMount(() => {
    const storeState = get(getActiveStore());
    if (storeState.mapData) {
      mapData = storeState.mapData;
      setTimeout(drawMap, 100);
    }
    loading = false;
  });
  onDestroy(() => {
    if (network) {
      network.destroy();
      network = null;
    }
  });
  async function handleGenerateMap() {
    generating = true;
    error = null;
    try {
      const store = getActiveStore();
      let script = '';
      let historyText = '';
      
      const unsubscribe = store.subscribe(s => {
        script = s.generatedScript;
        
        // 1. Добавляем саммари прошлых частей (Глобальная карта)
        const part = s.chatParts[s.currentPartIndex];
        if (part?.previousSummaries?.length) {
           historyText += "[ПРЕДЫДУЩИЕ ПУТЕШЕСТВИЯ]:\n";
           part.previousSummaries.forEach(ps => {
             historyText += `${ps.partName}: ${ps.summary}\n`;
           });
           historyText += "\n";
        }
        // 2. Добавляем огромный кусок текущего чата (Микро-карта)
        const branch = s.chatTree.branches[s.chatTree.activeBranchIndex];
        if (branch) {
           historyText += "[ТЕКУЩЕЕ ПОЛОЖЕНИЕ И ИССЛЕДОВАНИЕ]:\n";
           // Берем до 150 последних сообщений (без системных)
           const recent = branch.messages.filter(m => m.role !== 'system').slice(-150);
           recent.forEach(m => {
             const name = m.role === 'assistant' ? 'Рассказчик' : 'Игрок/Персонаж';
             const text = m.versions?.length ? (m.versions[m.activeVersion ?? 0]?.content ?? m.content) : m.content;
             historyText += `${name}: ${text}\n\n`;
           });
        }
      });
      unsubscribe(); 
      const newMapData = await mapService.generateMap(script, historyText);
      mapData = newMapData;
      if (typeof store.setMapData === 'function') {
        store.setMapData(newMapData);
      }
      setTimeout(drawMap, 100);
    } catch (e: any) {
      error = e.message;
    } finally {
      generating = false;
    }
  }
  function drawMap() {
    if (!mapContainer || !mapData || !mapData.nodes) return;
    if (network) network.destroy();
    const textColor = getCssVar('--txt-primary', '#ffffff');
    const textMuted = getCssVar('--txt-muted', '#aaaaaa');
    const goldColor = getCssVar('--txt-gold', '#d4af37');
    const bgColor   = getCssVar('--bg-app', '#1a1a1a'); 
    const options = {
      nodes: {
        font: { color: textColor, size: 14, strokeWidth: 3, strokeColor: bgColor },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 2,
        color: { color: textMuted, highlight: goldColor },
        font: { color: textMuted, size: 11, align: 'middle', strokeWidth: 3, strokeColor: bgColor },
        smooth: { type: 'continuous' }
      },
      // НОВЫЕ ГРУППЫ с разными формами (shape) для визуального отличия макро и микро уровня
      groups: {
        region: { shape: 'hexagon', size: 35, color: { background: '#1A237E', border: '#4A148C' }, font: {size: 18, bold: true} },
        city: { shape: 'dot', size: 25, color: { background: '#2B5B84', border: '#4A90E2' }, font: {size: 16, bold: true} },
        street: { shape: 'dot', size: 15, color: { background: '#546E7A', border: '#78909C' } },
        building: { shape: 'triangle', size: 20, color: { background: '#8D6E63', border: '#D7CCC8' } },
        room: { shape: 'box', color: { background: '#5D4037', border: '#A1887F' }, margin: 10 },
        nature: { shape: 'dot', size: 20, color: { background: '#2E5C31', border: '#4CAF50' } },
        dungeon: { shape: 'triangleDown', size: 25, color: { background: '#424242', border: '#BDBDBD' }, font: {bold: true} },
        dungeon_room: { shape: 'box', color: { background: '#212121', border: '#757575' }, margin: 10 },
        unknown: { shape: 'ellipse', color: { background: '#555555', border: '#aaaaaa' } }
      },
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { 
          gravitationalConstant: -70, // Сильнее отталкивание
          centralGravity: 0.005, 
          springLength: 120, // Длиннее связи
          springConstant: 0.04
        }
      },
      interaction: { hover: true, tooltipDelay: 200 }
    };
    network = new Network(mapContainer, mapData, options);
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = mapData.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          selectedNodeInfo = { label: node.label, description: node.description || 'Описание отсутствует.' };
        }
      } else {
        selectedNodeInfo = null;
      }
    });
  }
</script>

<div class="modal-panel map-modal">
  <div class="modal-header">
    <h3><i class="fas fa-map-marked-alt"></i> Карта мира</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  <div class="tab-content-area map-content">
    {#if loading}
      <div class="panel-placeholder"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>
    {:else if !mapData}
      <div class="panel-placeholder">
        <i class="fas fa-compass" style="font-size: 3rem; margin-bottom: 1rem; color: var(--txt-muted);"></i>
        <p>Карта для этой истории еще не создана.</p>
        <button class="btn-primary" style="margin-top: 1rem;" onclick={handleGenerateMap} disabled={generating}>
          {#if generating}
            <i class="fas fa-spinner fa-spin"></i> Исследование мира...
          {:else}
            <i class="fas fa-magic"></i> Сгенерировать карту (AI)
          {/if}
        </button>
        {#if error}<p class="error-text">{error}</p>{/if}
      </div>
    {:else}
      <div class="map-toolbar">
        <button class="btn-secondary btn-sm" onclick={handleGenerateMap} disabled={generating}>
          <i class="fas fa-sync-alt" class:fa-spin={generating}></i> Обновить карту
        </button>
        <span class="hint">Скролл — масштаб, мышь — перемещение</span>
      </div>
      <div class="vis-container" bind:this={mapContainer}></div>
      <div class="node-info-panel" class:visible={selectedNodeInfo !== null}>
        {#if selectedNodeInfo}
          <h4>{selectedNodeInfo.label}</h4>
          <p>{selectedNodeInfo.description}</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .map-modal {
    max-width: 900px;
    width: 95vw;
    height: 85vh;
    display: flex;
    flex-direction: column;
  }
  
  .map-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0; /* Убираем падинг для карты на весь экран */
    position: relative;
    overflow: hidden;
  }

  .map-toolbar {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-surface-2);
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-md);
  }

  .map-toolbar .hint {
    font-size: var(--font-size-xs);
    color: var(--txt-muted);
  }

  .vis-container {
    flex: 1;
    width: 100%;
    height: 100%;
    background: var(--bg-app); 
    /* Едва заметная сетка на фоне, чтобы легче было ориентироваться в пространстве */
    background-image: radial-gradient(var(--bg-surface-3) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Панель информации, выезжающая снизу */
  .node-info-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--glass-bg-heavy);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--txt-gold);
    padding: var(--space-4);
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 10;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  }

  .node-info-panel.visible {
    transform: translateY(0);
  }

  .node-info-panel h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--txt-gold);
  }

  .node-info-panel p {
    margin: 0;
    color: var(--txt-primary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .error-text {
    color: var(--state-error);
    margin-top: 1rem;
    font-size: var(--font-size-sm);
  }
</style>