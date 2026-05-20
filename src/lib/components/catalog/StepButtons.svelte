<script lang="ts">
  let { step = 1, total = 5, canProceed = false, onBack, onNext, onStart }: 
  { step?: number; total?: number; canProceed?: boolean; onBack?: () => void; onNext?: () => void; onStart?: () => void; } = $props();
</script>

<div class="step-buttons">
  {#if step > 1}
    <button class="step-btn step-btn-back" type="button" onclick={onBack}>
      <i class="fas fa-arrow-left"></i> Назад
    </button>
  {/if}

  {#if step < total}
    <button class="step-btn step-btn-next" type="button" disabled={!canProceed} onclick={() => canProceed && onNext?.()}>
      Далее <i class="fas fa-arrow-right"></i>
    </button>
  {:else}
    <button class="step-btn step-btn-start" type="button" disabled={!canProceed} onclick={() => canProceed && onStart?.()}>
      <i class="fas fa-comments"></i> Начать историю
    </button>
  {/if}
</div>