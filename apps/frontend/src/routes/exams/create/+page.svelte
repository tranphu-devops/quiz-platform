<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte'
  import RichTextEditor from '$lib/components/RichTextEditor.svelte'
  import { sanitizeHtml, isHtmlEmpty } from '$lib/sanitizeHtml'
  import ImageUpload from '$lib/components/ImageUpload.svelte'
  import { t, locale, localeCode } from '$lib/i18n'

  // ── Step state ──────────────────────────────────────────────────────────────
  let step = $state(1) // 1 | 2 | 3 | 4

  // ── Step 1: Exam info ────────────────────────────────────────────────────────
  let title = $state('')
  let description = $state('')
  let cover_image_url = $state('')
  let time_limit = $state(30)
  let passing_score = $state('')
  let credit_cost = $state(10)
  let tags = $state([])
  let show_explanation = $state(false)
  let allow_retake = $state(false)
  let cooldown_minutes = $state(0)
  let max_attempts = $state('')
  let tagInput = $state('')
  let step1Error = $state('')

  // ── Step 2: JSON import ──────────────────────────────────────────────────────
  let importDragging = $state(false)
  let importResult = $state(null)  // { count, questions, errors } | null
  let importError = $state('')
  let importReplaceMode = $state(true)

  // ── Step 3: Questions editor ─────────────────────────────────────────────────
  let questions = $state([])
  let collapsed = $state(new Set())
  let step3Error = $state('')

  // ── Step 4: Save ─────────────────────────────────────────────────────────────
  let saving = $state(false)
  let saveError = $state('')

  // ── Publish mode ─────────────────────────────────────────────────────────────
  let publish_mode = $state('draft') // 'draft' | 'now' | 'scheduled'
  let scheduled_at_input = $state('')  // datetime-local value

  function minScheduledAt() {
    const d = new Date(Date.now() + 5 * 60 * 1000) // min 5 minutes from now
    return d.toISOString().slice(0, 16)
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const STEPS = $derived([
    { n: 1, label: $t('examForm.stepInfo') },
    { n: 2, label: $t('examForm.stepImport') },
    { n: 3, label: $t('examForm.stepQuestions') },
    { n: 4, label: $t('examForm.stepConfirm') }
  ])

  onMount(() => {
    if (!$user || $user.role === 'student') goto('/exams')
  })

  // ── Step navigation ──────────────────────────────────────────────────────────
  function goNext() {
    if (step === 1) {
      if (!title.trim()) { step1Error = $t('examForm.titleRequired'); return }
      step1Error = ''
    }
    if (step === 3) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (!q.content.trim()) { step3Error = $t('examForm.questionMissingContent', { n: i + 1 }); return }
        if (q.question_type === 'multiple' && q.correctKeys.length === 0) {
          step3Error = $t('examForm.questionMissingCorrect', { n: i + 1 }); return
        }
      }
      step3Error = ''
    }
    step++
  }

  function goBack() { step-- }

  function goToStep(n) {
    // only allow going back to completed steps
    if (n < step) step = n
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────
  function addTag() {
    const tag = tagInput.trim()
    if (!tag || tags.includes(tag) || tags.length >= 5) { tagInput = ''; return }
    tags = [...tags, tag]; tagInput = ''
  }
  function removeTag(tag) { tags = tags.filter(x => x !== tag) }
  function handleTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
  }

  // ── JSON import ───────────────────────────────────────────────────────────────
  function parseImportJSON(text) {
    let raw
    try { raw = JSON.parse(text) } catch (e) {
      importError = $t('examForm.invalidJson', { msg: e.message })
      importResult = null
      return
    }

    const list = Array.isArray(raw) ? raw : raw.questions
    if (!Array.isArray(list)) {
      importError = $t('examForm.jsonMustHaveQuestions')
      importResult = null
      return
    }

    const parsed = []
    const errors = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const idx = $t('examForm.questionN', { n: i + 1 })
      if (!item.content) { errors.push(`${idx}: ${$t('examForm.missingContentField')}`); continue }
      if (!Array.isArray(item.options) || item.options.length < 2) {
        errors.push(`${idx}: ${$t('examForm.optionsMustBeArray')}`); continue
      }
      const type = item.type === 'multiple' ? 'multiple' : 'single'
      const ca = item.correct_answer
      let correct_answer = 'A', correctKeys = []
      if (type === 'multiple') {
        correctKeys = Array.isArray(ca) ? ca.map(String) : [String(ca)]
      } else {
        correct_answer = String(ca ?? item.options[0]?.key ?? 'A')
      }
      parsed.push({
        content: String(item.content),
        image_url: item.image_url ?? '',
        question_type: type,
        options: item.options.map(o => ({ key: String(o.key), text: String(o.text ?? '') })),
        correct_answer,
        correctKeys,
        points: Number(item.points ?? 1),
        explanation: item.explanation ?? ''
      })
    }

    importError = ''
    importResult = { count: parsed.length, questions: parsed, errors }
  }

  function handleFileInput(file) {
    if (!file || !file.name.endsWith('.json')) {
      importError = $t('examForm.pleaseChooseJson')
      importResult = null
      return
    }
    const reader = new FileReader()
    reader.onload = e => parseImportJSON(e.target.result)
    reader.readAsText(file, 'utf-8')
  }

  function onFileChange(e) { handleFileInput(e.target.files?.[0]) }

  function onDrop(e) {
    e.preventDefault(); importDragging = false
    handleFileInput(e.dataTransfer.files?.[0])
  }

  function applyImport() {
    if (!importResult?.questions?.length) return
    if (importReplaceMode) {
      questions = [...importResult.questions]
    } else {
      questions = [...questions, ...importResult.questions]
    }
    importResult = null
    step = 3
  }

  function skipImport() { step = 3 }

  // ── Question editor ───────────────────────────────────────────────────────────
  function newQuestion() {
    return {
      content: '', image_url: '', question_type: 'single', explanation: '',
      options: [{ key: 'A', text: '' }, { key: 'B', text: '' },
                { key: 'C', text: '' }, { key: 'D', text: '' }],
      correct_answer: 'A', correctKeys: [], points: 1
    }
  }

  function addQuestion() { questions = [...questions, newQuestion()] }
  function removeQuestion(i) {
    questions = questions.filter((_, idx) => idx !== i)
    collapsed = new Set([...collapsed].filter(x => x !== i).map(x => x > i ? x - 1 : x))
  }
  function toggleCollapse(i) {
    const next = new Set(collapsed)
    next.has(i) ? next.delete(i) : next.add(i)
    collapsed = next
  }
  function collapseAll() { collapsed = new Set(questions.map((_, i) => i)) }
  function expandAll() { collapsed = new Set() }
  function addOption(q) {
    const nextKey = LETTERS[q.options.length] ?? String(q.options.length + 1)
    q.options = [...q.options, { key: nextKey, text: '' }]
  }
  function removeOption(q, key) {
    if (q.options.length <= 2) return
    q.options = q.options.filter(o => o.key !== key)
    q.correctKeys = q.correctKeys.filter(k => k !== key)
    if (q.correct_answer === key) q.correct_answer = q.options[0]?.key ?? 'A'
  }
  function toggleCorrectKey(q, key) {
    q.correctKeys = q.correctKeys.includes(key)
      ? q.correctKeys.filter(k => k !== key)
      : [...q.correctKeys, key]
  }
  function buildPayload(q, i) {
    return {
      content: q.content,
      image_url: q.image_url || null,
      options: q.options,
      correct_answer: q.question_type === 'multiple' ? q.correctKeys : q.correct_answer,
      points: q.points,
      order_index: i,
      explanation: q.explanation || null,
      question_type: q.question_type
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function save() {
    saveError = ''
    saving = true
    try {
      const is_published = publish_mode !== 'draft'
      const scheduled_at = publish_mode === 'scheduled' && scheduled_at_input
        ? new Date(scheduled_at_input).toISOString()
        : null
      const res = await examApi.create({
        title, description, cover_image_url: cover_image_url || null,
        time_limit: Number(time_limit),
        passing_score: passing_score !== '' ? Number(passing_score) : null,
        credit_cost: Number(credit_cost),
        tags, show_explanation, allow_retake,
        cooldown_minutes: Number(cooldown_minutes) || 0,
        max_attempts: max_attempts !== '' ? Number(max_attempts) : null,
        is_published, scheduled_at
      })
      const data = await res.json()
      if (!res.ok) { saveError = data.error; return }
      for (let i = 0; i < questions.length; i++) {
        await examApi.addQuestion(data.id, buildPayload(questions[i], i))
      }
      goto(`/exams/${data.id}`)
    } catch {
      saveError = $t('examForm.saveError')
    } finally {
      saving = false
    }
  }
</script>

<style>
  /* ── Step indicator ──────────────────────────────────────────────────────────*/
  .wizard-header { margin-bottom: 2rem; }
  .wizard-header h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 1.25rem; }
  .step-track {
    display: flex; align-items: center;
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); padding: 1rem 1.5rem;
    box-shadow: var(--shadow);
  }
  .step-item {
    display: flex; align-items: center; gap: 0.6rem; flex: 1;
    cursor: default;
  }
  .step-item:not(:last-child)::after {
    content: ''; flex: 1; height: 2px; background: var(--border);
    margin: 0 0.5rem; border-radius: 1px; min-width: 20px;
  }
  .step-item.done:not(:last-child)::after { background: var(--primary); }
  .step-item.clickable { cursor: pointer; }
  .step-num {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem; font-weight: 800; flex-shrink: 0;
    border: 2px solid var(--border); background: var(--bg); color: var(--muted);
    transition: all 0.2s;
  }
  .step-item.active .step-num { background: var(--primary); border-color: var(--primary); color: #fff; }
  .step-item.done .step-num { background: var(--success); border-color: var(--success); color: #fff; }
  .step-label { font-size: 0.8rem; font-weight: 600; color: var(--muted); transition: color 0.2s; }
  .step-item.active .step-label { color: var(--primary); }
  .step-item.done .step-label { color: var(--success); }
  @media (max-width: 600px) { .step-label { display: none; } .step-track { padding: 0.75rem 1rem; } }

  /* ── Cards ───────────────────────────────────────────────────────────────────*/
  .card { background: var(--surface); border-radius: var(--radius-card); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: var(--shadow); }
  .card-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 1.1rem; display: flex; align-items: center; gap: 0.4rem; }

  /* ── Forms ───────────────────────────────────────────────────────────────────*/
  .form-row { margin-bottom: 1rem; }
  .form-row label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--text); }
  .form-row input[type=text], .form-row input[type=number], .form-row textarea, .form-row select {
    width: 100%; padding: 0.55rem 0.75rem;
    border: 1.5px solid var(--border); border-radius: 8px;
    font-size: 0.95rem; background: var(--bg); color: var(--text);
    transition: border-color 0.15s; font-family: inherit; box-sizing: border-box;
  }
  .form-row input:focus, .form-row textarea:focus, .form-row select:focus { outline: none; border-color: var(--primary); }
  .form-row textarea { min-height: 80px; resize: vertical; }
  .hint { font-size: 0.78rem; color: var(--muted); margin-top: 0.25rem; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .row2 { grid-template-columns: 1fr; } }

  /* Tags */
  .tag-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; padding: 0.35rem 0.5rem; border: 1.5px solid var(--border); border-radius: 8px; background: var(--bg); min-height: 2.4rem; transition: border-color 0.15s; }
  .tag-wrap:focus-within { border-color: var(--primary); }
  .tag-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--primary-light); color: var(--primary); border: 1px solid rgba(99,102,241,0.3); border-radius: 99px; padding: 0.1rem 0.6rem; font-size: 0.82rem; font-weight: 600; }
  .tag-chip button { border: none; background: none; cursor: pointer; color: var(--primary); font-size: 0.9rem; padding: 0; line-height: 1; opacity: 0.7; }
  .tag-chip button:hover { opacity: 1; }
  .tag-input { border: none; outline: none; font-size: 0.9rem; flex: 1; min-width: 120px; background: transparent; color: var(--text); }
  .toggle-row { display: flex; align-items: center; gap: 0.75rem; }
  .toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-track { position: absolute; inset: 0; border-radius: 99px; background: var(--border); cursor: pointer; transition: background 0.2s; }
  .toggle input:checked + .toggle-track { background: var(--primary); }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 0.2s; pointer-events: none; }
  .toggle input:checked ~ .toggle-thumb { transform: translateX(18px); }
  .toggle-label { font-size: 0.9rem; cursor: pointer; }

  /* ── Import step ─────────────────────────────────────────────────────────────*/
  .drop-zone {
    border: 2px dashed var(--border); border-radius: 14px; padding: 2.5rem 1.5rem;
    text-align: center; cursor: pointer; transition: all 0.15s;
    background: var(--bg);
  }
  .drop-zone.dragging { border-color: var(--primary); background: var(--primary-light); }
  .drop-zone:hover { border-color: var(--primary); }
  .drop-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
  .drop-text { font-size: 0.95rem; color: var(--muted); margin-bottom: 0.5rem; }
  .drop-text strong { color: var(--primary); cursor: pointer; }
  .drop-hint { font-size: 0.8rem; color: var(--muted); }
  input.file-input { display: none; }

  .import-result {
    border-radius: 12px; padding: 1.1rem 1.25rem;
    display: flex; align-items: flex-start; gap: 1rem;
    background: #f0fdf4; border: 1.5px solid #86efac;
  }
  .import-result-icon { font-size: 1.5rem; flex-shrink: 0; }
  .import-result-title { font-weight: 700; color: #15803d; margin-bottom: 0.25rem; }
  .import-errors { margin-top: 0.5rem; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 0.6rem 0.75rem; }
  .import-errors p { font-size: 0.8rem; color: #dc2626; margin: 0.1rem 0; }

  .template-box {
    background: var(--primary-light); border-radius: 12px; padding: 1rem 1.25rem;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    border: 1px solid rgba(99,102,241,0.2);
  }
  .template-box p { font-size: 0.875rem; color: var(--text); margin: 0; line-height: 1.5; }

  /* ── Question cards ──────────────────────────────────────────────────────────*/
  .q-card { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); padding: 1.1rem 1.25rem; margin-bottom: 0.65rem; box-shadow: 0 1px 5px rgba(99,102,241,0.05); }
  .q-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
  .q-num { width: 26px; height: 26px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-size: 0.78rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .q-preview { flex: 1; font-size: 0.85rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .type-badge { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 99px; flex-shrink: 0; }
  .type-badge.single { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .type-badge.multi { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
  .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin: 0.5rem 0; }
  @media (max-width: 640px) { .options-grid { grid-template-columns: 1fr; } }
  .opt-row { display: flex; align-items: center; gap: 0.5rem; }
  .opt-key { font-weight: 700; color: var(--primary); min-width: 1.5rem; flex-shrink: 0; font-size: 0.88rem; }
  .opt-row input[type=text] { flex: 1; padding: 0.35rem 0.6rem; border: 1.5px solid var(--border); border-radius: 6px; font-size: 0.88rem; background: var(--bg); color: var(--text); box-sizing: border-box; }
  .opt-row input[type=text]:focus { outline: none; border-color: var(--primary); }
  .expl-section { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
  .btn-add-opt { font-size: 0.8rem; padding: 0.25rem 0.65rem; background: var(--bg); border: 1px dashed var(--border); border-radius: 6px; color: var(--muted); cursor: pointer; margin-top: 0.4rem; }
  .btn-add-opt:hover { border-color: var(--primary); color: var(--primary); }
  .btn-remove-opt { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; padding: 0 0.2rem; flex-shrink: 0; }
  .btn-remove-opt:hover { color: var(--danger); }
  .btn-remove-q { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.5rem; font-size: 0.78rem; color: var(--muted); cursor: pointer; }
  .btn-remove-q:hover { border-color: var(--danger); color: var(--danger); background: #fef2f2; }
  .btn-collapse { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.5rem; font-size: 0.78rem; color: var(--muted); cursor: pointer; }
  .btn-collapse:hover { border-color: var(--primary); color: var(--primary); }
  .section-sub { font-size: 0.8rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0.75rem 0 0.4rem; }
  .correct-hint { font-size: 0.78rem; color: var(--muted); margin-top: 0.25rem; }

  /* ── Step 4: Review ──────────────────────────────────────────────────────────*/
  .review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
  @media (max-width: 600px) { .review-grid { grid-template-columns: 1fr; } }
  .review-item { background: var(--bg); border-radius: 10px; padding: 0.75rem 1rem; border: 1px solid var(--border); }
  .review-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.2rem; }
  .review-val { font-size: 1rem; font-weight: 700; color: var(--text); }
  .review-tag { display: inline-flex; background: var(--primary-light); color: var(--primary); border-radius: 99px; padding: 0.1rem 0.55rem; font-size: 0.78rem; font-weight: 600; margin: 0.1rem; }
  .q-review-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; }
  .q-review-item { background: var(--bg); border-radius: 8px; padding: 0.6rem 0.85rem; border: 1px solid var(--border); display: flex; align-items: center; gap: 0.6rem; }
  .q-review-content { font-size: 0.85rem; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .q-review-pts { font-size: 0.75rem; color: var(--muted); flex-shrink: 0; }

  /* ── Nav buttons ─────────────────────────────────────────────────────────────*/
  .nav-bar { display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; }
  .btn-back { padding: 0.65rem 1.2rem; background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--radius-btn); font-size: 0.95rem; font-weight: 600; cursor: pointer; color: var(--muted); transition: all 0.15s; }
  .btn-back:hover { border-color: var(--primary); color: var(--primary); }
  .btn-next { padding: 0.65rem 1.5rem; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; border: none; border-radius: var(--radius-btn); font-size: 0.95rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.15s; }
  .btn-next:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(99,102,241,0.45); transform: translateY(-1px); }
  .btn-next:disabled { opacity: 0.55; cursor: default; transform: none; }
  .btn-skip { padding: 0.65rem 1.1rem; background: transparent; border: 1.5px solid var(--border); border-radius: var(--radius-btn); font-size: 0.88rem; font-weight: 600; cursor: pointer; color: var(--muted); transition: all 0.15s; }
  .btn-skip:hover { color: var(--text); border-color: var(--text); }
  .spacer { flex: 1; }

  .error-msg { color: var(--danger); font-size: 0.875rem; margin-bottom: 0.5rem; }
  .success-banner { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 1rem 1.25rem; color: #15803d; font-weight: 600; font-size: 0.95rem; margin-bottom: 1rem; }

  .q-add-btn { width: 100%; padding: 0.65rem; border: 2px dashed var(--border); border-radius: 12px; background: var(--bg); color: var(--muted); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .q-add-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
  .q-toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .q-count-badge { font-size: 0.8rem; font-weight: 700; background: var(--primary-light); color: var(--primary); padding: 0.15rem 0.6rem; border-radius: 99px; }

  /* ── Publish mode card ───────────────────────────────────────────────────────*/
  .publish-mode-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); padding: 1.25rem;
    box-shadow: var(--shadow); margin-bottom: 1.25rem;
  }
  .pub-mode-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 0.85rem; color: var(--text); }
  .pub-mode-options { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .pub-mode-opt {
    flex: 1; min-width: 140px; display: flex; align-items: center; gap: 0.6rem;
    padding: 0.75rem 1rem; border-radius: 10px; border: 2px solid var(--border);
    background: var(--bg); cursor: pointer; transition: all 0.15s;
  }
  .pub-mode-opt.selected { border-color: var(--primary); background: var(--primary-light); }
  .pub-mode-opt input { display: none; }
  .pub-mode-icon { font-size: 1.25rem; flex-shrink: 0; }
  .pub-mode-label { font-size: 0.88rem; font-weight: 700; color: var(--text); }
  .pub-mode-sub { font-size: 0.75rem; color: var(--muted); }
  .pub-schedule-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.85rem; flex-wrap: wrap; }
  .pub-schedule-row label { font-size: 0.85rem; font-weight: 600; color: var(--text); white-space: nowrap; }
  .pub-schedule-preview { font-size: 0.8rem; color: var(--muted); font-style: italic; }
</style>

<!-- ── Wizard header ─────────────────────────────────────────────────────────── -->
<div class="wizard-header">
  <h1>{$t('examForm.createTitle')}</h1>
  <div class="step-track">
    {#each STEPS as s}
      <div
        class="step-item {step === s.n ? 'active' : ''} {step > s.n ? 'done clickable' : ''}"
        onclick={() => goToStep(s.n)}
        role={step > s.n ? 'button' : undefined}
        tabindex={step > s.n ? 0 : undefined}
      >
        <div class="step-num">
          {step > s.n ? '✓' : s.n}
        </div>
        <span class="step-label">{s.label}</span>
      </div>
    {/each}
  </div>
</div>

<!-- ════════════════ STEP 1: Exam info ═════════════════════════════════════════ -->
{#if step === 1}
<div class="card">
  <div class="card-title">📋 {$t('examForm.basicInfo')}</div>
  {#if step1Error}<p class="error-msg">{step1Error}</p>{/if}

  <div class="form-row">
    <label for="title">{$t('examForm.titleLabel')} *</label>
    <input id="title" type="text" bind:value={title} placeholder={$t('examForm.titlePlaceholder')} />
  </div>
  <div class="form-row">
    <label for="desc">{$t('examForm.descLabel')}</label>
    <RichTextEditor bind:value={description} placeholder={$t('examForm.descPlaceholder')} />
  </div>
  <div class="form-row">
    <label>{$t('examForm.coverImage')}</label>
    <ImageUpload bind:value={cover_image_url} type="exam-cover" label={$t('examForm.coverImageLabel')} />
  </div>

  <div class="row2">
    <div class="form-row">
      <label for="time">{$t('examForm.timeLimitLabel')}</label>
      <input id="time" type="number" bind:value={time_limit} min="1" max="300" style="width:100px" />
    </div>
    <div class="form-row">
      <label for="passing">{$t('examForm.passingScoreLabel')}</label>
      <input id="passing" type="number" bind:value={passing_score} min="0" max="100" step="0.5" placeholder={$t('examForm.passingScorePlaceholder')} style="width:120px" />
      <p class="hint">{$t('examForm.passingScoreHint')}</p>
    </div>
  </div>

  <div class="row2">
    <div class="form-row">
      <label for="credit_cost">{$t('examForm.creditCostLabel')}</label>
      <input id="credit_cost" type="number" bind:value={credit_cost} min="0" step="1" style="width:100px" />
    </div>
    <div class="form-row">
      <label for="exam_mode">{$t('examForm.examModeLabel')}</label>
      <select id="exam_mode" bind:value={allow_retake} style="width:auto">
        <option value={false}>{$t('examForm.modeOfficial')}</option>
        <option value={true}>{$t('examForm.modePractice')}</option>
      </select>
    </div>
  </div>

  <div class="row2">
    <div class="form-row">
      <label for="cooldown_minutes">{$t('examForm.cooldownLabel')}</label>
      <input id="cooldown_minutes" type="number" bind:value={cooldown_minutes} min="0" step="1" style="width:100px" placeholder="0" />
      <p class="hint">{$t('examForm.cooldownHint')}</p>
    </div>
    <div class="form-row">
      <label for="max_attempts">{$t('examForm.maxAttemptsLabel')}</label>
      <input id="max_attempts" type="number" bind:value={max_attempts} min="1" step="1" style="width:100px" placeholder={$t('examForm.maxAttemptsPlaceholder')} />
      <p class="hint">{$t('examForm.maxAttemptsHint')}</p>
    </div>
  </div>

  <div class="form-row">
    <label>{$t('examForm.tagsLabel')}</label>
    <div class="tag-wrap">
      {#each tags as tag}
        <span class="tag-chip">{tag}<button type="button" onclick={() => removeTag(tag)}>×</button></span>
      {/each}
      {#if tags.length < 5}
        <input class="tag-input" bind:value={tagInput}
          onkeydown={handleTagKeydown} onblur={addTag}
          placeholder={$t('examForm.tagInputPlaceholder')} />
      {/if}
    </div>
    <p class="hint">{$t('examForm.tagsHint')}</p>
  </div>

  <div class="form-row">
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" bind:checked={show_explanation} />
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
      <span class="toggle-label" onclick={() => show_explanation = !show_explanation}>
        {$t('examForm.showExplanationLabel')}
      </span>
    </div>
  </div>
</div>

<div class="publish-mode-card">
  <div class="pub-mode-title">📅 {$t('examForm.publishTitle')}</div>
  <div class="pub-mode-options">
    <label class="pub-mode-opt" class:selected={publish_mode === 'draft'}>
      <input type="radio" bind:group={publish_mode} value="draft" />
      <div class="pub-mode-icon">📝</div>
      <div>
        <div class="pub-mode-label">{$t('examForm.publishDraft')}</div>
        <div class="pub-mode-sub">{$t('examForm.publishDraftSub')}</div>
      </div>
    </label>
    <label class="pub-mode-opt" class:selected={publish_mode === 'now'}>
      <input type="radio" bind:group={publish_mode} value="now" />
      <div class="pub-mode-icon">🚀</div>
      <div>
        <div class="pub-mode-label">{$t('examForm.publishNow')}</div>
        <div class="pub-mode-sub">{$t('examForm.publishNowSub')}</div>
      </div>
    </label>
    <label class="pub-mode-opt" class:selected={publish_mode === 'scheduled'}>
      <input type="radio" bind:group={publish_mode} value="scheduled" />
      <div class="pub-mode-icon">🔒</div>
      <div>
        <div class="pub-mode-label">{$t('examForm.publishScheduled')}</div>
        <div class="pub-mode-sub">{$t('examForm.publishScheduledSub')}</div>
      </div>
    </label>
  </div>
  {#if publish_mode === 'scheduled'}
    <div class="pub-schedule-row">
      <label for="scheduled_at_create">{$t('examForm.opensAtLabel')}</label>
      <input id="scheduled_at_create" type="datetime-local" bind:value={scheduled_at_input}
        min={minScheduledAt()} style="width:auto" />
      {#if scheduled_at_input}
        <span class="pub-schedule-preview">
          → {$t('examForm.schedulePreview', { datetime: new Date(scheduled_at_input).toLocaleString(localeCode($locale)) })}
        </span>
      {/if}
    </div>
  {/if}
</div>

<div class="nav-bar">
  <div class="spacer"></div>
  <button class="btn-next" onclick={goNext}>{$t('examForm.nextImport')} →</button>
</div>
{/if}


<!-- ════════════════ STEP 2: JSON import ═══════════════════════════════════════ -->
{#if step === 2}
<div class="card">
  <div class="card-title">📥 {$t('examForm.downloadTemplate')}</div>
  <div class="template-box">
    <p>
      {@html $t('examForm.templateHint')}
    </p>
    <a href="/question-template.json" download="question-template.json"
      style="flex-shrink:0; padding:0.55rem 1rem; background:var(--primary); color:#fff; border-radius:var(--radius-btn); font-weight:700; font-size:0.85rem; text-decoration:none; white-space:nowrap">
      ⬇ {$t('examForm.downloadTemplateBtn')}
    </a>
  </div>
</div>

<div class="card">
  <div class="card-title">📤 {$t('examForm.uploadFile')}</div>

  {#if importError}
    <p class="error-msg">⚠ {importError}</p>
  {/if}

  {#if importResult}
    <div class="import-result">
      <div class="import-result-icon">✅</div>
      <div style="flex:1">
        <div class="import-result-title">{$t('examForm.validQuestionsRead', { n: importResult.count })}</div>
        {#if importResult.errors.length}
          <div class="import-errors">
            <p style="font-weight:700; margin-bottom:0.3rem">{$t('examForm.skippedQuestions', { n: importResult.errors.length })}</p>
            {#each importResult.errors as e}<p>• {e}</p>{/each}
          </div>
        {/if}
        <div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <label style="font-size:0.82rem; display:flex; align-items:center; gap:0.4rem; cursor:pointer">
            <input type="radio" bind:group={importReplaceMode} value={true} />
            {$t('examForm.replaceExisting')}
          </label>
          <label style="font-size:0.82rem; display:flex; align-items:center; gap:0.4rem; cursor:pointer">
            <input type="radio" bind:group={importReplaceMode} value={false} />
            {$t('examForm.appendExisting', { n: questions.length })}
          </label>
        </div>
      </div>
    </div>
  {:else}
    <label for="json-file"
      class="drop-zone {importDragging ? 'dragging' : ''}"
      ondragover={e => { e.preventDefault(); importDragging = true }}
      ondragleave={() => importDragging = false}
      ondrop={onDrop}
    >
      <div class="drop-icon">📄</div>
      <div class="drop-text">{@html $t('examForm.dropZoneText')}</div>
      <div class="drop-hint">{$t('examForm.dropZoneHint')}</div>
    </label>
    <input id="json-file" type="file" accept=".json" class="file-input" onchange={onFileChange} />
  {/if}
</div>

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← {$t('common.back')}</button>
  <div class="spacer"></div>
  <button class="btn-skip" onclick={skipImport}>{$t('examForm.skipManualEntry')} →</button>
  {#if importResult?.count > 0}
    <button class="btn-next" onclick={applyImport}>
      {$t('examForm.useNQuestions', { n: importResult.count })} →
    </button>
  {/if}
</div>
{/if}


<!-- ════════════════ STEP 3: Questions editor ══════════════════════════════════ -->
{#if step === 3}
<div class="q-toolbar">
  <span class="q-count-badge">{$t('examForm.questionsCount', { n: questions.length })}</span>
  <button class="btn-collapse" onclick={collapseAll}>{$t('examForm.collapseAll')}</button>
  <button class="btn-collapse" onclick={expandAll}>{$t('examForm.expandAll')}</button>
  <div class="spacer"></div>
</div>

{#if step3Error}<p class="error-msg">{step3Error}</p>{/if}

{#each questions as q, i}
<div class="q-card">
  <div class="q-head">
    <div class="q-num">{i + 1}</div>
    <div class="q-preview">{q.content || $t('examForm.noContentYet')}</div>
    <span class="type-badge {q.question_type === 'multiple' ? 'multi' : 'single'}">
      {q.question_type === 'multiple' ? $t('examDetail.multiAnswer') : $t('examDetail.singleAnswer')}
    </span>
    <button class="btn-collapse" onclick={() => toggleCollapse(i)}>
      {collapsed.has(i) ? '▼ ' + $t('examForm.expand') : '▲ ' + $t('examForm.collapse')}
    </button>
    <button class="btn-remove-q" onclick={() => removeQuestion(i)}>✕</button>
  </div>

  {#if !collapsed.has(i)}
  <div class="form-row" style="margin-bottom:0.6rem">
    <label>{$t('examForm.questionTypeLabel')}</label>
    <select bind:value={q.question_type} style="width:180px">
      <option value="single">{$t('examForm.typeSingleOption')}</option>
      <option value="multiple">{$t('examForm.typeMultipleOption')}</option>
    </select>
  </div>
  <div class="form-row">
    <label>{$t('examForm.questionContentLabel')} *</label>
    <textarea bind:value={q.content} placeholder={$t('examForm.questionContentPlaceholder')} style="min-height:60px"></textarea>
  </div>
  <div class="form-row" style="margin-bottom:0.5rem">
    <label>{$t('examForm.questionImageLabel')}</label>
    <ImageUpload bind:value={q.image_url} type="question" label={$t('examForm.questionImageAlt')} />
  </div>

  <div class="section-sub">{$t('examForm.optionsLabel')}</div>
  <div class="options-grid">
    {#each q.options as opt}
    <div class="opt-row">
      {#if q.question_type === 'multiple'}
        <input type="checkbox" checked={q.correctKeys.includes(opt.key)}
          onchange={() => toggleCorrectKey(q, opt.key)}
          style="width:auto; flex-shrink:0" title={$t('examForm.correctAnswerTitle')} />
      {/if}
      <span class="opt-key">{opt.key}.</span>
      <input type="text" bind:value={opt.text} placeholder={$t('examForm.optionPlaceholder', { key: opt.key })} />
      {#if q.options.length > 2}
        <button type="button" class="btn-remove-opt" onclick={() => removeOption(q, opt.key)}>✕</button>
      {/if}
    </div>
    {/each}
  </div>

  {#if q.question_type === 'multiple'}
    <p class="correct-hint">
      {q.correctKeys.length > 0
        ? $t('examForm.selectedAnswers', { n: q.correctKeys.length, keys: q.correctKeys.sort().join(', ') })
        : $t('examForm.checkToSelectCorrect')}
    </p>
    <button type="button" class="btn-add-opt" onclick={() => addOption(q)}>+ {$t('examForm.addOption')}</button>
  {:else}
    <div class="form-row" style="margin-top:0.5rem">
      <label>{$t('examForm.correctAnswerLabel')}</label>
      <select bind:value={q.correct_answer} style="width:100px">
        {#each q.options as opt}<option value={opt.key}>{opt.key}</option>{/each}
      </select>
    </div>
  {/if}

  <div class="row2" style="margin-top:0.5rem">
    <div class="form-row" style="margin:0">
      <label>{$t('examForm.pointsLabel')}</label>
      <input type="number" bind:value={q.points} min="0.5" step="0.5" style="width:90px" />
    </div>
  </div>

  <div class="expl-section">
    <div class="section-sub">{$t('examForm.explanationSectionLabel')}</div>
    <MarkdownEditor bind:value={q.explanation} placeholder={$t('examForm.explanationPlaceholder')} rows={3} />
  </div>
  {/if}
</div>
{/each}

<button class="q-add-btn" onclick={addQuestion}>+ {$t('examForm.addQuestion')}</button>

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← {$t('common.back')}</button>
  <div class="spacer"></div>
  <button class="btn-next" onclick={goNext} disabled={questions.length === 0}>
    {$t('examForm.reviewAndSave', { n: questions.length })} →
  </button>
</div>
{/if}


<!-- ════════════════ STEP 4: Final review ══════════════════════════════════════ -->
{#if step === 4}
<div class="card">
  <div class="card-title">📄 {$t('examForm.examInfoTitle')}</div>
  {#if cover_image_url}
    <img src={cover_image_url} alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;margin-bottom:1rem;border:1px solid var(--border)" />
  {/if}
  <div class="review-grid">
    <div class="review-item">
      <div class="review-label">{$t('examForm.titleLabel')}</div>
      <div class="review-val">{title}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examDetail.statTime')}</div>
      <div class="review-val">{$t('exams.minutes', { n: time_limit })}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examDetail.statPassScore')}</div>
      <div class="review-val">{passing_score !== '' ? `${passing_score}%` : $t('examForm.noneRequired')}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examForm.creditCostLabel')}</div>
      <div class="review-val">💳 {credit_cost}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examDetail.statMode')}</div>
      <div class="review-val">{allow_retake ? $t('exams.practiceMode') : $t('examDetail.officialExam')}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examForm.explanationSectionLabel')}</div>
      <div class="review-val">{show_explanation ? $t('examDetail.shown') : $t('examDetail.hidden')}</div>
    </div>
    <div class="review-item">
      <div class="review-label">{$t('examForm.publishTitle')}</div>
      <div class="review-val" style="color:{publish_mode === 'draft' ? 'var(--amber)' : publish_mode === 'scheduled' ? '#7c3aed' : '#16a34a'}">
        {publish_mode === 'draft' ? '📝 ' + $t('examForm.publishDraft') : publish_mode === 'scheduled' ? '🔒 ' + $t('examForm.scheduledSummary', { datetime: scheduled_at_input ? new Date(scheduled_at_input).toLocaleString(localeCode($locale)) : $t('examForm.noTimeChosen') }) : '🚀 ' + $t('examForm.immediately')}
      </div>
    </div>
  </div>
  {#if tags.length}
    <div style="margin-top:0.25rem">
      {#each tags as tag}<span class="review-tag">{tag}</span>{/each}
    </div>
  {/if}
  {#if !isHtmlEmpty(description)}
    <div class="desc-rich" style="font-size:0.88rem;color:var(--muted);margin-top:0.75rem">{@html sanitizeHtml(description)}</div>
  {/if}
</div>

<div class="card">
  <div class="card-title">📝 {$t('examForm.questionsCount', { n: questions.length })}</div>
  <div class="q-review-list">
    {#each questions as q, i}
    <div class="q-review-item">
      <div class="q-num">{i + 1}</div>
      <div class="q-review-content">{q.content || $t('examForm.notEntered')}</div>
      <span class="type-badge {q.question_type === 'multiple' ? 'multi' : 'single'}">
        {q.question_type === 'multiple' ? 'Multi' : 'Single'}
      </span>
      <div class="q-review-pts">{$t('examForm.pointsShort', { n: q.points })}</div>
    </div>
    {/each}
  </div>
  {#if questions.length === 0}
    <p style="color:var(--muted);font-size:0.875rem;text-align:center;padding:1rem 0">
      {$t('examForm.noQuestions')} <button style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.875rem;font-weight:600" onclick={goBack}>← {$t('examForm.backToAdd')}</button>
    </p>
  {/if}
</div>

{#if saveError}<p class="error-msg">{saveError}</p>{/if}

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← {$t('examForm.editQuestions')}</button>
  <div class="spacer"></div>
  <button class="btn-next" onclick={save} disabled={saving || questions.length === 0}>
    {saving ? $t('examForm.creatingExam') : $t('examForm.createExamBtn', { n: questions.length })}
  </button>
</div>
{/if}
