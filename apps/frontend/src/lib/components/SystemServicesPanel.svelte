<script>
  import { onMount, onDestroy } from 'svelte'
  import { systemApi } from '$lib/api'
  import { t } from '$lib/i18n'
  import Card from '$lib/components/ui/Card.svelte'

  const POLL_MS = 25000

  let services = $state([])
  let loading = $state(true)
  let error = $state('')
  let interval

  async function load() {
    try {
      const res = await systemApi.getServices()
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      services = data.services
      error = ''
    } catch {
      error = $t('admin.systemLoadError')
    } finally {
      loading = false
    }
  }

  function health(svc) {
    if (!svc.container.found) return 'down'
    if (svc.container.status !== 'running') return 'down'
    if (svc.http && svc.http.reachable === false) return 'degraded'
    return 'ok'
  }

  function uptime(startedAt) {
    if (!startedAt) return '—'
    const ms = Date.now() - new Date(startedAt).getTime()
    if (ms < 0) return '—'
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ${mins % 60}m`
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  onMount(() => {
    load()
    interval = setInterval(load, POLL_MS)
  })
  onDestroy(() => clearInterval(interval))
</script>

<Card title={$t('admin.systemServicesTitle')} subtitle={$t('admin.systemServicesSubtitle')}>
  {#if loading}
    <p class="state-msg">{$t('common.loading')}</p>
  {:else if error}
    <p class="state-msg error">{error}</p>
  {:else}
    <div class="service-grid">
      {#each services as svc (svc.name)}
        <div class="service-card">
          <div class="service-head">
            <span class="dot dot--{health(svc)}"></span>
            <span class="service-name">{svc.name}</span>
          </div>
          <div class="service-rows">
            <div class="service-row">
              <span class="k">{$t('admin.systemStatus')}</span>
              <span class="v">{svc.container.found ? svc.container.status : $t('admin.systemNotFound')}</span>
            </div>
            {#if svc.container.found}
              <div class="service-row">
                <span class="k">{$t('admin.systemUptime')}</span>
                <span class="v">{uptime(svc.container.startedAt)}</span>
              </div>
              <div class="service-row">
                <span class="k">{$t('admin.systemRestarts')}</span>
                <span class="v">{svc.container.restartCount}</span>
              </div>
            {/if}
            {#if svc.http}
              <div class="service-row">
                <span class="k">HTTP</span>
                <span class="v" class:ok-text={svc.http.reachable} class:err-text={!svc.http.reachable}>
                  {svc.http.reachable ? $t('admin.systemUp') : $t('admin.systemDown')}
                </span>
              </div>
              {#if svc.http.reachable && svc.http.body?.db}
                <div class="service-row">
                  <span class="k">DB</span>
                  <span class="v" class:ok-text={svc.http.body.db.ok} class:err-text={!svc.http.body.db.ok}>
                    {svc.http.body.db.ok ? $t('admin.systemDbOk') : $t('admin.systemDbError')}
                  </span>
                </div>
              {/if}
            {:else}
              <p class="no-http-hint">{$t('admin.systemNoHttp')}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>

<style>
  .state-msg { font-size: 14px; color: var(--ix-text-muted); }
  .state-msg.error { color: var(--danger); }

  .service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }

  .service-card {
    border: 1px solid var(--ix-border);
    border-radius: 10px;
    padding: 14px;
  }

  .service-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .service-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--ix-text-primary);
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot--ok { background: var(--success); }
  .dot--degraded { background: var(--warning); }
  .dot--down { background: var(--danger); }

  .service-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .service-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .k { color: var(--ix-text-muted); }
  .v { color: var(--ix-text-primary); font-weight: 500; }
  .ok-text { color: var(--success); }
  .err-text { color: var(--danger); }

  .no-http-hint {
    font-size: 11px;
    color: var(--ix-text-muted);
    margin: 4px 0 0;
  }
</style>
