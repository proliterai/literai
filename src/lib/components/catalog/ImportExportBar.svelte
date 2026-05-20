<script lang="ts">
  let { onExport, onImport }: { onExport?: () => void; onImport?: (f: File) => void; } = $props();
  let fileEl = $state<HTMLInputElement>();
</script>

<div class="import-export-bar">
  <button class="ie-btn" type="button" onclick={onExport}><i class="fas fa-file-export"></i> Экспорт</button>
  <button class="ie-btn" type="button" onclick={() => fileEl?.click()}><i class="fas fa-file-import"></i> Импорт</button>
  <input
    bind:this={fileEl}
    type="file" accept=".json" style="display:none"
    onchange={(e) => {
      const f = e.currentTarget.files?.[0];
      if (f) onImport?.(f);
      e.currentTarget.value = '';
    }}
  />
</div>