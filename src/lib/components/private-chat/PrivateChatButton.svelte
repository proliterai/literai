<script lang="ts">
  import { privateChatStore } from '$lib/domain/private-chat/privateChat.store';

  function handleClick() {
    privateChatStore.open();
  }
</script>

{#if $privateChatStore.characters.length > 0}
  <button
    class="control-btn small-gray-btn private-chats-btn"
    on:click={handleClick}
    title="Открыть приватные беседы между персонажами"
  >
    <i class="fas fa-comments"></i>
    <span class="footer-btn-label">Приват чаты</span>
  </button>
{/if}

<style>
  /* Если нужно переопределить глобальные стили, можно добавить локальные */
  .private-chats-btn {
    /* можно оставить пустым, если устраивают глобальные */
  }
</style>