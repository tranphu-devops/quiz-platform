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

  // Settings tab
  let settings = $state({ upload_max_size_mb: '5', upload_allowed_types: 'image/jpeg,image/png,image/webp,image/gif' })
  let settingsLoading = $state(false)
  let settingsSaving = $state(false)
  let settingsSuccess = $state(false)
  let settingsError = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role !== 'admin') { goto('/dashboard'); return }
    await Promise.all([loadUsers(), loadSettings()])
  })

  async function loadSettings() {
    settingsLoading = true
    try {
      const res = await userApi.getSettings()
      if (res.ok) settings = await res.json()
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
</style>

<h1>Quản trị</h1>

<div class="tabs">
  <button class="tab-btn" class:active={tab === 'users'} onclick={() => tab = 'users'}>Người dùng</button>
  <button class="tab-btn" class:active={tab === 'settings'} onclick={() => tab = 'settings'}>Cài đặt upload</button>
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
