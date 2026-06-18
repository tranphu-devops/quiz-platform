<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte'
  import ImageUpload from '$lib/components/ImageUpload.svelte'

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

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const STEPS = [
    { n: 1, label: 'Thông tin' },
    { n: 2, label: 'Import' },
    { n: 3, label: 'Câu hỏi' },
    { n: 4, label: 'Xác nhận' }
  ]

  onMount(() => {
    if (!$user || $user.role === 'student') goto('/exams')
  })

  // ── Step navigation ──────────────────────────────────────────────────────────
  function goNext() {
    if (step === 1) {
      if (!title.trim()) { step1Error = 'Vui lòng nhập tiêu đề đề thi'; return }
      step1Error = ''
    }
    if (step === 3) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (!q.content.trim()) { step3Error = `Câu ${i + 1}: Chưa nhập nội dung`; return }
        if (q.question_type === 'multiple' && q.correctKeys.length === 0) {
          step3Error = `Câu ${i + 1}: Chưa chọn đáp án đúng`; return
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
    const t = tagInput.trim()
    if (!t || tags.includes(t) || tags.length >= 5) { tagInput = ''; return }
    tags = [...tags, t]; tagInput = ''
  }
  function removeTag(t) { tags = tags.filter(x => x !== t) }
  function handleTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
  }

  // ── JSON import ───────────────────────────────────────────────────────────────
  function parseImportJSON(text) {
    let raw
    try { raw = JSON.parse(text) } catch (e) {
      importError = `JSON không hợp lệ: ${e.message}`
      importResult = null
      return
    }

    const list = Array.isArray(raw) ? raw : raw.questions
    if (!Array.isArray(list)) {
      importError = 'File phải có trường "questions" là mảng, hoặc là mảng câu hỏi trực tiếp'
      importResult = null
      return
    }

    const parsed = []
    const errors = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const idx = `Câu ${i + 1}`
      if (!item.content) { errors.push(`${idx}: thiếu trường "content"`); continue }
      if (!Array.isArray(item.options) || item.options.length < 2) {
        errors.push(`${idx}: "options" phải là mảng ≥ 2 phần tử`); continue
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
      importError = 'Vui lòng chọn file .json'
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
      const res = await examApi.create({
        title, description, cover_image_url: cover_image_url || null,
        time_limit: Number(time_limit),
        passing_score: passing_score !== '' ? Number(passing_score) : null,
        credit_cost: Number(credit_cost),
        tags, show_explanation, allow_retake
      })
      const data = await res.json()
      if (!res.ok) { saveError = data.error; return }
      for (let i = 0; i < questions.length; i++) {
        await examApi.addQuestion(data.id, buildPayload(questions[i], i))
      }
      goto(`/exams/${data.id}`)
    } catch {
      saveError = 'Lỗi khi lưu đề thi, vui lòng thử lại'
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
</style>

<!-- ── Wizard header ─────────────────────────────────────────────────────────── -->
<div class="wizard-header">
  <h1>Tạo đề thi mới</h1>
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
  <div class="card-title">📋 Thông tin cơ bản</div>
  {#if step1Error}<p class="error-msg">{step1Error}</p>{/if}

  <div class="form-row">
    <label for="title">Tiêu đề *</label>
    <input id="title" type="text" bind:value={title} placeholder="Nhập tiêu đề đề thi..." />
  </div>
  <div class="form-row">
    <label for="desc">Mô tả ngắn</label>
    <textarea id="desc" bind:value={description} placeholder="Mô tả nội dung đề thi..."></textarea>
  </div>
  <div class="form-row">
    <label>Ảnh bìa</label>
    <ImageUpload bind:value={cover_image_url} type="exam-cover" label="ảnh bìa" />
  </div>

  <div class="row2">
    <div class="form-row">
      <label for="time">Thời gian làm bài (phút)</label>
      <input id="time" type="number" bind:value={time_limit} min="1" max="300" style="width:100px" />
    </div>
    <div class="form-row">
      <label for="passing">Điểm đạt (%)</label>
      <input id="passing" type="number" bind:value={passing_score} min="0" max="100" step="0.5" placeholder="Ví dụ: 70" style="width:120px" />
      <p class="hint">Để trống nếu không yêu cầu điểm tối thiểu</p>
    </div>
  </div>

  <div class="row2">
    <div class="form-row">
      <label for="credit_cost">Credit / lần làm</label>
      <input id="credit_cost" type="number" bind:value={credit_cost} min="0" step="1" style="width:100px" />
    </div>
    <div class="form-row">
      <label for="exam_mode">Chế độ thi</label>
      <select id="exam_mode" bind:value={allow_retake} style="width:auto">
        <option value={false}>Chính thức (1 lần)</option>
        <option value={true}>Thực hành (làm lại)</option>
      </select>
    </div>
  </div>

  <div class="form-row">
    <label>Tags (tối đa 5)</label>
    <div class="tag-wrap">
      {#each tags as t}
        <span class="tag-chip">{t}<button type="button" onclick={() => removeTag(t)}>×</button></span>
      {/each}
      {#if tags.length < 5}
        <input class="tag-input" bind:value={tagInput}
          onkeydown={handleTagKeydown} onblur={addTag}
          placeholder="Nhập tag, Enter để thêm..." />
      {/if}
    </div>
    <p class="hint">Ví dụ: AWS, Cloud, SAA-C03</p>
  </div>

  <div class="form-row">
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" bind:checked={show_explanation} />
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
      <span class="toggle-label" onclick={() => show_explanation = !show_explanation}>
        Hiện giải thích đáp án cho học sinh sau khi nộp bài
      </span>
    </div>
  </div>
</div>

<div class="nav-bar">
  <div class="spacer"></div>
  <button class="btn-next" onclick={goNext}>Tiếp theo: Import câu hỏi →</button>
</div>
{/if}


<!-- ════════════════ STEP 2: JSON import ═══════════════════════════════════════ -->
{#if step === 2}
<div class="card">
  <div class="card-title">📥 Tải xuống mẫu JSON</div>
  <div class="template-box">
    <p>
      Tải về file mẫu để xem cấu trúc đúng. Mỗi câu hỏi cần có: <code>content</code>, <code>options</code>, <code>correct_answer</code>, <code>type</code>.
    </p>
    <a href="/question-template.json" download="question-template.json"
      style="flex-shrink:0; padding:0.55rem 1rem; background:var(--primary); color:#fff; border-radius:var(--radius-btn); font-weight:700; font-size:0.85rem; text-decoration:none; white-space:nowrap">
      ⬇ Tải mẫu JSON
    </a>
  </div>
</div>

<div class="card">
  <div class="card-title">📤 Upload file câu hỏi</div>

  {#if importError}
    <p class="error-msg">⚠ {importError}</p>
  {/if}

  {#if importResult}
    <div class="import-result">
      <div class="import-result-icon">✅</div>
      <div style="flex:1">
        <div class="import-result-title">Đọc được {importResult.count} câu hỏi hợp lệ</div>
        {#if importResult.errors.length}
          <div class="import-errors">
            <p style="font-weight:700; margin-bottom:0.3rem">Bỏ qua {importResult.errors.length} câu hỏi lỗi:</p>
            {#each importResult.errors as e}<p>• {e}</p>{/each}
          </div>
        {/if}
        <div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <label style="font-size:0.82rem; display:flex; align-items:center; gap:0.4rem; cursor:pointer">
            <input type="radio" bind:group={importReplaceMode} value={true} />
            Thay thế câu hỏi hiện tại
          </label>
          <label style="font-size:0.82rem; display:flex; align-items:center; gap:0.4rem; cursor:pointer">
            <input type="radio" bind:group={importReplaceMode} value={false} />
            Thêm vào cuối ({questions.length} câu hiện có)
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
      <div class="drop-text">Kéo thả file JSON vào đây, hoặc <strong>click để chọn file</strong></div>
      <div class="drop-hint">Chỉ nhận file .json — tối đa 5 MB</div>
    </label>
    <input id="json-file" type="file" accept=".json" class="file-input" onchange={onFileChange} />
  {/if}
</div>

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← Quay lại</button>
  <div class="spacer"></div>
  <button class="btn-skip" onclick={skipImport}>Bỏ qua, nhập tay →</button>
  {#if importResult?.count > 0}
    <button class="btn-next" onclick={applyImport}>
      Dùng {importResult.count} câu hỏi →
    </button>
  {/if}
</div>
{/if}


<!-- ════════════════ STEP 3: Questions editor ══════════════════════════════════ -->
{#if step === 3}
<div class="q-toolbar">
  <span class="q-count-badge">{questions.length} câu hỏi</span>
  <button class="btn-collapse" onclick={collapseAll}>Thu gọn tất cả</button>
  <button class="btn-collapse" onclick={expandAll}>Mở tất cả</button>
  <div class="spacer"></div>
</div>

{#if step3Error}<p class="error-msg">{step3Error}</p>{/if}

{#each questions as q, i}
<div class="q-card">
  <div class="q-head">
    <div class="q-num">{i + 1}</div>
    <div class="q-preview">{q.content || '(chưa nhập nội dung)'}</div>
    <span class="type-badge {q.question_type === 'multiple' ? 'multi' : 'single'}">
      {q.question_type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
    </span>
    <button class="btn-collapse" onclick={() => toggleCollapse(i)}>
      {collapsed.has(i) ? '▼ Mở' : '▲ Thu'}
    </button>
    <button class="btn-remove-q" onclick={() => removeQuestion(i)}>✕</button>
  </div>

  {#if !collapsed.has(i)}
  <div class="form-row" style="margin-bottom:0.6rem">
    <label>Loại câu hỏi</label>
    <select bind:value={q.question_type} style="width:180px">
      <option value="single">1 đáp án đúng</option>
      <option value="multiple">Nhiều đáp án đúng</option>
    </select>
  </div>
  <div class="form-row">
    <label>Nội dung câu hỏi *</label>
    <textarea bind:value={q.content} placeholder="Nhập câu hỏi..." style="min-height:60px"></textarea>
  </div>
  <div class="form-row" style="margin-bottom:0.5rem">
    <label>Ảnh minh hoạ (tuỳ chọn)</label>
    <ImageUpload bind:value={q.image_url} type="question" label="ảnh câu hỏi" />
  </div>

  <div class="section-sub">Đáp án</div>
  <div class="options-grid">
    {#each q.options as opt}
    <div class="opt-row">
      {#if q.question_type === 'multiple'}
        <input type="checkbox" checked={q.correctKeys.includes(opt.key)}
          onchange={() => toggleCorrectKey(q, opt.key)}
          style="width:auto; flex-shrink:0" title="Đáp án đúng" />
      {/if}
      <span class="opt-key">{opt.key}.</span>
      <input type="text" bind:value={opt.text} placeholder="Đáp án {opt.key}" />
      {#if q.options.length > 2}
        <button type="button" class="btn-remove-opt" onclick={() => removeOption(q, opt.key)}>✕</button>
      {/if}
    </div>
    {/each}
  </div>

  {#if q.question_type === 'multiple'}
    <p class="correct-hint">
      {q.correctKeys.length > 0
        ? `✓ Đã chọn ${q.correctKeys.length} đáp án: ${q.correctKeys.sort().join(', ')}`
        : 'Tích vào ô checkbox để chọn đáp án đúng'}
    </p>
    <button type="button" class="btn-add-opt" onclick={() => addOption(q)}>+ Thêm đáp án</button>
  {:else}
    <div class="form-row" style="margin-top:0.5rem">
      <label>Đáp án đúng</label>
      <select bind:value={q.correct_answer} style="width:100px">
        {#each q.options as opt}<option value={opt.key}>{opt.key}</option>{/each}
      </select>
    </div>
  {/if}

  <div class="row2" style="margin-top:0.5rem">
    <div class="form-row" style="margin:0">
      <label>Điểm</label>
      <input type="number" bind:value={q.points} min="0.5" step="0.5" style="width:90px" />
    </div>
  </div>

  <div class="expl-section">
    <div class="section-sub">Giải thích (markdown, tuỳ chọn)</div>
    <MarkdownEditor bind:value={q.explanation} placeholder="Giải thích tại sao đáp án này đúng..." rows={3} />
  </div>
  {/if}
</div>
{/each}

<button class="q-add-btn" onclick={addQuestion}>+ Thêm câu hỏi</button>

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← Quay lại</button>
  <div class="spacer"></div>
  <button class="btn-next" onclick={goNext} disabled={questions.length === 0}>
    Xem lại và lưu ({questions.length} câu) →
  </button>
</div>
{/if}


<!-- ════════════════ STEP 4: Final review ══════════════════════════════════════ -->
{#if step === 4}
<div class="card">
  <div class="card-title">📄 Thông tin đề thi</div>
  {#if cover_image_url}
    <img src={cover_image_url} alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;margin-bottom:1rem;border:1px solid var(--border)" />
  {/if}
  <div class="review-grid">
    <div class="review-item">
      <div class="review-label">Tiêu đề</div>
      <div class="review-val">{title}</div>
    </div>
    <div class="review-item">
      <div class="review-label">Thời gian</div>
      <div class="review-val">{time_limit} phút</div>
    </div>
    <div class="review-item">
      <div class="review-label">Điểm đạt</div>
      <div class="review-val">{passing_score !== '' ? `${passing_score}%` : 'Không yêu cầu'}</div>
    </div>
    <div class="review-item">
      <div class="review-label">Credit / lần</div>
      <div class="review-val">💳 {credit_cost}</div>
    </div>
    <div class="review-item">
      <div class="review-label">Chế độ</div>
      <div class="review-val">{allow_retake ? 'Thực hành' : 'Chính thức'}</div>
    </div>
    <div class="review-item">
      <div class="review-label">Giải thích đáp án</div>
      <div class="review-val">{show_explanation ? 'Hiển thị' : 'Ẩn'}</div>
    </div>
  </div>
  {#if tags.length}
    <div style="margin-top:0.25rem">
      {#each tags as t}<span class="review-tag">{t}</span>{/each}
    </div>
  {/if}
  {#if description}
    <p style="font-size:0.88rem;color:var(--muted);margin-top:0.75rem">{description}</p>
  {/if}
</div>

<div class="card">
  <div class="card-title">📝 Câu hỏi ({questions.length})</div>
  <div class="q-review-list">
    {#each questions as q, i}
    <div class="q-review-item">
      <div class="q-num">{i + 1}</div>
      <div class="q-review-content">{q.content || '(chưa nhập)'}</div>
      <span class="type-badge {q.question_type === 'multiple' ? 'multi' : 'single'}">
        {q.question_type === 'multiple' ? 'Multi' : 'Single'}
      </span>
      <div class="q-review-pts">{q.points} đ</div>
    </div>
    {/each}
  </div>
  {#if questions.length === 0}
    <p style="color:var(--muted);font-size:0.875rem;text-align:center;padding:1rem 0">
      Chưa có câu hỏi nào. <button style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.875rem;font-weight:600" onclick={goBack}>← Quay lại để thêm</button>
    </p>
  {/if}
</div>

{#if saveError}<p class="error-msg">{saveError}</p>{/if}

<div class="nav-bar">
  <button class="btn-back" onclick={goBack}>← Sửa câu hỏi</button>
  <div class="spacer"></div>
  <button class="btn-next" onclick={save} disabled={saving || questions.length === 0}>
    {saving ? 'Đang tạo đề thi...' : `✓ Tạo đề thi (${questions.length} câu)`}
  </button>
</div>
{/if}
