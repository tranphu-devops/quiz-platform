<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { generatorApi } from '$lib/api'
  import { t, locale, localeCode } from '$lib/i18n'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'

  let loading = $state(true)
  let jobs = $state([])
  let expanded = $state(new Set())

  function fmtDate(s) {
    return s ? new Date(s).toLocaleString(localeCode($locale)) : '—'
  }

  function toggle(id) {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    expanded = next
  }

  function statusLabel(status) {
    if (status === 'completed') return $t('generatorJobs.statusCompleted')
    if (status === 'failed') return $t('generatorJobs.statusFailed')
    return $t('generatorJobs.statusProcessing')
  }

  onMount(async () => {
    if (!$user || $user.role === 'student') { goto('/exams'); return }
    try {
      const res = await generatorApi.listJobs()
      if (res.ok) jobs = await res.json()
    } catch {
      // non-fatal — list just stays empty
    } finally {
      loading = false
    }
  })
</script>

<PageHeader title={$t('generatorJobs.pageTitle')} subtitle={$t('generatorJobs.pageSubtitle')} />

{#if loading}
  <p class="ix-loading">{$t('common.loading')}</p>
{:else}
  <Card>
    {#if jobs.length === 0}
      <p class="jobs-empty">{$t('generatorJobs.noJobs')}</p>
    {:else}
      <div class="job-list">
        {#each jobs as j (j.id)}
          <div class="job-row">
            <div class="job-head">
              <span class="job-status job-status--{j.status}">{statusLabel(j.status)}</span>
              <span class="job-filename">{j.source_filename ?? '—'}</span>
              <span class="job-date">{fmtDate(j.created_at)}</span>
            </div>
            <div class="job-sub">
              {$t('generatorJobs.model')}: <code>{j.model}</code> ·
              {$t('generatorJobs.keySource')}: {j.key_source === 'platform' ? $t('generator.keySourcePlatformShort') : $t('generator.keySourceOwnShort')}
              {#if j.question_count}· {$t('generatorJobs.questionCount')}: {j.question_count}{/if}
              {#if j.credits_charged}· {$t('generatorJobs.creditsCharged')}: {j.credits_charged}{/if}
            </div>

            {#if j.status === 'completed' && j.exam_id}
              <a class="job-link" href="/exams/{j.exam_id}/edit">{$t('generatorJobs.viewExam')}</a>
            {/if}

            {#if j.status === 'failed'}
              <p class="job-error">{j.error_message}</p>
              {#if j.error_detail}
                <button type="button" class="link-btn" onclick={() => toggle(j.id)}>
                  {expanded.has(j.id) ? $t('generatorJobs.hideDetail') : $t('generatorJobs.showDetail')}
                </button>
                {#if expanded.has(j.id)}
                  <pre class="job-detail">{JSON.stringify(j.error_detail, null, 2)}</pre>
                {/if}
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>
{/if}

<style>
  .ix-loading { font-size: 14px; color: var(--ix-text-muted); }
  .jobs-empty { font-size: 0.9rem; color: var(--text-muted, #6b6a80); margin: 8px 0; }

  .job-list { display: flex; flex-direction: column; gap: 12px; }
  .job-row { border: 1px solid var(--border); border-radius: var(--radius-btn, 10px); padding: 12px 14px; }
  .job-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .job-filename { font-weight: 600; }
  .job-date { font-size: 0.8rem; color: var(--text-muted, #6b6a80); margin-left: auto; }
  .job-sub { font-size: 0.82rem; color: var(--text-muted, #6b6a80); margin-top: 6px; }
  .job-sub code { font-family: 'JetBrains Mono', monospace; font-size: 0.82em; }
  .job-link { display: inline-block; margin-top: 8px; font-size: 0.85rem; color: var(--primary); text-decoration: underline; }
  .job-error { color: var(--danger); font-size: 0.85rem; margin: 8px 0 0; }

  .job-status { font-size: 0.72rem; font-weight: 600; padding: 2px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.02em; }
  .job-status--completed { background: rgba(22,163,74,0.12); color: #16a34a; }
  .job-status--failed { background: rgba(239,68,68,0.12); color: var(--danger); }
  .job-status--processing { background: rgba(107,114,128,0.12); color: #6b7280; }

  .link-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 0; font-size: 0.82rem; text-decoration: underline; margin-top: 6px; }
  .job-detail {
    margin-top: 8px; padding: 10px 12px; background: var(--ix-bg-app, #f8f7ff);
    border: 1px solid var(--border); border-radius: 8px; font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
  }
</style>
