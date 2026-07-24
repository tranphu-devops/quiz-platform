<script>
  import { onMount } from 'svelte'
  import { systemApi } from '$lib/api'
  import { t } from '$lib/i18n'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'

  let data = $state(null)
  let loading = $state(true)
  let error = $state('')

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
    try {
      const res = await systemApi.getDatabase()
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'error')
      data = json
      error = ''
    } catch {
      error = $t('admin.systemLoadError')
    } finally {
      loading = false
    }
  }

  onMount(load)
</script>

<Card title={$t('admin.systemDatabaseTitle')} subtitle={$t('admin.systemDatabaseSubtitle')}>
  <div class="toolbar">
    <Button variant="secondary" size="sm" onclick={load} disabled={loading}>{$t('admin.systemRefresh')}</Button>
  </div>

  {#if loading}
    <p class="state-msg">{$t('common.loading')}</p>
  {:else if error}
    <p class="state-msg error">{error}</p>
  {:else if data}
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-num">{formatBytes(data.databaseSizeBytes)}</span>
        <span class="stat-lbl">{$t('admin.systemDbSize')}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-num">{data.connections.total}</span>
        <span class="stat-lbl">{$t('admin.systemDbConnections')}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-num">{data.pool.totalCount}</span>
        <span class="stat-lbl">{$t('admin.systemPoolSize')}</span>
      </div>
    </div>

    <h4 class="section-title">{$t('admin.systemDbSchemas')}</h4>
    <div class="table-wrap">
      <table class="sys-table">
        <thead>
          <tr>
            <th>{$t('admin.systemDbSchemas')}</th>
            <th>{$t('admin.systemDbSize')}</th>
          </tr>
        </thead>
        <tbody>
          {#each data.schemas as s (s.schema)}
            <tr>
              <td>{s.schema}</td>
              <td>{formatBytes(s.bytes)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <h4 class="section-title">{$t('admin.systemDbMigrations')}</h4>
    {#if !data.recentMigrations.length}
      <p class="hint">{$t('admin.systemDbNoMigrations')}</p>
    {:else}
      <div class="table-wrap">
        <table class="sys-table">
          <thead>
            <tr>
              <th>{$t('admin.systemDbMigrations')}</th>
              <th>{$t('admin.systemDbAppliedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.recentMigrations as m (m.filename)}
              <tr>
                <td>{m.filename}</td>
                <td>{new Date(m.appliedAt).toLocaleString()}</td>
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
  .hint { font-size: 12px; color: var(--ix-text-muted); }

  .stats-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .stat-item { display: flex; flex-direction: column; gap: 2px; }
  .stat-num { font-size: 20px; font-weight: 700; color: var(--ix-text-primary); }
  .stat-lbl { font-size: 12px; color: var(--ix-text-muted); }
  .stat-sep { width: 1px; height: 30px; background: var(--ix-border); }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ix-text-primary);
    margin: 20px 0 8px;
  }

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
  }
</style>
