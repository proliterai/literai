<script lang="ts">
  let { letters = [], active = null, onPick }: 
  { letters?: string[]; active?: string | null; onPick?: (l: string) => void; } = $props();
</script>

{#if letters.length}
  <div class="alphabet-bar">
    <div class="alphabet-inner">
      {#each letters as l (l)}
        <button class="alpha-btn {active === l ? 'active' : ''}" type="button" onclick={() => onPick?.(l)}>
          {l}
        </button>
      {/each}
    </div>
  </div>
{/if}