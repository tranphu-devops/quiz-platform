<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'

  let exam = $state(null)
  let title = $state('')
  let description = $state('')
  let time_limit = $state(30)
  let passing_score = $state('')
  let questions = $state([])
  let deletedQIds = $state([])
  let collapsed = $state(new Set())
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

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
      questions = (exam.questions ?? []).map(q => ({ ...q, _existing: true }))
      // Collapse all existing questions by default
      collapsed = new Set(questions.map((_, i) => i))
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  function addQuestion() {
    questions = [...questions, {
      content: '', options: [
        { key: 'A', text: '' }, { key: 'B', text: '' },
        { key: 'C', text: '' }, { key: 'D', text: '' }
      ], correct_answer: 'A', points: 1, _existing: false
    }]
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

  async function save() {
    error = ''
    if (!title) { error = 'Vui lòng nhập tiêu đề'; return }
    saving = true
    try {
      const updateRes = await examApi.update(exam.id, {
        title, description,
        time_limit: Number(time_limit),
        passing_score: passing_score !== '' ? Number(passing_score) : null
      })
      if (!updateRes.ok) { const d = await updateRes.json(); error = d.error; return }

      for (const qid of deletedQIds) {
        await examApi.removeQuestion(exam.id, qid)
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const payload = {
          content: q.content,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          order_index: i
        }
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
  input, textarea, select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  textarea { min-height: 80px; resize: vertical; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-weight: 600; }
  .q-header-left { display: flex; align-items: center; gap: 0.5rem; }
  .q-header-right { display: flex; align-items: center; gap: 0.5rem; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }
  .opt { display: flex; align-items: center; gap: 0.5rem; }
  .opt span { width: 1.5rem; font-weight: 600; flex-shrink: 0; }
  .actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .btn-collapse { background: #f3f4f6; color: #374151; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
  .q-preview { color: #6b7280; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
  .existing-badge { font-size: 0.7rem; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 500; }
  .error { color: #dc2626; margin-bottom: 1rem; }
  .hint { font-size: 0.8rem; color: #6b7280; margin-top: 0.2rem; }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exam}

<h1>Sửa đề thi</h1>
{#if error}<p class="error">{error}</p>{/if}

<div class="card">
  <div class="form-group">
    <label for="title">Tiêu đề *</label>
    <input id="title" bind:value={title} />
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
</div>

<h2 style="margin-bottom:1rem">Câu hỏi ({questions.length})</h2>

{#each questions as q, i}
<div class="card">
  <div class="q-header">
    <div class="q-header-left">
      <span>Câu {i + 1}</span>
      {#if q._existing}<span class="existing-badge">Đã lưu</span>{/if}
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
    <label for="qc_{i}">Nội dung câu hỏi</label>
    <textarea id="qc_{i}" bind:value={q.content}></textarea>
  </div>
  <label>Các đáp án</label>
  <div class="options">
    {#each q.options as opt}
    <div class="opt">
      <span>{opt.key}.</span>
      <input bind:value={opt.text} placeholder="Đáp án {opt.key}" />
    </div>
    {/each}
  </div>
  <div style="display:flex; gap:1rem; margin-top:0.5rem">
    <div class="form-group" style="margin:0">
      <label for="qa_{i}">Đáp án đúng</label>
      <select id="qa_{i}" bind:value={q.correct_answer} style="width:100px">
        {#each q.options as opt}<option value={opt.key}>{opt.key}</option>{/each}
      </select>
    </div>
    <div class="form-group" style="margin:0">
      <label for="qp_{i}">Điểm</label>
      <input id="qp_{i}" type="number" bind:value={q.points} min="0.5" step="0.5" style="width:100px" />
    </div>
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
