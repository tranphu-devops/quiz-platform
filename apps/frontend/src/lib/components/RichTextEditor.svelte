<script>
  import { sanitizeHtml } from '$lib/sanitizeHtml'
  import { t as t18n } from '$lib/i18n'

  let { value = $bindable(''), placeholder = '' } = $props()

  let el = $state(null)
  const effectivePlaceholder = $derived(placeholder || $t18n('richTextEditor.placeholder'))

  // Keep the contenteditable in sync with external value changes (async load,
  // programmatic reset) without clobbering the caret while the user is typing.
  $effect(() => {
    const v = value ?? ''
    if (el && document.activeElement !== el && el.innerHTML !== v) {
      el.innerHTML = v
    }
  })

  function exec(cmd, arg = null) {
    el?.focus()
    document.execCommand(cmd, false, arg)
    value = el.innerHTML
  }

  function addLink() {
    const url = window.prompt($t18n('richTextEditor.linkPrompt'), 'https://')
    if (url && /^https?:\/\//i.test(url)) exec('createLink', url)
  }

  function onInput() { value = el.innerHTML }
  function onBlur() { value = sanitizeHtml(el.innerHTML); el.innerHTML = value }

  const tools = $derived([
    { cmd: 'bold', label: 'B', title: $t18n('richTextEditor.bold'), style: 'font-weight:800' },
    { cmd: 'italic', label: 'I', title: $t18n('richTextEditor.italic'), style: 'font-style:italic' },
    { cmd: 'underline', label: 'U', title: $t18n('richTextEditor.underline'), style: 'text-decoration:underline' },
    { cmd: 'strikeThrough', label: 'S', title: $t18n('richTextEditor.strikethrough'), style: 'text-decoration:line-through' }
  ])
</script>

<div class="rte">
  <div class="rte-toolbar">
    {#each tools as tool}
      <button type="button" class="rte-btn" title={tool.title} style={tool.style}
        onmousedown={(e) => e.preventDefault()} onclick={() => exec(tool.cmd)}>{tool.label}</button>
    {/each}
    <span class="rte-sep"></span>
    <button type="button" class="rte-btn" title={$t18n('richTextEditor.bulletList')}
      onmousedown={(e) => e.preventDefault()} onclick={() => exec('insertUnorderedList')}>• ≡</button>
    <button type="button" class="rte-btn" title={$t18n('richTextEditor.numberedList')}
      onmousedown={(e) => e.preventDefault()} onclick={() => exec('insertOrderedList')}>1. ≡</button>
    <span class="rte-sep"></span>
    <button type="button" class="rte-btn" title={$t18n('richTextEditor.insertLink')}
      onmousedown={(e) => e.preventDefault()} onclick={addLink}>🔗</button>
    <button type="button" class="rte-btn" title={$t18n('richTextEditor.clearFormat')}
      onmousedown={(e) => e.preventDefault()} onclick={() => exec('removeFormat')}>✕</button>
  </div>
  <div
    bind:this={el}
    class="rte-editor"
    contenteditable="true"
    role="textbox"
    tabindex="0"
    aria-multiline="true"
    data-placeholder={effectivePlaceholder}
    oninput={onInput}
    onblur={onBlur}
  ></div>
</div>

<style>
  .rte { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
  .rte:focus-within { border-color: var(--primary); }
  .rte-toolbar {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
    padding: 5px 6px; background: var(--bg); border-bottom: 1px solid var(--border);
  }
  .rte-btn {
    min-width: 30px; height: 28px; padding: 0 7px; border: none; background: transparent;
    color: var(--text); border-radius: 6px; cursor: pointer; font-size: 0.85rem;
    font-family: inherit; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.12s;
  }
  .rte-btn:hover { background: var(--primary-light); color: var(--primary); }
  .rte-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; }
  .rte-editor {
    min-height: 96px; max-height: 320px; overflow-y: auto;
    padding: 0.65rem 0.8rem; font-size: 0.92rem; line-height: 1.6; color: var(--text);
    outline: none;
  }
  .rte-editor:empty::before {
    content: attr(data-placeholder); color: var(--muted); pointer-events: none;
  }
  .rte-editor :global(p) { margin: 0 0 0.5rem; }
  .rte-editor :global(p:last-child) { margin-bottom: 0; }
  .rte-editor :global(ul), .rte-editor :global(ol) { margin: 0 0 0.5rem; padding-left: 1.4rem; }
  .rte-editor :global(a) { color: var(--primary); text-decoration: underline; }
  .rte-editor :global(strong), .rte-editor :global(b) { font-weight: 700; }
</style>
