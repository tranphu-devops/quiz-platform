<script>
  let {
    file = $bindable(null),
    accept = '.pdf,.docx,.txt',
    hint = '',
    hintReplace = '',
    clearLabel = ''
  } = $props()

  let fileInput

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (f) file = f
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) file = f
  }

  function clear() {
    file = null
    if (fileInput) fileInput.value = ''
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
</script>

<div class="upload-wrap">
  {#if file}
    <div class="file-chip">
      <span class="file-name">{file.name}</span>
      <span class="file-size">{formatSize(file.size)}</span>
      <button type="button" class="btn-clear" onclick={clear}>{clearLabel}</button>
    </div>
  {/if}

  <div
    class="drop-zone"
    ondragover={(e) => e.preventDefault()}
    ondrop={handleDrop}
    role="button"
    tabindex="0"
  >
    <input
      type="file"
      {accept}
      onchange={handleFile}
      bind:this={fileInput}
    />
    <span class="hint">{file ? hintReplace : hint}</span>
  </div>
</div>

<style>
  .upload-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
  .drop-zone {
    border: 2px dashed var(--ix-border, #d1d5db); border-radius: 10px; padding: 1.5rem 1rem;
    text-align: center; cursor: pointer; transition: border-color 0.15s;
    background: var(--ix-bg-surface, #fafafa); position: relative;
  }
  .drop-zone:hover { border-color: var(--primary); }
  .drop-zone input[type=file] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
  }
  .hint { font-size: 0.85rem; color: var(--ix-text-secondary, #6b7280); }
  .file-chip {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
    border: 1px solid var(--ix-border, #d1d5db); border-radius: 8px;
    background: var(--ix-bg-surface, #fafafa); font-size: 0.85rem;
  }
  .file-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .file-size { color: var(--ix-text-secondary, #6b7280); flex-shrink: 0; }
  .btn-clear {
    background: #fee2e2; color: #dc2626; border: none; border-radius: 4px;
    padding: 0.2rem 0.5rem; font-size: 0.78rem; cursor: pointer; flex-shrink: 0;
  }
</style>
