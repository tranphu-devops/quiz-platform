<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let title = $state('')
  let description = $state('')
  let time_limit = $state(30)
  let questions = $state([])
  let error = $state('')
  let saving = $state(false)
  let examId = $state(null)

  onMount(() => {
    if (!$user || $user.role === 'student') goto('/exams')
  })

  function addQuestion() {
    questions = [...questions, { content: '', options: [
      { key: 'A', text: '' }, { key: 'B', text: '' },
      { key: 'C', text: '' }, { key: 'D', text: '' }
    ], correct_answer: 'A', points: 1 }]
  }

  function removeQuestion(i) {
    questions = questions.filter((_, idx) => idx !== i)
  }

  async function save() {
    error = ''
    if (!title) { error = 'Vui lòng nhập tiêu đề'; return }
    saving = true
    try {
      const res = await examApi.create({ title, description, time_limit: Number(time_limit) })
      const data = await res.json()
      if (!res.ok) { error = data.error; return }

      examId = data.id
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        await examApi.addQuestion(examId, { ...q, order_index: i })
      }

      goto(`/exams/${examId}`)
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
  input, textarea, select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
  textarea { min-height: 80px; resize: vertical; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-header { display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-weight: 600; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }
  .opt { display: flex; align-items: center; gap: 0.5rem; }
  .opt span { width: 1.5rem; font-weight: 600; }
  .actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; }
  .error { color: #dc2626; margin-bottom: 1rem; }
</style>

<h1>Tạo đề thi mới</h1>
{#if error}<p class="error">{error}</p>{/if}

<div class="card">
  <div class="form-group">
    <label>Tiêu đề *</label>
    <input bind:value={title} placeholder="Nhập tiêu đề đề thi..." />
  </div>
  <div class="form-group">
    <label>Mô tả</label>
    <textarea bind:value={description} placeholder="Mô tả về đề thi..."></textarea>
  </div>
  <div class="form-group">
    <label>Thời gian (phút)</label>
    <input type="number" bind:value={time_limit} min="1" max="300" style="width:120px" />
  </div>
</div>

<h2 style="margin-bottom:1rem">Câu hỏi ({questions.length})</h2>

{#each questions as q, i}
<div class="card">
  <div class="q-header">
    <span>Câu {i + 1}</span>
    <button class="btn-danger" onclick={() => removeQuestion(i)}>Xoá</button>
  </div>
  <div class="form-group">
    <label>Nội dung câu hỏi</label>
    <textarea bind:value={q.content} placeholder="Nhập nội dung câu hỏi..."></textarea>
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
  <div class="form-group" style="margin-top:0.5rem">
    <label>Đáp án đúng</label>
    <select bind:value={q.correct_answer} style="width:100px">
      {#each q.options as opt}<option value={opt.key}>{opt.key}</option>{/each}
    </select>
  </div>
  <div class="form-group">
    <label>Điểm</label>
    <input type="number" bind:value={q.points} min="0.5" step="0.5" style="width:100px" />
  </div>
</div>
{/each}

<button class="btn btn-outline" onclick={addQuestion}>+ Thêm câu hỏi</button>

<div class="actions">
  <button class="btn btn-primary" onclick={save} disabled={saving}>
    {saving ? 'Đang lưu...' : 'Lưu đề thi'}
  </button>
  <a href="/exams"><button class="btn btn-outline">Huỷ</button></a>
</div>
