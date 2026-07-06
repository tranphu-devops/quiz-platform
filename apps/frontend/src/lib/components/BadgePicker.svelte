<script>
  import presets from '$lib/badge-presets.json'
  import ImageUpload from './ImageUpload.svelte'
  import { t } from '$lib/i18n'

  let { value = $bindable(''), label = '' } = $props()

  const displayLabel = $derived(label || $t('badgePicker.defaultLabel'))

  let tab = $state('presets')
  let customUrl = $state('')

  function pick(url) {
    value = url
  }

  function applyCustom() {
    if (customUrl) value = customUrl
  }
</script>

<style>
  .picker { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
  .tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tab {
    flex: 1; padding: 0.55rem 1rem; font-size: 0.85rem; font-weight: 600;
    background: none; border: none; cursor: pointer; color: var(--muted);
    transition: all 0.15s; border-bottom: 2px solid transparent;
  }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); background: var(--primary-light); }
  .tab-content { padding: 1rem; }

  /* Preset grid */
  .preset-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 0.4rem; max-height: 240px; overflow-y: auto;
  }
  .preset-item {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    padding: 0.3rem; border-radius: 8px; cursor: pointer;
    border: 2px solid transparent; transition: all 0.15s;
  }
  .preset-item:hover { border-color: var(--primary); background: var(--primary-light); }
  .preset-item.selected { border-color: var(--primary); background: var(--primary-light); }
  .preset-item img { width: 40px; height: 40px; border-radius: 50%; }
  .preset-item span { font-size: 0.55rem; color: var(--muted); text-align: center; line-height: 1.2; max-width: 48px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* Preview strip */
  .preview-strip {
    display: flex; align-items: center; gap: 0.75rem;
    margin-top: 0.75rem; padding: 0.65rem 0.75rem;
    background: var(--bg); border-radius: 8px; border: 1px solid var(--border);
  }
  .preview-strip img { width: 48px; height: 48px; border-radius: 50%; }
  .preview-empty { font-size: 0.82rem; color: var(--muted); }
  .preview-name { font-size: 0.85rem; font-weight: 600; }
  .clear-btn {
    margin-left: auto; background: none; border: none;
    color: var(--danger); cursor: pointer; font-size: 0.8rem; padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }
  .clear-btn:hover { background: #fee2e2; }
</style>

<div class="picker">
  <div class="tabs">
    <button class="tab {tab === 'presets' ? 'active' : ''}" onclick={() => tab = 'presets'}>
      🎖 {$t('badgePicker.presetsTab')}
    </button>
    <button class="tab {tab === 'upload' ? 'active' : ''}" onclick={() => tab = 'upload'}>
      📤 {$t('badgePicker.uploadTab')}
    </button>
  </div>

  <div class="tab-content">
    {#if tab === 'presets'}
      <div class="preset-grid">
        {#each presets as p}
          <button class="preset-item {value === p.url ? 'selected' : ''}" onclick={() => pick(p.url)} title={p.name} type="button">
            <img src={p.url} alt={p.name} loading="lazy" />
            <span>{p.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p style="font-size:0.82rem; color:var(--muted); margin-bottom:0.75rem">
        {$t('badgePicker.uploadHint')}
      </p>
      <ImageUpload bind:value={customUrl} type="exam-cover" label="badge" />
      {#if customUrl && customUrl !== value}
        <button type="button" onclick={applyCustom}
          style="margin-top:0.5rem; padding:0.4rem 0.85rem; background:var(--primary); color:#fff; border:none; border-radius:var(--radius-btn); cursor:pointer; font-size:0.85rem; font-weight:600">
          {$t('badgePicker.useThisImage')}
        </button>
      {/if}
    {/if}

    <!-- Selected preview -->
    <div class="preview-strip">
      {#if value}
        <img src={value} alt="badge" />
        <div>
          <div class="preview-name">{$t('badgePicker.selected')}</div>
          <div style="font-size:0.75rem;color:var(--muted);">{presets.find(p => p.url === value)?.name ?? $t('badgePicker.custom')}</div>
        </div>
        <button type="button" class="clear-btn" onclick={() => value = ''}>✕ {$t('badgePicker.deselect')}</button>
      {:else}
        <div class="preview-empty">{$t('badgePicker.noneSelected', { label: displayLabel })}</div>
      {/if}
    </div>
  </div>
</div>
