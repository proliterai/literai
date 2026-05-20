<script lang="ts">
  import { ui } from '$lib/ui/ui.store';
</script>

<div class="modal-panel provider-help-modal">
  <div class="modal-header">
    <h3><i class="fas fa-question-circle"></i> Справка по API Провайдерам</h3>
    <button class="modal-close-btn" aria-label="Закрыть" onclick={() => ui.closeModal()}>
      <i class="fas fa-times"></i>
    </button>
  </div>
  
  <div class="tab-content-area custom-scrollbar">
    <div class="help-section">
      <h4>Что такое API?</h4>
      <p>
        <strong>API (Application Programming Interface)</strong> — это способ, с помощью которого LiterAI общается с удалёнными нейросетями. Приложение отправляет текст вашей истории на сервер провайдера, а провайдер возвращает сгенерированное продолжение.
      </p>
    </div>

    <div class="help-section">
      <h4>Как добавить модель (формат OpenAI)</h4>
      <p>
        Большинство современных сервисов (OpenRouter, Together AI, LM Studio, Ollama) поддерживают формат OpenAI. Для их подключения заполните три поля:
      </p>
      
      <ul class="help-list">
        <li>
          <strong>Название:</strong> Любое удобное для вас имя (например, <i>Мой OpenRouter</i>).
        </li>
        <li>
          <strong>URL API:</strong> Адрес сервера провайдера. Для совместимых с OpenAI он чаще всего заканчивается на <code>/v1</code> или <code>/v1/chat/completions</code>.<br>
          <small>Пример OpenRouter: <code>https://openrouter.ai/api/v1/chat/completions</code></small><br>
<small>Пример LM Studio: <code>http://localhost:1234/v1/chat/completions</code></small><br>
          <small>Пример локальной Ollama: <code>http://localhost:11434/v1/chat/completions</code></small>
        </li>
        <li>
          <strong>Модель:</strong> Точное системное название модели у провайдера.<br>
          <small>Примеры: <code>gpt-4o</code>, <code>anthropic/claude-3.5-sonnet</code>, <code>meta-llama/llama-3-8b-instruct</code></small>
        </li>
        <li>
          <strong>API Key (Ключ):</strong> Ваш секретный ключ доступа, который вы получаете в личном кабинете провайдера (начинается с <code>sk-...</code>). 
          
          <!-- ДОБАВЛЕННАЯ ССЫЛКА ЗДЕСЬ -->
          <a 
            href="https://blog.literai.ru/poluchite-svoy-klyuch-dlya-zapuska-chata/" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="help-external-link"
          >
            <i class="fas fa-external-link-alt"></i> Инструкция: Как получить свои API ключи
          </a>
          
          <small>Для локальных сетей (Ollama/LM Studio) обычно можно вписать любое слово (например, <code>sk-123</code>).</small>
        </li>
      </ul>
    </div>
    
    <div class="help-info-box">
      <i class="fas fa-lightbulb"></i>
      <span>После добавления не забудьте нажать <b>"Проверить соединение"</b>, чтобы убедиться, что все данные введены верно.</span>
    </div>
  </div>
</div>

<style>
  .provider-help-modal {
    max-width: 600px;
  }
  .help-section {
    margin-bottom: var(--space-5);
  }
  .help-section h4 {
    color: var(--txt-gold);
    margin-bottom: var(--space-2);
    font-size: var(--font-size-md);
  }
  .help-section p {
    color: var(--txt-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--leading-relaxed);
  }
  .help-list {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .help-list li {
    background: var(--bg-surface-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    color: var(--txt-primary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }
  .help-list strong {
    color: var(--txt-gold-light);
  }
  .help-list code {
    color: var(--state-success);
    background: var(--bg-surface-4);
    padding: 2px 4px;
    border-radius: 4px;
  }
  .help-list small {
    display: block;
    color: var(--txt-muted);
    margin-top: 4px;
  }

  /* СТИЛИ ДЛЯ НОВОЙ ССЫЛКИ */
  .help-external-link {
    display: inline-block;
    margin: var(--space-2) 0;
    color: var(--txt-gold);
    text-decoration: none;
    font-weight: bold;
    font-size: 0.95em;
    transition: color 0.2s ease;
  }
  .help-external-link:hover {
    color: var(--txt-gold-light);
    text-decoration: underline;
  }
  .help-external-link i {
    font-size: 0.9em;
    margin-right: 4px;
  }
  /* Конец стилей для ссылки */

  .help-info-box {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--state-info-bg);
    border: 1px solid var(--state-info);
    border-radius: var(--radius-md);
    color: var(--state-info);
    font-size: var(--font-size-sm);
  }
</style>