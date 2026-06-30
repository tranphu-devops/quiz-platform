<script>
  import { uploadApi } from '$lib/api'

  let {
    value = $bindable(''),
    type = 'avatar',
    label = 'Ảnh',
    placeholder = 'Chưa có ảnh',
    previewClass = ''
  } = $props()

  let uploading = $state(false)
  let error = $state('')
  let fileInput

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    error = ''
    uploading = true
    const oldUrl = value || null
    try {
      const res = await uploadApi.upload(file, type, oldUrl)
      const data = await res.json()
      if (!res.ok) { error = data.error ?? 'Upload thất bại'; return }
      value = data.url
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      uploading = false
      if (fileInput) fileInput.value = ''
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    handleFile({ target: { files: [file] } })
  }
</script>

<style>
  .upload-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
  .drop-zone {
    border: 2px dashed #d1d5db; border-radius: 8px; padding: 1rem;
    text-align: center; cursor: pointer; transition: border-color 0.15s;
    background: #fafafa; position: relative;
  }
  .drop-zone:hover { border-color: #1e40af; }
  .drop-zone input[type=file] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
  }
  .preview { max-width: 100%; max-height: 200px; border-radius: 6px; object-fit: cover; display: block; margin: 0 auto 0.5rem; }
  .preview-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 0.5rem; }
  .preview-avatar-lg { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 0.75rem; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .hint { font-size: 0.8rem; color: #6b7280; }
  .error { font-size: 0.8rem; color: #dc2626; }
  .btn-clear { background: #fee2e2; color: #dc2626; border: none; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; cursor: pointer; }
  .uploading { color: #1e40af; font-size: 0.85rem; }
</style>

<div class="upload-wrap">
  {#if value}
    <img
      src={value}
      alt={label}
      class={previewClass || (type === 'avatar' ? 'preview-avatar' : 'preview')}
    />
    <button type="button" class="btn-clear" onclick={() => { value = '' }}>Xoá ảnh</button>
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
      accept="image/*"
      onchange={handleFile}
      disabled={uploading}
      bind:this={fileInput}
    />
    {#if uploading}
      <span class="uploading">Đang tải lên...</span>
    {:else}
      <span class="hint">{value ? 'Nhấn hoặc kéo thả để thay ảnh' : `Nhấn hoặc kéo thả ${label}`}</span>
    {/if}
  </div>

  {#if error}<p class="error">{error}</p>{/if}
</div>
