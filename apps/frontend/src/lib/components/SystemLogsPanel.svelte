<script>
  import { systemApi } from '$lib/api'
  import { t } from '$lib/i18n'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'

  // Mirrors KNOWN_SERVICES in apps/user-service/src/lib/systemHealth.js.
  const SERVICES = [
    'user-service', 'exam-service', 'submission-service',
    'interaction-service', 'generator-service', 'notification-service', 'grader-service'
  ]
  const PINO_LEVELS = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' }

  let service = $state(SERVICES[0])
  let tail = $state(200)
  let lines = $state([])
  let loading = $state(false)
  let error = $state('')
  let loaded = $state(false)

  async function refresh() {
    loading = true
    error = ''
    try {
      const res = await systemApi.getLogs(service, tail)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'error')
      lines = json.lines
    } catch {
      error = $t('admin.systemLoadError')
    } finally {
      loading = false
      loaded = true
    }
  }

  function levelLabel(line) {
    if (!line.parsed) return null
    return PINO_LEVELS[line.parsed.level] || line.parsed.level
  }
</script>

<Card title={$t('admin.systemLogsTitle')} subtitle={$t('admin.systemLogsSubtitle')}>
  <div class="toolbar">
    <select bind:value={service}>
      {#each SERVICES as s}<option value={s}>{s}</option>{/each}
    </select>
    <select bind:value={tail}>
      <option value={100}>100</option>
      <option value={200}>200</option>
      <option value={500}>500</option>
      <option value={1000}>1000</option>
    </select>
    <Button variant="secondary" size="sm" onclick={refresh} loading={loading} disabled={loading}>
      {$t('admin.systemRefresh')}
    </Button>
  </div>

  {#if error}
    <p class="state-msg error">{error}</p>
  {:else if !loaded}
    <p class="hint">{$t('admin.systemLogsHint')}</p>
  {:else if !lines.length}
    <p class="hint">{$t('admin.systemLogsEmpty')}</p>
  {:else}
    <div class="log-view">
      {#each lines as line, i (i)}
        <div class="log-line" class:stderr={line.stream === 'stderr'}>
          {#if line.parsed}
            <span class="lvl lvl--{levelLabel(line)}">{levelLabel(line)}</span>
            {#if line.parsed.time}<span class="time">{new Date(line.parsed.time).toLocaleTimeString()}</span>{/if}
            <span class="msg">{line.parsed.msg ?? JSON.stringify(line.parsed)}</span>
          {:else}
            <span class="msg raw">{line.raw}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Card>

<style>
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .toolbar select {
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--ix-bg-surface);
    color: var(--ix-text-primary);
  }

  .state-msg { font-size: 14px; }
  .state-msg.error { color: var(--danger); }
  .hint { font-size: 12px; color: var(--ix-text-muted); }

  .log-view {
    background: var(--ix-bg-app);
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    padding: 10px 12px;
    max-height: 480px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .log-line {
    display: flex;
    gap: 8px;
    padding: 2px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .log-line.stderr { color: var(--danger); }

  .lvl { flex-shrink: 0; font-weight: 700; text-transform: uppercase; width: 42px; }
  .lvl--info { color: var(--success); }
  .lvl--warn { color: var(--warning); }
  .lvl--error, .lvl--fatal { color: var(--danger); }
  .lvl--debug, .lvl--trace { color: var(--ix-text-muted); }

  .time { flex-shrink: 0; color: var(--ix-text-muted); }
  .msg { flex: 1; }
  .msg.raw { color: var(--ix-text-secondary); }
</style>
