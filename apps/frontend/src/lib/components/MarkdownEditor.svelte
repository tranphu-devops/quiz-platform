<script>
  import { marked } from 'marked'

  let { value = $bindable(''), placeholder = 'Nhập nội dung markdown...', rows = 5 } = $props()

  let mode = $state('write')
  const html = $derived(marked(value || ''))
</script>

<style>
  .md-editor { border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
  .tabs { display: flex; border-bottom: 1px solid #d1d5db; background: #f9fafb; }
  .tab { padding: 0.35rem 0.85rem; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: #6b7280; }
  .tab.active { color: #1e40af; border-bottom: 2px solid #1e40af; font-weight: 500; }
  textarea { width: 100%; border: none; outline: none; padding: 0.6rem 0.75rem; font-size: 0.95rem; resize: vertical; font-family: inherit; box-sizing: border-box; min-height: 80px; }
  .preview { padding: 0.6rem 0.75rem; min-height: 80px; font-size: 0.95rem; line-height: 1.6; }
  .preview :global(p) { margin: 0 0 0.5rem; }
  .preview :global(ul), .preview :global(ol) { padding-left: 1.5rem; margin: 0 0 0.5rem; }
  .preview :global(code) { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
  .preview :global(pre) { background: #f3f4f6; padding: 0.75rem; border-radius: 6px; overflow-x: auto; }
  .preview :global(strong) { font-weight: 600; }
  .empty { color: #9ca3af; font-style: italic; }
</style>

<div class="md-editor">
  <div class="tabs">
    <button type="button" class="tab" class:active={mode === 'write'} onclick={() => mode = 'write'}>Soạn thảo</button>
    <button type="button" class="tab" class:active={mode === 'preview'} onclick={() => mode = 'preview'}>Xem trước</button>
  </div>
  {#if mode === 'write'}
    <textarea bind:value {rows} {placeholder}></textarea>
  {:else}
    <div class="preview">
      {#if value}
        {@html html}
      {:else}
        <span class="empty">Chưa có nội dung</span>
      {/if}
    </div>
  {/if}
</div>
