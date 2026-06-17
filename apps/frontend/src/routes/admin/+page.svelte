<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi } from '$lib/api'

  let users = $state([])
  let loading = $state(true)
  let error = $state('')
  let updating = $state({})

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role !== 'admin') { goto('/dashboard'); return }
    await loadUsers()
  })

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
  h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
  .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .stat { background: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .stat-value { font-size: 2rem; font-weight: 700; color: #1e40af; }
  .stat-label { font-size: 0.85rem; color: #6b7280; }
  .card { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.75rem 1rem; font-size: 0.8rem; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; color: white; }
  select { padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
  select:disabled { opacity: 0.5; cursor: not-allowed; }
  .note { font-size: 0.8rem; color: #9ca3af; margin-top: 1rem; }
  .error { color: #dc2626; margin-bottom: 1rem; }
</style>

<h1>Quản trị người dùng</h1>

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
