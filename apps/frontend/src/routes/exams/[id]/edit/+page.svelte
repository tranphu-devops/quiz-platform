<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte'

  let exam = $state(null)
  let title = $state('')
  let description = $state('')
  let time_limit = $state(30)
  let passing_score = $state('')
  let tags = $state([])
  let show_explanation = $state(false)
  let allow_retake = $state(false)
  let tagInput = $state('')
  let questions = $state([])
  let deletedQIds = $state([])
  let collapsed = $state(new Set())
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  onMount(async () => {
    if (!$user || $user.role === 'student') { goto('/exams'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()

      if ($user.role === 'teacher' && exam.created_by !== $user.id) {
        goto(`/exams/${id}`)
        return
      }

      title = exam.title
      description = exam.description ?? ''
      time_limit = exam.time_limit
      passing_score = exam.passing_score != null ? exam.passing_score : ''
      tags = exam.tags ?? []
      show_explanation = exam.show_explanation ?? false
      allow_retake = exam.allow_retake ?? false

      questions = (exam.questions ?? []).map(q => {
        const opts = Array.isArray(q.options)
          ? q.options
          : Object.entries(q.options ?? {}).map(([key, text]) => ({ key, text })).sort((a, b) => a.key.localeCompare(b.key))
        const qtype = q.question_type ?? 'single'
        const correctKeys = qtype === 'multiple' ? (q.correct_answer ?? '').split(',').filter(Boolean) : []
        return {
          ...q,
          options: opts,
          question_type: qtype,
          correctKeys,
          correct_answer: qtype === 'single' ? (q.correct_answer ?? 'A') : 'A',
          explanation: q.explanation ?? '',
          _existing: true
        }
      })
      collapsed = new Set(questions.map((_, i) => i))
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  function addTag() {
    const t = tagInput.trim()
    if (!t || tags.includes(t)) { tagInput = ''; return }
    if (tags.length >= 5) { tagInput = ''; return }
    tags = [...tags, t]
    tagInput = ''
  }

  function removeTag(t) {
    tags = tags.filter(x => x !== t)
  }

  function handleTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
  }

  function newQuestion() {
    return {
      content: '', question_type: 'single', explanation: '',
      options: [
        { key: 'A', text: '' }, { key: 'B', text: '' },
        { key: 'C', text: '' }, { key: 'D', text: '' }
      ],
      correct_answer: 'A', correctKeys: [], points: 1, _existing: false
    }
  }

  function addQuestion() {
    questions = [...questions, newQuestion()]
  }

  function removeQuestion(i) {
    const q = questions[i]
    if (q._existing && q.id) deletedQIds = [...deletedQIds, q.id]
    questions = questions.filter((_, idx) => idx !== i)
    collapsed = new Set([...collapsed].filter(x => x !== i).map(x => x > i ? x - 1 : x))
  }

  function toggleCollapse(i) {
    const next = new Set(collapsed)
    next.has(i) ? next.delete(i) : next.add(i)
    collapsed = next
  }

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
    if (q.correctKeys.includes(key)) {
      q.correctKeys = q.correctKeys.filter(k => k !== key)
    } else {
      q.correctKeys = [...q.correctKeys, key]
    }
  }

  function buildPayload(q, i) {
    const correct_answer = q.question_type === 'multiple' ? q.correctKeys : q.correct_answer
    return {
      content: q.content,
      options: q.options,
      correct_answer,
      points: q.points,
      order_index: i,
      explanation: q.explanation || null,
      question_type: q.question_type
    }
  }

  async function save() {
    error = ''
    if (!title) { error = 'Vui lòng nhập tiêu đề'; return }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (q.question_type === 'multiple' && q.correctKeys.length === 0) {
        error = `Câu ${i + 1}: Chưa chọn đáp án đúng`; return
      }
    }
    saving = true
    try {
      const updateRes = await examApi.update(exam.id, {
        title, description,
        time_limit: Number(time_limit),
        passing_score: passing_score !== '' ? Number(passing_score) : null,
        tags, show_explanation, allow_retake
      })
      if (!updateRes.ok) { const d = await updateRes.json(); error = d.error; return }

      for (const qid of deletedQIds) {
        await examApi.removeQuestion(exam.id, qid)
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const payload = buildPayload(q, i)
        if (q._existing && q.id) {
          await examApi.updateQuestion(exam.id, q.id, payload)
        } else {
          await examApi.addQuestion(exam.id, payload)
        }
      }

      goto(`/exams/${exam.id}`)
    } catch {
      error = 'Lỗi khi lưu đề thi'
    } finally {
      saving = false
    }
  }
</script>

<style>
  h1 { margin-bottom: 1.5rem; }
  .form-group { margin-bottom: 1rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; font-weight: 500; }
  input[type=text], input[type=number], textarea, select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  textarea { min-height: 80px; resize: vertical; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-weight: 600; }
  .q-header-left { display: flex; align-items: center; gap: 0.5rem; }
  .q-header-right { display: flex; align-items: center; gap: 0.5rem; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }
  .opt { display: flex; align-items: center; gap: 0.5rem; }
  .opt-key { width: 1.5rem; font-weight: 600; flex-shrink: 0; }
  .actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .btn-collapse { background: #f3f4f6; color: #374151; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
  .btn-sm { padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; }
  .q-preview { color: #6b7280; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
  .existing-badge { font-size: 0.7rem; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 500; }
  .error { color: #dc2626; margin-bottom: 1rem; }
  .hint { font-size: 0.8rem; color: #6b7280; margin-top: 0.2rem; }
  .tag-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; background: white; min-height: 2.4rem; }
  .tag-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 99px; padding: 0.1rem 0.6rem; font-size: 0.82rem; }
  .tag-chip button { border: none; background: none; cursor: pointer; color: #60a5fa; font-size: 0.9rem; padding: 0; line-height: 1; }
  .tag-input { border: none; outline: none; font-size: 0.9rem; flex: 1; min-width: 120px; }
  .correct-hint { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
  .section-label { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.4rem; margin-top: 0.75rem; display: block; }
  .type-badge { font-size: 0.72rem; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 0.1rem 0.5rem; border-radius: 99px; }
  .type-badge.multi { background: #fefce8; color: #ca8a04; border-color: #fde68a; }
  .expl-section { margin-top: 0.75rem; border-top: 1px solid #f3f4f6; padding-top: 0.75rem; }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error && !exam}<p class="error">{error}</p>
{:else if exam}

<h1>Sửa đề thi</h1>
{#if error}<p class="error">{error}</p>{/if}

<div class="card">
  <div class="form-group">
    <label for="title">Tiêu đề *</label>
    <input type="text" id="title" bind:value={title} />
  </div>
  <div class="form-group">
    <label for="desc">Mô tả</label>
    <textarea id="desc" bind:value={description}></textarea>
  </div>
  <div class="row2">
    <div class="form-group">
      <label for="time">Thời gian (phút)</label>
      <input id="time" type="number" bind:value={time_limit} min="1" max="300" />
    </div>
    <div class="form-group">
      <label for="passing">Điểm đạt (để trống = không yêu cầu)</label>
      <input id="passing" type="number" bind:value={passing_score} min="0" step="0.5" placeholder="VD: 5.0" />
      <p class="hint">Học sinh đạt khi điểm ≥ giá trị này</p>
    </div>
  </div>
  <div class="form-group">
    <label>Thẻ tag (tối đa 5)</label>
    <div class="tag-wrap">
      {#each tags as t}
        <span class="tag-chip">
          {t}
          <button type="button" onclick={() => removeTag(t)} aria-label="Xoá tag">×</button>
        </span>
      {/each}
      {#if tags.length < 5}
        <input
          class="tag-input"
          bind:value={tagInput}
          onkeydown={handleTagKeydown}
          onblur={addTag}
          placeholder="Nhập tag, Enter để thêm..."
        />
      {/if}
    </div>
    <p class="hint">Ví dụ: Toán, Lớp 10, Đại số</p>
  </div>
  <div class="form-group">
    <label for="exam_mode">Chế độ thi</label>
    <select id="exam_mode" bind:value={allow_retake} style="width:auto">
      <option value={false}>Thi chính thức — pass 1 lần, không thi lại</option>
      <option value={true}>Thi thực hành — làm đi làm lại nhiều lần</option>
    </select>
  </div>
  <div class="form-group" style="display:flex; align-items:center; gap:0.6rem">
    <input id="show_expl" type="checkbox" bind:checked={show_explanation} style="width:auto" />
    <label for="show_expl" style="margin:0; font-weight:400">Hiển thị giải thích cho học sinh sau khi nộp bài</label>
  </div>
</div>

<h2 style="margin-bottom:1rem">Câu hỏi ({questions.length})</h2>

{#each questions as q, i}
<div class="card">
  <div class="q-header">
    <div class="q-header-left">
      <span>Câu {i + 1}</span>
      {#if q._existing}<span class="existing-badge">Đã lưu</span>{/if}
      <span class="type-badge" class:multi={q.question_type === 'multiple'}>
        {q.question_type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
      </span>
      {#if collapsed.has(i) && q.content}
        <span class="q-preview">— {q.content}</span>
      {/if}
    </div>
    <div class="q-header-right">
      <button class="btn-collapse" onclick={() => toggleCollapse(i)}>
        {collapsed.has(i) ? '▼ Mở' : '▲ Thu gọn'}
      </button>
      <button class="btn-danger" onclick={() => removeQuestion(i)}>Xoá</button>
    </div>
  </div>

  {#if !collapsed.has(i)}
  <div class="form-group">
    <label for="qtype_{i}">Loại câu hỏi</label>
    <select id="qtype_{i}" bind:value={q.question_type} style="width:180px"
      onchange={() => { q.correctKeys = []; q.correct_answer = q.options[0]?.key ?? 'A' }}>
      <option value="single">1 đáp án đúng</option>
      <option value="multiple">Nhiều đáp án đúng</option>
    </select>
  </div>
  <div class="form-group">
    <label for="qc_{i}">Nội dung câu hỏi</label>
    <textarea id="qc_{i}" bind:value={q.content}></textarea>
  </div>

  <span class="section-label">Các đáp án</span>
  <div class="options">
    {#each q.options as opt}
    <div class="opt">
      {#if q.question_type === 'multiple'}
        <input type="checkbox"
          checked={q.correctKeys.includes(opt.key)}
          onchange={() => toggleCorrectKey(q, opt.key)}
          style="width:auto; flex-shrink:0"
          title="Đánh dấu đáp án đúng"
        />
      {/if}
      <span class="opt-key">{opt.key}.</span>
      <input type="text" bind:value={opt.text} placeholder="Đáp án {opt.key}" />
      {#if q.question_type === 'multiple' && q.options.length > 2}
        <button type="button" class="btn-danger" style="padding:0.2rem 0.4rem; flex-shrink:0" onclick={() => removeOption(q, opt.key)}>×</button>
      {/if}
    </div>
    {/each}
  </div>

  {#if q.question_type === 'multiple'}
    <p class="correct-hint">
      {q.correctKeys.length > 0 ? `✓ Đã chọn ${q.correctKeys.length} đáp án đúng: ${q.correctKeys.sort().join(', ')}` : 'Tích vào checkbox để chọn đáp án đúng'}
    </p>
    <button type="button" class="btn btn-outline btn-sm" style="margin-top:0.4rem" onclick={() => addOption(q)}>+ Thêm đáp án</button>
  {:else}
    <div class="form-group" style="margin-top:0.5rem; margin-bottom:0">
      <label for="qa_{i}">Đáp án đúng</label>
      <select id="qa_{i}" bind:value={q.correct_answer} style="width:100px">
        {#each q.options as opt}<option value={opt.key}>{opt.key}</option>{/each}
      </select>
    </div>
  {/if}

  <div style="display:flex; gap:1rem; margin-top:0.5rem">
    <div class="form-group" style="margin:0">
      <label for="qp_{i}">Điểm</label>
      <input id="qp_{i}" type="number" bind:value={q.points} min="0.5" step="0.5" style="width:100px" />
    </div>
  </div>

  <div class="expl-section">
    <label class="section-label" for="qe_{i}">Giải thích đáp án (markdown)</label>
    <MarkdownEditor bind:value={q.explanation} placeholder="Giải thích tại sao đáp án này đúng..." rows={4} />
  </div>
  {/if}
</div>
{/each}

<button class="btn btn-outline" onclick={addQuestion}>+ Thêm câu hỏi</button>

<div class="actions">
  <button class="btn btn-primary" onclick={save} disabled={saving}>
    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
  </button>
  <a href="/exams/{exam.id}"><button class="btn btn-outline">Huỷ</button></a>
</div>
{/if}
