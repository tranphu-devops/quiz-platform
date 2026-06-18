<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { examApi, collectionApi } from '$lib/api'
  import BadgePicker from '$lib/components/BadgePicker.svelte'

  let title = $state('')
  let description = $state('')
  let badgeUrl = $state('')
  let isPublished = $state(false)
  let selectedExamIds = $state([])
  let myExams = $state([])
  let saving = $state(false)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role === 'student') { goto('/dashboard'); return }
    const res = await examApi.list()
    if (res.ok) {
      const all = await res.json()
      myExams = all.filter(e => e.created_by === $user.id)
    }
  })

  function toggleExam(id) {
    selectedExamIds = selectedExamIds.includes(id)
      ? selectedExamIds.filter(x => x !== id)
      : [...selectedExamIds, id]
  }

  async function save() {
    if (!title.trim()) { error = 'Tên bộ đề không được để trống'; return }
    if (selectedExamIds.length === 0) { error = 'Cần chọn ít nhất 1 đề thi'; return }
    error = ''
    saving = true
    try {
      const res = await collectionApi.create({
        title: title.trim(),
        description: description.trim() || null,
        badge_image_url: badgeUrl || null,
        is_published: isPublished,
        exam_ids: selectedExamIds
      })
      if (!res.ok) {
        const d = await res.json()
        error = d.error ?? 'Lỗi tạo bộ đề'
        return
      }
      goto('/collections')
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      saving = false
    }
  }
</script>

<style>
  .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
  .back-btn { color: var(--muted); text-decoration: none; font-size: 0.9rem; padding: 0.3rem 0.6rem; border-radius: 6px; }
  .back-btn:hover { background: var(--bg); color: var(--primary); }
  h1 { font-size: 1.4rem; font-weight: 800; }

  .layout { display: grid; grid-template-columns: 1fr 360px; gap: 1.5rem; align-items: start; }
  @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }

  .card { background: var(--surface); border-radius: var(--radius-card); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1.25rem; }
  .card h2 { font-size: 0.95rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; }

  .form-row { margin-bottom: 1rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--text); }
  input[type=text], textarea {
    width: 100%; padding: 0.55rem 0.75rem;
    border: 1.5px solid var(--border); border-radius: 8px;
    font-size: 0.95rem; background: var(--bg); color: var(--text);
    transition: border-color 0.15s; font-family: inherit;
  }
  input[type=text]:focus, textarea:focus { outline: none; border-color: var(--primary); }
  textarea { min-height: 80px; resize: vertical; }

  /* Exam selector */
  .exam-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto; }
  .exam-item {
    display: flex; align-items: center; gap: 0.65rem;
    padding: 0.6rem 0.75rem; border-radius: 8px;
    border: 1.5px solid var(--border); cursor: pointer;
    transition: all 0.12s; background: var(--bg); user-select: none;
  }
  .exam-item:hover { border-color: var(--primary); background: var(--primary-light); }
  .exam-item.selected { border-color: var(--primary); background: var(--primary-light); }
  .exam-check { width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; }
  .exam-title { font-size: 0.9rem; font-weight: 600; flex: 1; }
  .exam-meta { font-size: 0.75rem; color: var(--muted); }

  .toggle-row { display: flex; align-items: center; gap: 0.75rem; }
  .toggle { position: relative; width: 40px; height: 22px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 99px; background: var(--border);
    cursor: pointer; transition: background 0.2s;
  }
  .toggle input:checked + .toggle-track { background: var(--primary); }
  .toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 16px; height: 16px; border-radius: 50%; background: white;
    transition: transform 0.2s;
  }
  .toggle input:checked ~ .toggle-thumb { transform: translateX(18px); }

  .error { color: var(--danger); font-size: 0.875rem; margin-bottom: 0.75rem; }
  .btn-save {
    width: 100%; padding: 0.75rem;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: #fff; border: none; border-radius: var(--radius-btn);
    font-size: 1rem; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.15s;
  }
  .btn-save:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(99,102,241,0.45); transform: translateY(-1px); }
  .btn-save:disabled { opacity: 0.55; cursor: default; transform: none; }
</style>

<div class="page-header">
  <a href="/collections" class="back-btn">← Quay lại</a>
  <h1>Tạo bộ đề mới</h1>
</div>

<div class="layout">
  <!-- Left: main form -->
  <div>
    <div class="card">
      <h2>📋 Thông tin bộ đề</h2>
      <div class="form-row">
        <label for="title">Tên bộ đề *</label>
        <input id="title" type="text" bind:value={title} placeholder="Ví dụ: AWS Solutions Architect" />
      </div>
      <div class="form-row">
        <label for="desc">Mô tả</label>
        <textarea id="desc" bind:value={description} placeholder="Mô tả ngắn về bộ đề..."></textarea>
      </div>
    </div>

    <div class="card">
      <h2>📝 Chọn đề thi ({selectedExamIds.length} đã chọn)</h2>
      {#if myExams.length === 0}
        <p style="color:var(--muted); font-size:0.875rem">Bạn chưa có đề thi nào. <a href="/exams/create" style="color:var(--primary)">Tạo đề thi ngay →</a></p>
      {:else}
        <div class="exam-list">
          {#each myExams as exam}
            <div class="exam-item {selectedExamIds.includes(exam.id) ? 'selected' : ''}"
              onclick={() => toggleExam(exam.id)} role="checkbox" tabindex="0"
              onkeydown={e => e.key === ' ' && toggleExam(exam.id)}>
              <input class="exam-check" type="checkbox" checked={selectedExamIds.includes(exam.id)} tabindex="-1" />
              <div>
                <div class="exam-title">{exam.title}</div>
                <div class="exam-meta">
                  {exam.questions_count ?? '?'} câu · {exam.time_limit} phút
                  {exam.is_published ? '' : ' · Nháp'}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: badge + publish -->
  <div>
    <div class="card">
      <h2>🏅 Huy hiệu hoàn thành</h2>
      <p style="font-size:0.82rem; color:var(--muted); margin-bottom:0.75rem">
        Student sẽ nhận huy hiệu này khi hoàn thành tất cả đề thi trong bộ.
      </p>
      <BadgePicker bind:value={badgeUrl} label="huy hiệu" />
    </div>

    <div class="card">
      <h2>⚙️ Cài đặt</h2>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" bind:checked={isPublished} />
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
        <span style="font-size:0.9rem">Xuất bản ngay</span>
      </div>
      <p style="font-size:0.78rem; color:var(--muted); margin-top:0.5rem">
        Chỉ bộ đề đã xuất bản mới hiển thị với student và kích hoạt tặng huy hiệu.
      </p>
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn-save" onclick={save} disabled={saving}>
      {saving ? 'Đang lưu...' : '✓ Tạo bộ đề'}
    </button>
  </div>
</div>
