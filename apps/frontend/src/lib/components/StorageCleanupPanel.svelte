<script>
  import { onMount } from 'svelte'
  import { storageApi } from '$lib/api'
  import { t } from '$lib/i18n'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'

  let data = $state(null)
  let loading = $state(true)
  let error = $state('')
  let selected = $state(new Set())
  let deleting = $state(false)
  let deleteError = $state('')
  let deleteSuccess = $state('')

  function formatBytes(bytes) {
    if (bytes == null) return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
    return `${n.toFixed(1)} ${units[i]}`
  }

  async function load() {
    loading = true
    deleteSuccess = ''
    try {
      const res = await storageApi.getOrphans()
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'error')
      data = json
      selected = new Set()
      error = ''
    } catch {
      error = $t('admin.systemLoadError')
    } finally {
      loading = false
    }
  }

  onMount(load)

  function toggle(key) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selected = next
  }

  function toggleAll() {
    if (!data) return
    selected = selected.size === data.orphans.length ? new Set() : new Set(data.orphans.map(o => o.key))
  }

  let selectedBytes = $derived(
    data ? data.orphans.filter(o => selected.has(o.key)).reduce((sum, o) => sum + o.size, 0) : 0
  )

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm($t('admin.storageConfirmDelete').replace('{n}', selected.size))) return

    deleting = true
    deleteError = ''
    deleteSuccess = ''
    try {
      const res = await storageApi.deleteOrphans([...selected])
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'error')
      deleteSuccess = $t('admin.storageDeleteSuccess').replace('{n}', json.deleted.length)
      await load()
    } catch {
      deleteError = $t('admin.storageDeleteError')
    } finally {
      deleting = false
    }
  }
</script>

<Card title={$t('admin.storageCleanupTitle')} subtitle={$t('admin.storageCleanupSubtitle')}>
  <div class="toolbar">
    <Button variant="secondary" size="sm" onclick={load} disabled={loading || deleting}>{$t('admin.systemRefresh')}</Button>
  </div>

  {#if loading}
    <p class="state-msg">{$t('common.loading')}</p>
  {:else if error}
    <p class="state-msg error">{error}</p>
  {:else if data}
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-num">{data.summary.totalObjects}</span>
        <span class="stat-lbl">{$t('admin.storageTotalObjects')}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-num">{formatBytes(data.summary.totalBytes)}</span>
        <span class="stat-lbl">{$t('admin.storageTotalSize')}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-num" style="color: var(--danger)">{data.summary.orphanCount}</span>
        <span class="stat-lbl">{$t('admin.storageOrphanCount')}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-num" style="color: var(--danger)">{formatBytes(data.summary.orphanBytes)}</span>
        <span class="stat-lbl">{$t('admin.storageOrphanSize')}</span>
      </div>
      {#if data.summary.tooRecentCount > 0}
        <div class="stat-sep"></div>
        <div class="stat-item">
          <span class="stat-num">{data.summary.tooRecentCount}</span>
          <span class="stat-lbl">{$t('admin.storageTooRecent')}</span>
        </div>
      {/if}
    </div>

    <p class="hint">{$t('admin.storageSafetyNote').replace('{h}', data.summary.minAgeHours)}</p>

    {#if deleteError}<p class="state-msg error">{deleteError}</p>{/if}
    {#if deleteSuccess}<p class="state-msg success">{deleteSuccess}</p>{/if}

    {#if !data.orphans.length}
      <p class="hint">{$t('admin.storageNoOrphans')}</p>
    {:else}
      <div class="list-toolbar">
        <label class="select-all">
          <input type="checkbox" checked={selected.size === data.orphans.length} onchange={toggleAll} />
          {$t('admin.storageSelectAll')}
        </label>
        <Button variant="danger" size="sm" disabled={selected.size === 0 || deleting} onclick={deleteSelected}>
          {deleting ? $t('common.loading') : $t('admin.storageDeleteSelected').replace('{n}', selected.size).replace('{size}', formatBytes(selectedBytes))}
        </Button>
      </div>

      <div class="table-wrap">
        <table class="sys-table">
          <thead>
            <tr>
              <th></th>
              <th>{$t('admin.storagePreview')}</th>
              <th>{$t('admin.storageKey')}</th>
              <th>{$t('admin.storageSize')}</th>
              <th>{$t('admin.storageLastModified')}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.orphans as o (o.key)}
              <tr>
                <td><input type="checkbox" checked={selected.has(o.key)} onchange={() => toggle(o.key)} /></td>
                <td><img class="thumb" src={o.url} alt="" loading="lazy" /></td>
                <td class="key-cell">{o.key}</td>
                <td>{formatBytes(o.size)}</td>
                <td>{new Date(o.lastModified).toLocaleString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</Card>

<style>
  .toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
  .state-msg { font-size: 14px; color: var(--ix-text-muted); }
  .state-msg.error { color: var(--danger); }
  .state-msg.success { color: var(--success, #2e7d32); }
  .hint { font-size: 12px; color: var(--ix-text-muted); margin: 0 0 16px; }

  .stats-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .stat-item { display: flex; flex-direction: column; gap: 2px; }
  .stat-num { font-size: 20px; font-weight: 700; color: var(--ix-text-primary); }
  .stat-lbl { font-size: 12px; color: var(--ix-text-muted); }
  .stat-sep { width: 1px; height: 30px; background: var(--ix-border); }

  .list-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .select-all { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ix-text-primary); }

  .table-wrap { overflow-x: auto; }
  .sys-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .sys-table th {
    text-align: left;
    padding: 6px 10px;
    color: var(--ix-text-muted);
    font-weight: 500;
    border-bottom: 1px solid var(--ix-border);
  }
  .sys-table td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--ix-border);
    color: var(--ix-text-primary);
    vertical-align: middle;
  }
  .key-cell { font-family: monospace; font-size: 12px; word-break: break-all; }
  .thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--ix-border);
    display: block;
  }
</style>
