<script lang="ts">
  let { title = 'Подтверждение', message = 'Вы уверены?', confirmText = 'Удалить', onConfirm, onCancel }: 
  { title?: string; message?: string; confirmText?: string; onConfirm?: () => void; onCancel?: () => void; } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={(e) => { if (e.currentTarget === e.target) onCancel?.(); }}>
  <div class="modal-box">
    <div class="modal-header">
      <h3 class="modal-title">{title}</h3>
      <button class="modal-close" type="button" onclick={onCancel}>&times;</button>
    </div>
    <div class="modal-body"><p>{message}</p></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" type="button" onclick={onCancel}>Отмена</button>
      <button class="btn btn-danger" type="button" onclick={onConfirm}>{confirmText}</button>
    </div>
  </div>
</div>