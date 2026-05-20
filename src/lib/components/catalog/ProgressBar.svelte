<script lang="ts">
  let { total = 5, current = 1, selected = {}, onPick }: 
  { total?: number; current?: number; selected?: Record<number, any>; onPick?: (s: number) => void; } = $props();

  function canJump(to: number) {
    if (to <= current) return true;
    return to === current + 1 && !!selected[current];
  }
</script>

<div class="progress-bar">
  {#each Array(total) as _, idx (idx)}
    {@const step = idx + 1}
    <div
      class="progress-step {step === current ? 'active' : ''} {step < current && selected[step] ? 'completed' : ''}"
      role="button" tabindex="0"
      onclick={() => canJump(step) && onPick?.(step)}
      onkeydown={(e) => e.key === 'Enter' && canJump(step) && onPick?.(step)}
    >
      {step}
    </div>
  {/each}
</div>