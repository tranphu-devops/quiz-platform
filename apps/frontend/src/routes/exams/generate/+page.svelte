<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { generatorApi, userApi } from '$lib/api'
  import { t } from '$lib/i18n'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import DocumentUpload from '$lib/components/DocumentUpload.svelte'

  let file = $state(null)
  let questionCount = $state(15)
  let language = $state('vi')
  let difficulty = $state('medium')
  let keySource = $state('own')
  let model = $state('anthropic/claude-sonnet-5')
  let defaultModel = $state('anthropic/claude-sonnet-5')
  let ownKeyInput = $state('')

  let platformEnabled = $state(false)
  let platformCost = $state(5)
  let savedKey = $state(null) // { id, key_prefix } | null

  let loading = $state(true)
  let submitting = $state(false)
  let error = $state('')

  const DIFFICULTIES = ['easy', 'medium', 'hard']

  onMount(async () => {
    if (!$user || $user.role === 'student') { goto('/exams'); return }
    try {
      const [settingsRes, keysRes] = await Promise.all([
        userApi.getPublicSettings(),
        generatorApi.listKeys()
      ])
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        platformEnabled = s.ai_generation_enabled === 'true'
        platformCost = Number(s.ai_generation_credit_cost ?? 5)
        if (s.ai_generation_default_model) {
          defaultModel = s.ai_generation_default_model
          model = s.ai_generation_default_model
        }
      }
      if (keysRes.ok) {
        const keys = await keysRes.json()
        savedKey = keys[0] ?? null
      }
    } catch {
      // non-fatal — form still usable with defaults
    } finally {
      loading = false
    }
  })

  const POLL_INTERVAL_MS = 3000
  const POLL_MAX_ATTEMPTS = 200 // ~10 min ceiling — safety net, not an expected duration

  // POST /generate returns as soon as the job is queued (202 + job_id) rather
  // than waiting for the LLM call — a slow/third-party model can take well
  // over Cloudflare's own edge timeout (~100s, separate from and shorter than
  // Nginx's 180s proxy_read_timeout), which used to surface as a 524 even
  // though the backend was still working. We poll job status instead.
  async function pollJob(jobId) {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const res = await generatorApi.getJob(jobId)
        if (!res.ok) continue // transient — keep polling
        const job = await res.json()
        if (job.status === 'completed' || job.status === 'failed') return job
      } catch {
        // network hiccup — keep polling
      }
    }
    return null // exceeded POLL_MAX_ATTEMPTS
  }

  async function submit() {
    error = ''
    if (!file) { error = $t('generator.errorNoFile'); return }

    submitting = true
    try {
      if (keySource === 'own' && !savedKey) {
        if (!ownKeyInput.trim()) { error = $t('generator.ownKeyMissing'); return }
        const saveRes = await generatorApi.saveKey(ownKeyInput.trim())
        if (!saveRes.ok) {
          const d = await saveRes.json().catch(() => ({}))
          error = d.error ?? $t('generator.errorGeneric')
          return
        }
        savedKey = await saveRes.json()
        ownKeyInput = ''
      }

      const res = await generatorApi.generate(file, {
        question_count: questionCount,
        language,
        difficulty,
        key_source: keySource,
        model
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        error = d.error ?? $t('generator.errorGeneric')
        return
      }
      const { job_id } = await res.json()

      const job = await pollJob(job_id)
      if (!job) {
        error = $t('generator.pollTimeout')
        return
      }
      if (job.status === 'failed') {
        error = job.error_message ?? $t('generator.errorGeneric')
        return
      }
      alert($t('generator.successToast'))
      goto(`/exams/${job.exam_id}/edit`)
    } catch {
      error = $t('generator.errorGeneric')
    } finally {
      submitting = false
    }
  }
</script>

<PageHeader title={$t('generator.pageTitle')} subtitle={$t('generator.pageSubtitle')} />

{#if loading}
  <p class="ix-loading">{$t('common.loading')}</p>
{:else}
  <Card>
    <div class="form-stack">
      {#if error}<p class="ix-error">{error}</p>{/if}

      <div class="ix-field">
        <span class="ix-label">{$t('generator.uploadLabel')}</span>
        <DocumentUpload
          bind:file
          hint={$t('generator.uploadHint')}
          hintReplace={$t('generator.uploadHintReplace')}
          clearLabel={$t('generator.clearFile')}
        />
      </div>

      <Input
        id="question_count"
        label={$t('generator.questionCountLabel')}
        type="number"
        bind:value={questionCount}
        min="1"
        max="30"
        step="1"
        style="width:120px"
      />

      <div class="ix-field">
        <label class="ix-label" for="language">{$t('generator.languageLabel')}</label>
        <select id="language" class="ix-select" bind:value={language}>
          <option value="vi">{$t('generator.languageVi')}</option>
          <option value="en">{$t('generator.languageEn')}</option>
        </select>
      </div>

      <div class="ix-field">
        <label class="ix-label" for="difficulty">{$t('generator.difficultyLabel')}</label>
        <select id="difficulty" class="ix-select" bind:value={difficulty}>
          {#each DIFFICULTIES as d}
            <option value={d}>{$t(`generator.difficulty${d[0].toUpperCase()}${d.slice(1)}`)}</option>
          {/each}
        </select>
      </div>

      <div class="ix-field">
        <span class="ix-label">{$t('generator.keySourceLabel')}</span>
        <label class="radio-row">
          <input type="radio" name="key_source" value="own" bind:group={keySource} />
          {$t('generator.keySourceOwn')}
        </label>
        <label class="radio-row" class:disabled={!platformEnabled}>
          <input type="radio" name="key_source" value="platform" bind:group={keySource} disabled={!platformEnabled} />
          {platformEnabled ? $t('generator.keySourcePlatform', { cost: platformCost }) : $t('generator.keySourcePlatformDisabled')}
        </label>
        <div class="header-links">
          <a class="ix-hint" href="/exams/generate/keys" target="_blank" rel="noopener">{$t('generator.manageKeysLink')}</a>
          <a class="ix-hint" href="/exams/generate/jobs" target="_blank" rel="noopener">{$t('generator.viewJobsLink')}</a>
        </div>
      </div>

      {#if keySource === 'own'}
        {#if savedKey}
          <p class="ix-hint">
            {$t('generator.ownKeySaved', { suffix: savedKey.key_prefix.slice(-4) })}
            <button type="button" class="link-btn" onclick={() => savedKey = null}>{$t('generator.changeKeyButton')}</button>
          </p>
        {:else}
          <Input
            id="own_key"
            label={$t('generator.ownKeyLabel')}
            type="password"
            bind:value={ownKeyInput}
            placeholder={$t('generator.ownKeyPlaceholder')}
            hint={$t('generator.ownKeyMissing')}
          />
        {/if}
      {/if}

      {#if keySource === 'own'}
        <Input
          id="model"
          label={$t('generator.modelLabel')}
          bind:value={model}
          placeholder={defaultModel}
          hint={$t('generator.modelHint')}
        />
      {:else}
        <p class="ix-hint">{$t('generator.platformModelHint', { model: defaultModel })}</p>
      {/if}

      <div>
        <Button onclick={submit} loading={submitting} disabled={submitting}>
          {$t('generator.submitButton')}
        </Button>
        {#if submitting}
          <p class="ix-hint processing-note">{$t('generator.processing')}</p>
        {/if}
      </div>
    </div>
  </Card>
{/if}

<style>
  .form-stack { display: flex; flex-direction: column; gap: 18px; max-width: 520px; }
  .ix-field { display: flex; flex-direction: column; gap: 5px; }
  .ix-label { font-size: 13px; font-weight: 500; color: var(--ix-text-secondary); line-height: 1; }
  .ix-hint { font-size: 12px; color: var(--ix-text-muted); margin: 0; line-height: 1.4; }
  a.ix-hint { display: inline-block; margin-top: 4px; color: var(--primary); text-decoration: underline; }
  .header-links { display: flex; gap: 14px; }
  .ix-error   { color: var(--danger); font-size: 14px; }
  .ix-loading { font-size: 14px; color: var(--ix-text-muted); }
  .ix-select {
    padding: 8px 10px; border-radius: 8px; border: 1px solid var(--ix-border);
    background: var(--ix-bg-surface); color: var(--ix-text-primary); font-size: 14px;
  }
  .radio-row { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ix-text-primary); }
  .radio-row.disabled { color: var(--ix-text-muted); }
  .link-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 0; font-size: inherit; text-decoration: underline; }
  .processing-note { margin-top: 8px; }
</style>
