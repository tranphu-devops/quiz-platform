<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi } from '$lib/api'

  let tab = $state('users')

  // Users tab
  let users = $state([])
  let loading = $state(true)
  let error = $state('')
  let updating = $state({})
  let editingCredits = $state({})   // { [userId]: newValue }
  let savingCredits = $state({})

  // Settings tab (upload)
  let settings = $state({ upload_max_size_mb: '5', upload_allowed_types: 'image/jpeg,image/png,image/webp,image/gif' })
  let settingsLoading = $state(false)
  let settingsSaving = $state(false)
  let settingsSuccess = $state(false)
  let settingsError = $state('')

  // Credits tab
  let creditSettings = $state({ default_credits: '20', teacher_upgrade_cost: '100', default_exam_cost: '10' })
  let creditSaving = $state(false)
  let creditSuccess = $state(false)
  let creditError = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role !== 'admin') { goto('/dashboard'); return }
    await Promise.all([loadUsers(), loadSettings()])
  })

  async function loadSettings() {
    settingsLoading = true
    try {
      const res = await userApi.getSettings()
      if (res.ok) {
        const all = await res.json()
        settings = {
          upload_max_size_mb: all.upload_max_size_mb ?? '5',
          upload_allowed_types: all.upload_allowed_types ?? 'image/jpeg,image/png,image/webp,image/gif'
        }
        creditSettings = {
          default_credits: all.default_credits ?? '20',
          teacher_upgrade_cost: all.teacher_upgrade_cost ?? '100',
          default_exam_cost: all.default_exam_cost ?? '10'
        }
      }
    } catch {} finally {
      settingsLoading = false
    }
  }

  async function saveSettings() {
    settingsError = ''
    settingsSuccess = false
    settingsSaving = true
    try {
      const res = await userApi.updateSettings(settings)
      if (!res.ok) { const d = await res.json(); settingsError = d.error ?? 'Lỗi lưu settings'; return }
      settingsSuccess = true
    } catch {
      settingsError = 'Không thể kết nối server'
    } finally {
      settingsSaving = false
    }
  }

  async function saveCreditSettings() {
    creditError = ''
    creditSuccess = false
    creditSaving = true
    try {
      const res = await userApi.updateSettings(creditSettings)
      if (!res.ok) { const d = await res.json(); creditError = d.error ?? 'Lỗi lưu cài đặt'; return }
      creditSuccess = true
    } catch {
      creditError = 'Không thể kết nối server'
    } finally {
      creditSaving = false
    }
  }

  async function loadUsers() {
    loading = true
    error = ''
    try {
      const res = await userApi.adminListUsers()
      if (!res.ok) { error = `Lỗi ${res.status}`; return }
      users = await res.json()
    } catch {
      error = 'Không thể tải danh sách người dùng'
    } finally {
      loading = false
    }
  }

  async function changeRole(id, role) {
    updating = { ...updating, [id]: true }
    try {
      const res = await userApi.adminUpdateRole(id, role)
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Lỗi cập nhật role')
        return
      }
      users = users.map(u => u.id === id ? { ...u, role } : u)
    } catch {
      alert('Không thể cập nhật role')
    } finally {
      const next = { ...updating }
      delete next[id]
      updating = next
    }
  }

  function startEditCredits(u) {
    editingCredits = { ...editingCredits, [u.id]: String(u.credits ?? 0) }
  }
  function cancelEditCredits(id) {
    const next = { ...editingCredits }
    delete next[id]
    editingCredits = next
  }
  async function saveUserCredits(u) {
    const val = parseInt(editingCredits[u.id], 10)
    if (isNaN(val) || val < 0) { alert('Giá trị không hợp lệ'); return }
    savingCredits = { ...savingCredits, [u.id]: true }
    try {
      const res = await userApi.adminUpdateCredits(u.id, val)
      if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Lỗi'); return }
      users = users.map(x => x.id === u.id ? { ...x, credits: val } : x)
      cancelEditCredits(u.id)
    } catch {
      alert('Không thể cập nhật')
    } finally {
      const next = { ...savingCredits }
      delete next[u.id]
      savingCredits = next
    }
  }

  function roleColor(role) {
    if (role === 'admin') return '#dc2626'
    if (role === 'teacher') return '#d97706'
    return '#2563eb'
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
</script>

<style>
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  .tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; }
  .tab-btn { padding: 0.6rem 1.2rem; border: none; background: none; cursor: pointer; font-size: 0.95rem; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px; }
  .tab-btn.active { color: #1e40af; border-bottom-color: #1e40af; font-weight: 600; }
  .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .stat { background: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .stat-value { font-size: 2rem; font-weight: 700; color: #1e40af; }
  .stat-label { font-size: 0.85rem; color: #6b7280; }
  .card { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  .settings-card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); max-width: 520px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.75rem 1rem; font-size: 0.8rem; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; color: white; }
  select { padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
  select:disabled { opacity: 0.5; cursor: not-allowed; }
  .note { font-size: 0.8rem; color: #9ca3af; margin-top: 1rem; }
  .error { color: #dc2626; margin-bottom: 1rem; font-size: 0.9rem; }
  .success { color: #16a34a; margin-bottom: 1rem; font-size: 0.9rem; }
  .form-group { margin-bottom: 1.25rem; }
  .form-group label { display: block; margin-bottom: 0.3rem; font-size: 0.9rem; font-weight: 500; }
  .form-group input[type=text], .form-group input[type=number] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  .hint { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  /* credit inline edit */
  .credit-cell { display: flex; align-items: center; gap: 0.4rem; }
  .credit-val { font-weight: 600; color: #1e40af; min-width: 2rem; }
  .btn-edit-credit { padding: 0.15rem 0.5rem; font-size: 0.75rem; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer; }
  .btn-edit-credit:hover { background: #dbeafe; }
  .credit-input { width: 70px; padding: 0.2rem 0.4rem; border: 1px solid #93c5fd; border-radius: 4px; font-size: 0.9rem; }
  .btn-save-credit { padding: 0.15rem 0.5rem; font-size: 0.75rem; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn-cancel-credit { padding: 0.15rem 0.5rem; font-size: 0.75rem; background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
</style>

<h1>Quản trị</h1>

<div class="tabs">
  <button class="tab-btn" class:active={tab === 'users'} onclick={() => tab = 'users'}>Người dùng</button>
  <button class="tab-btn" class:active={tab === 'settings'} onclick={() => tab = 'settings'}>Cài đặt upload</button>
  <button class="tab-btn" class:active={tab === 'credits'} onclick={() => tab = 'credits'}>Credits</button>
</div>

{#if tab === 'users'}

{#if error}
  <p class="error">{error}</p>
{:else if loading}
  <p style="color: #6b7280">Đang tải...</p>
{:else}
  <div class="stats">
    <div class="stat">
      <div class="stat-value">{users.length}</div>
      <div class="stat-label">Tổng người dùng</div>
    </div>
    <div class="stat">
      <div class="stat-value">{users.filter(u => u.role === 'teacher').length}</div>
      <div class="stat-label">Giáo viên</div>
    </div>
    <div class="stat">
      <div class="stat-value">{users.filter(u => u.role === 'student').length}</div>
      <div class="stat-label">Học sinh</div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Họ tên</th>
          <th>Role</th>
          <th>Credits</th>
          <th>Ngày tạo</th>
          <th>Đăng nhập gần nhất</th>
          <th>Đổi role</th>
        </tr>
      </thead>
      <tbody>
        {#each users as u (u.id)}
          <tr>
            <td>{u.email}</td>
            <td>{u.full_name ?? '—'}</td>
            <td>
              <span class="badge" style="background: {roleColor(u.role)}">{u.role}</span>
            </td>
            <td>
              {#if editingCredits[u.id] !== undefined}
                <div class="credit-cell">
                  <input class="credit-input" type="number" min="0" bind:value={editingCredits[u.id]} />
                  <button class="btn-save-credit" onclick={() => saveUserCredits(u)} disabled={savingCredits[u.id]}>✓</button>
                  <button class="btn-cancel-credit" onclick={() => cancelEditCredits(u.id)}>✕</button>
                </div>
              {:else}
                <div class="credit-cell">
                  <span class="credit-val">{u.credits ?? '—'}</span>
                  <button class="btn-edit-credit" onclick={() => startEditCredits(u)}>Sửa</button>
                </div>
              {/if}
            </td>
            <td>{fmtDate(u.created_at)}</td>
            <td>{fmtDate(u.last_sign_in_at)}</td>
            <td>
              <select
                value={u.role}
                disabled={updating[u.id]}
                onchange={(e) => changeRole(u.id, e.target.value)}
              >
                <option value="student">student</option>
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
              </select>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <p class="note">* Role mới có hiệu lực khi người dùng đăng nhập lại.</p>
{/if}

{/if}

{#if tab === 'settings'}
<div class="settings-card">
  {#if settingsError}<p class="error">{settingsError}</p>{/if}
  {#if settingsSuccess}<p class="success">Đã lưu cài đặt!</p>{/if}

  {#if settingsLoading}
    <p style="color:#6b7280">Đang tải...</p>
  {:else}
    <div class="form-group">
      <label for="max_size">Dung lượng tối đa (MB)</label>
      <input id="max_size" type="number" bind:value={settings.upload_max_size_mb} min="1" max="50" step="1" style="width:120px" />
      <p class="hint">Áp dụng cho tất cả loại ảnh upload</p>
    </div>

    <div class="form-group">
      <label for="allowed_types">Loại file cho phép (MIME types, cách nhau bằng dấu phẩy)</label>
      <input id="allowed_types" type="text" bind:value={settings.upload_allowed_types} placeholder="image/jpeg,image/png,image/webp,image/gif" />
      <p class="hint">Ví dụ: image/jpeg,image/png,image/webp,image/gif</p>
    </div>

    <button class="btn btn-primary" onclick={saveSettings} disabled={settingsSaving}>
      {settingsSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
    </button>
  {/if}
</div>
{/if}

{#if tab === 'credits'}
<div class="settings-card">
  {#if creditError}<p class="error">{creditError}</p>{/if}
  {#if creditSuccess}<p class="success">Đã lưu cài đặt credit!</p>{/if}

  {#if settingsLoading}
    <p style="color:#6b7280">Đang tải...</p>
  {:else}
    <div class="form-group">
      <label for="default_credits">Credit mặc định cho user mới</label>
      <input id="default_credits" type="number" bind:value={creditSettings.default_credits} min="0" step="1" style="width:120px" />
      <p class="hint">Số credit được cấp khi tạo tài khoản mới</p>
    </div>

    <div class="form-group">
      <label for="teacher_upgrade_cost">Credit để nâng cấp lên Teacher</label>
      <input id="teacher_upgrade_cost" type="number" bind:value={creditSettings.teacher_upgrade_cost} min="0" step="1" style="width:120px" />
      <p class="hint">Student cần số credit này để mua gói Teacher</p>
    </div>

    <div class="form-group">
      <label for="default_exam_cost">Credit mặc định mỗi bài thi</label>
      <input id="default_exam_cost" type="number" bind:value={creditSettings.default_exam_cost} min="0" step="1" style="width:120px" />
      <p class="hint">Áp dụng khi giáo viên không cài đặt giá riêng cho bài thi</p>
    </div>

    <button class="btn btn-primary" onclick={saveCreditSettings} disabled={creditSaving}>
      {creditSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
    </button>
  {/if}
</div>
{/if}
