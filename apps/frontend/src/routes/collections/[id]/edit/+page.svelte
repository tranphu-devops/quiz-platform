<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { user } from '$lib/stores/auth'
  import { examApi, collectionApi } from '$lib/api'
  import BadgePicker from '$lib/components/BadgePicker.svelte'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import { t } from '$lib/i18n'

  let title = $state('')
  let description = $state('')
  let badgeUrl = $state('')
  let isPublished = $state(false)
  let selectedExamIds = $state([])
  let myExams = $state([])
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role === 'student') { goto('/dashboard'); return }
    const id = $page.params.id
    try {
      const [colRes, examsRes] = await Promise.all([
        collectionApi.get(id),
        examApi.list()
      ])
      if (!colRes.ok) { error = $t('collectionForm.notFound'); return }
      const col = await colRes.json()
      title = col.title
      description = col.description ?? ''
      badgeUrl = col.badge_image_url ?? ''
      isPublished = col.is_published
      selectedExamIds = (col.exams ?? []).map(e => e.id)
      if (examsRes.ok) {
        const all = await examsRes.json()
        myExams = all.filter(e => e.created_by === $user.id)
      }
    } catch {
      error = $t('imageUpload.connectionError')
    } finally {
      loading = false
    }
  })

  function toggleExam(id) {
    selectedExamIds = selectedExamIds.includes(id)
      ? selectedExamIds.filter(x => x !== id)
      : [...selectedExamIds, id]
  }

  async function save() {
    if (!title.trim()) { error = $t('collectionForm.titleRequired'); return }
    if (selectedExamIds.length === 0) { error = $t('collectionForm.examRequired'); return }
    error = ''
    saving = true
    try {
      const res = await collectionApi.update($page.params.id, {
        title: title.trim(),
        description: description.trim() || null,
        badge_image_url: badgeUrl || null,
        is_published: isPublished,
        exam_ids: selectedExamIds
      })
      if (!res.ok) {
        const d = await res.json()
        error = d.error ?? $t('collectionForm.updateError')
        return
      }
      goto('/collections')
    } catch {
      error = $t('imageUpload.connectionError')
    } finally {
      saving = false
    }
  }
</script>

<style>
  .back-btn { display: inline-flex; align-items: center; gap: 4px; color: var(--ix-text-secondary); text-decoration: none; font-size: 13px; padding: 4px 8px; border-radius: 6px; margin-bottom: 8px; }
  .back-btn:hover { background: var(--ix-bg-hover); color: var(--ix-text-primary); }
  h1 { font-size: 1.4rem; font-weight: 800; }
  .layout { display: grid; grid-template-columns: 1fr 360px; gap: 1.5rem; align-items: start; }
  @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
  .card { background: var(--surface); border-radius: var(--radius-card); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1.25rem; }
  .card h2 { font-size: 0.95rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; }
  .form-row { margin-bottom: 1rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; }
  input[type=text], textarea { width: 100%; padding: 0.55rem 0.75rem; border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.95rem; background: var(--bg); color: var(--text); transition: border-color 0.15s; font-family: inherit; }
  input[type=text]:focus, textarea:focus { outline: none; border-color: var(--primary); }
  textarea { min-height: 80px; resize: vertical; }
  .exam-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto; }
  .exam-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem; border-radius: 8px; border: 1.5px solid var(--border); cursor: pointer; transition: all 0.12s; background: var(--bg); user-select: none; }
  .exam-item:hover { border-color: var(--primary); background: var(--primary-light); }
  .exam-item.selected { border-color: var(--primary); background: var(--primary-light); }
  .exam-check { width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; }
  .exam-title { font-size: 0.9rem; font-weight: 600; }
  .exam-meta { font-size: 0.75rem; color: var(--muted); }
  .toggle-row { display: flex; align-items: center; gap: 0.75rem; }
  .toggle { position: relative; width: 40px; height: 22px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-track { position: absolute; inset: 0; border-radius: 99px; background: var(--border); cursor: pointer; transition: background 0.2s; }
  .toggle input:checked + .toggle-track { background: var(--primary); }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 0.2s; }
  .toggle input:checked ~ .toggle-thumb { transform: translateX(18px); }
  .error { color: var(--danger); font-size: 0.875rem; margin-bottom: 0.75rem; }
  .btn-save { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; border: none; border-radius: var(--radius-btn); font-size: 1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.15s; }
  .btn-save:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(99,102,241,0.45); transform: translateY(-1px); }
  .btn-save:disabled { opacity: 0.55; cursor: default; transform: none; }
</style>

<a href="/collections" class="back-btn">← {$t('common.back')}</a>
<PageHeader title={$t('collectionForm.editTitle')} />

{#if loading}
  <p style="color:var(--muted)">{$t('common.loading')}</p>
{:else if error && !title}
  <p style="color:var(--danger)">{error}</p>
{:else}
<div class="layout">
  <div>
    <div class="card">
      <h2>📋 {$t('collectionForm.infoTitle')}</h2>
      <div class="form-row">
        <label for="title">{$t('collectionForm.nameLabel')} *</label>
        <input id="title" type="text" bind:value={title} />
      </div>
      <div class="form-row">
        <label for="desc">{$t('collectionForm.descLabel')}</label>
        <textarea id="desc" bind:value={description}></textarea>
      </div>
    </div>

    <div class="card">
      <h2>📝 {$t('collectionForm.examsInCollection', { n: selectedExamIds.length })}</h2>
      <div class="exam-list">
        {#each myExams as exam}
          <div class="exam-item {selectedExamIds.includes(exam.id) ? 'selected' : ''}"
            onclick={() => toggleExam(exam.id)} role="checkbox" tabindex="0"
            onkeydown={e => e.key === ' ' && toggleExam(exam.id)}>
            <input class="exam-check" type="checkbox" checked={selectedExamIds.includes(exam.id)} tabindex="-1" />
            <div>
              <div class="exam-title">{exam.title}</div>
              <div class="exam-meta">{$t('exams.minutes', { n: exam.time_limit })}{exam.is_published ? '' : ' · ' + $t('examForm.publishDraft')}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div>
    <div class="card">
      <h2>🏅 {$t('collectionForm.badgeTitle')}</h2>
      <BadgePicker bind:value={badgeUrl} label={$t('badgePicker.defaultLabel')} />
    </div>

    <div class="card">
      <h2>⚙️ {$t('collectionForm.statusTitle')}</h2>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" bind:checked={isPublished} />
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
        <span style="font-size:0.9rem">{isPublished ? $t('collectionForm.statusPublished') : $t('collectionForm.statusHidden')}</span>
      </div>
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn-save" onclick={save} disabled={saving}>
      {saving ? $t('common.saving') : $t('examForm.saveChanges')}
    </button>
  </div>
</div>
{/if}
