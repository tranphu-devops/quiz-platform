<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi, collectionApi } from '$lib/api'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import { t, locale, localeCode } from '$lib/i18n'

  let tab = $state('users')

  // ── Users tab ──────────────────────────────────────────────────────────────
  let users = $state([])
  let loading = $state(true)
  let error = $state('')
  let updating = $state({})
  let editingCredits = $state({})
  let savingCredits = $state({})

  // ── Create user modal ──────────────────────────────────────────────────────
  let showCreate = $state(false)
  let createForm = $state({ email: '', password: '', full_name: '', role: 'student' })
  let createError = $state('')
  let createLoading = $state(false)

  function openCreate() { createForm = { email: '', password: '', full_name: '', role: 'student' }; createError = ''; showCreate = true }
  function closeCreate() { showCreate = false }

  async function submitCreate() {
    createError = ''
    if (!createForm.email || !createForm.password) { createError = $t('admin.emailPasswordRequired'); return }
    createLoading = true
    try {
      const res = await userApi.adminCreateUser(createForm)
      const d = await res.json()
      if (!res.ok) { createError = d.error ?? $t('admin.createAccountError'); return }
      users = [{ ...d, created_at: new Date().toISOString(), last_sign_in_at: null }, ...users]
      closeCreate()
    } catch { createError = $t('imageUpload.connectionError') } finally { createLoading = false }
  }

  // ── Settings tab ───────────────────────────────────────────────────────────
  let settings = $state({ upload_max_size_mb: '5', upload_allowed_types: 'image/jpeg,image/png,image/webp,image/gif' })
  let settingsLoading = $state(false)
  let settingsSaving = $state(false)
  let settingsSuccess = $state(false)
  let settingsError = $state('')

  // ── Credits tab ────────────────────────────────────────────────────────────
  let creditSettings = $state({ default_credits: '20', teacher_upgrade_cost: '100', default_exam_cost: '10' })
  let creditSaving = $state(false)
  let creditSuccess = $state(false)
  let creditError = $state('')

  // ── Collections tab ────────────────────────────────────────────────────────
  let collections = $state([])
  let collectionsLoading = $state(false)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role !== 'admin') { goto('/dashboard'); return }
    await Promise.all([loadUsers(), loadSettings()])
  })

  async function loadCollections() {
    if (collections.length) return
    collectionsLoading = true
    try {
      const res = await collectionApi.list()
      if (res.ok) collections = await res.json()
    } catch {} finally {
      collectionsLoading = false
    }
  }

  async function toggleCollectionPublish(col) {
    const res = await collectionApi.update(col.id, { is_published: !col.is_published })
    if (res.ok) collections = collections.map(c => c.id === col.id ? { ...c, is_published: !c.is_published } : c)
  }

  async function deleteCollection(id) {
    if (!confirm($t('collections.confirmDelete'))) return
    const res = await collectionApi.remove(id)
    if (res.ok) collections = collections.filter(c => c.id !== id)
  }

  async function loadSettings() {
    settingsLoading = true
    try {
      const res = await userApi.getSettings()
      if (res.ok) {
        const all = await res.json()
        settings = { upload_max_size_mb: all.upload_max_size_mb ?? '5', upload_allowed_types: all.upload_allowed_types ?? 'image/jpeg,image/png,image/webp,image/gif' }
        creditSettings = { default_credits: all.default_credits ?? '20', teacher_upgrade_cost: all.teacher_upgrade_cost ?? '100', default_exam_cost: all.default_exam_cost ?? '10' }
      }
    } catch {} finally { settingsLoading = false }
  }

  async function saveSettings() {
    settingsError = ''; settingsSuccess = false; settingsSaving = true
    try {
      const res = await userApi.updateSettings(settings)
      if (!res.ok) { const d = await res.json(); settingsError = d.error ?? $t('admin.saveSettingsError'); return }
      settingsSuccess = true
    } catch { settingsError = $t('imageUpload.connectionError') } finally { settingsSaving = false }
  }

  async function saveCreditSettings() {
    creditError = ''; creditSuccess = false; creditSaving = true
    try {
      const res = await userApi.updateSettings(creditSettings)
      if (!res.ok) { const d = await res.json(); creditError = d.error ?? $t('admin.saveConfigError'); return }
      creditSuccess = true
    } catch { creditError = $t('imageUpload.connectionError') } finally { creditSaving = false }
  }

  async function loadUsers() {
    loading = true; error = ''
    try {
      const res = await userApi.adminListUsers()
      if (!res.ok) { error = $t('admin.errorStatus', { status: res.status }); return }
      users = await res.json()
    } catch { error = $t('admin.loadUsersError') } finally { loading = false }
  }

  async function changeRole(id, role) {
    updating = { ...updating, [id]: true }
    try {
      const res = await userApi.adminUpdateRole(id, role)
      if (!res.ok) { const data = await res.json(); alert(data.error ?? $t('admin.updateRoleError')); return }
      users = users.map(u => u.id === id ? { ...u, role } : u)
    } catch { alert($t('admin.updateRoleFailed')) } finally {
      const next = { ...updating }; delete next[id]; updating = next
    }
  }

  function startEditCredits(u) { editingCredits = { ...editingCredits, [u.id]: String(u.credits ?? 0) } }
  function cancelEditCredits(id) { const next = { ...editingCredits }; delete next[id]; editingCredits = next }
  async function saveUserCredits(u) {
    const val = parseInt(editingCredits[u.id], 10)
    if (isNaN(val) || val < 0) { alert($t('admin.invalidValue')); return }
    savingCredits = { ...savingCredits, [u.id]: true }
    try {
      const res = await userApi.adminUpdateCredits(u.id, val)
      if (!res.ok) { const d = await res.json(); alert(d.error ?? $t('common.error')); return }
      users = users.map(x => x.id === u.id ? { ...x, credits: val } : x)
      cancelEditCredits(u.id)
    } catch { alert($t('admin.updateFailed')) } finally {
      const next = { ...savingCredits }; delete next[u.id]; savingCredits = next
    }
  }

  function roleColor(role) {
    if (role === 'admin')   return { bg: 'rgba(220,38,38,0.1)',  text: '#dc2626' }
    if (role === 'teacher') return { bg: 'rgba(217,119,6,0.1)',  text: '#b45309' }
    if (role === 'banned')  return { bg: 'rgba(107,114,128,0.1)',text: '#6b7280' }
    return { bg: 'rgba(37,99,235,0.1)', text: '#2563eb' }
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(localeCode($locale), { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // ── Icon strings ───────────────────────────────────────────────────────────
  const I = {
    edit:     `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5l2.5-1 6.5-6.5-1.5-1.5L2.5 9 1.5 11.5z"/><path d="M8.5 2.5l2 2"/></svg>`,
    trash:    `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="3.5" x2="11" y2="3.5"/><path d="M4.5 3.5V2h4v1.5"/><path d="M3 3.5l.5 8h6l.5-8"/></svg>`,
    check:    `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2"/></svg>`,
    x:        `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>`,
    publish:  `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5L6.5 9M3.5 4.5L6.5 1.5l3 3"/><path d="M2 9.5v1.5a1 1 0 001 1h7a1 1 0 001-1V9.5"/></svg>`,
  }

  let totalUsers   = $derived(users.length)
  let totalTeacher = $derived(users.filter(u => u.role === 'teacher').length)
  let totalStudent = $derived(users.filter(u => u.role === 'student').length)
  let totalBanned  = $derived(users.filter(u => u.role === 'banned').length)
</script>

<PageHeader title={$t('nav.admin')} />

<div class="tab-nav">
  <button class="tab-btn" class:active={tab === 'users'}       onclick={() => tab = 'users'}>{$t('admin.tabUsers')}</button>
  <button class="tab-btn" class:active={tab === 'collections'} onclick={() => { tab = 'collections'; loadCollections() }}>{$t('nav.collections')}</button>
  <button class="tab-btn" class:active={tab === 'settings'}    onclick={() => tab = 'settings'}>{$t('admin.tabUploadSettings')}</button>
  <button class="tab-btn" class:active={tab === 'credits'}     onclick={() => tab = 'credits'}>{$t('admin.tabCredits')}</button>
</div>

<div class="admin-content">

    <!-- ── USERS TAB ───────────────────────────────────────────────────── -->
    {#if tab === 'users'}
      {#if error}
        <p class="ix-error">{error}</p>
      {:else if loading}
        <p class="ix-loading">{$t('common.loading')}</p>
      {:else}
        <!-- Stats row -->
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-num">{totalUsers}</span>
            <span class="stat-lbl">{$t('admin.totalUsers')}</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-num">{totalTeacher}</span>
            <span class="stat-lbl">{$t('roles.teacher')}</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-num">{totalStudent}</span>
            <span class="stat-lbl">{$t('roles.student')}</span>
          </div>
          {#if totalBanned > 0}
            <div class="stat-sep"></div>
            <div class="stat-item">
              <span class="stat-num" style="color: var(--danger)">{totalBanned}</span>
              <span class="stat-lbl">{$t('roles.banned')}</span>
            </div>
          {/if}
        </div>

        <!-- Create user bar -->
        <div class="create-user-bar">
          <Button onclick={openCreate}>+ {$t('admin.createAccount')}</Button>
        </div>

        <!-- Users table -->
        <Card noPad={true}>
          <div class="ix-table-wrap">
            <table class="ix-table">
              <thead>
                <tr>
                  <th>{$t('admin.thEmail')}</th>
                  <th>{$t('admin.thFullName')}</th>
                  <th>{$t('admin.thRole')}</th>
                  <th>{$t('admin.thCredits')}</th>
                  <th>{$t('admin.thCreatedAt')}</th>
                  <th>{$t('admin.thLastLogin')}</th>
                  <th>{$t('admin.thChangeRole')}</th>
                  <th>{$t('admin.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each users as u (u.id)}
                  {@const rc = roleColor(u.role)}
                  <tr>
                    <td class="td-email">{u.email}</td>
                    <td class="td-name">{u.full_name ?? '—'}</td>
                    <td>
                      <span class="role-pill" style="background:{rc.bg};color:{rc.text}">{$t(`roles.${u.role}`)}</span>
                    </td>
                    <td>
                      {#if editingCredits[u.id] !== undefined}
                        <div class="credit-edit">
                          <input
                            class="credit-input"
                            type="number"
                            min="0"
                            bind:value={editingCredits[u.id]}
                            aria-label={$t('admin.newCreditsAria')}
                          />
                          <button
                            class="icon-btn icon-btn--green"
                            onclick={() => saveUserCredits(u)}
                            disabled={savingCredits[u.id]}
                            aria-label={$t('common.save')}
                          >{@html I.check}</button>
                          <button
                            class="icon-btn"
                            onclick={() => cancelEditCredits(u.id)}
                            aria-label={$t('common.cancel')}
                          >{@html I.x}</button>
                        </div>
                      {:else}
                        <div class="credit-view">
                          <span class="credit-val">{u.credits ?? '—'}</span>
                          <button
                            class="icon-btn"
                            onclick={() => startEditCredits(u)}
                            aria-label={$t('admin.editCreditsAria')}
                          >{@html I.edit}</button>
                        </div>
                      {/if}
                    </td>
                    <td class="td-date">{fmtDate(u.created_at)}</td>
                    <td class="td-date">{fmtDate(u.last_sign_in_at)}</td>
                    <td>
                      <select
                        class="role-select"
                        value={u.role}
                        disabled={updating[u.id]}
                        onchange={(e) => changeRole(u.id, e.target.value)}
                        aria-label={$t('admin.changeRoleAria', { email: u.email })}
                      >
                        <option value="student">{$t('roles.student')}</option>
                        <option value="teacher">{$t('roles.teacher')}</option>
                        <option value="admin">{$t('roles.admin')}</option>
                        <option value="banned">{$t('roles.banned')}</option>
                      </select>
                    </td>
                    <td>
                      <a href="/admin/users/{u.id}/edit" class="edit-user-link">{$t('common.edit')}</a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>
        <p class="ix-note">{$t('admin.roleNote')}</p>
      {/if}
    {/if}

    <!-- ── COLLECTIONS TAB ─────────────────────────────────────────────── -->
    {#if tab === 'collections'}
      {#if collectionsLoading}
        <p class="ix-loading">{$t('common.loading')}</p>
      {:else if collections.length === 0}
        <p class="ix-loading">{$t('admin.noCollectionsYet')}</p>
      {:else}
        <!-- Stats row -->
        <div class="stats-row" style="margin-bottom:20px">
          <div class="stat-item">
            <span class="stat-num">{collections.length}</span>
            <span class="stat-lbl">{$t('admin.totalCollections')}</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-num">{collections.filter(c => c.is_published).length}</span>
            <span class="stat-lbl">{$t('examDetail.publishedBadge')}</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-num">{collections.reduce((s,c) => s + (c.badge_count ?? 0), 0)}</span>
            <span class="stat-lbl">{$t('admin.badgesAwarded')}</span>
          </div>
        </div>

        <Card noPad={true}>
          <div class="ix-table-wrap">
            <table class="ix-table">
              <thead>
                <tr>
                  <th>{$t('admin.thCollection')}</th>
                  <th>{$t('admin.thExams')}</th>
                  <th>{$t('admin.thBadges')}</th>
                  <th>{$t('admin.thStatus')}</th>
                  <th>{$t('admin.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each collections as col}
                  <tr>
                    <td>
                      <div class="col-title-cell">
                        <div class="col-avatar">
                          {#if col.badge_image_url}
                            <img src={col.badge_image_url} alt="" />
                          {:else}
                            🎖️
                          {/if}
                        </div>
                        <div>
                          <div class="col-name">{col.title}</div>
                          {#if col.description}
                            <div class="col-desc">{col.description}</div>
                          {/if}
                        </div>
                      </div>
                    </td>
                    <td class="td-num">{col.exams?.length ?? 0}</td>
                    <td class="td-num">{col.badge_count ?? 0}</td>
                    <td>
                      <span class="status-pill" class:published={col.is_published}>
                        {col.is_published ? $t('examDetail.publishedBadge') : $t('examDetail.draftBadge')}
                      </span>
                    </td>
                    <td>
                      <div class="row-actions">
                        <a href="/collections/{col.id}/edit" class="action-btn" aria-label={$t('admin.editCollectionAria')}>
                          {@html I.edit} {$t('common.edit')}
                        </a>
                        <button
                          class="action-btn"
                          onclick={() => toggleCollectionPublish(col)}
                          aria-label={$t('admin.togglePublishAria', { action: col.is_published ? $t('examDetail.unpublish') : $t('examDetail.publish') })}
                        >
                          {@html I.publish}
                          {col.is_published ? $t('admin.unpublishShort') : $t('examDetail.publish')}
                        </button>
                        <button
                          class="action-btn action-btn--danger"
                          onclick={() => deleteCollection(col.id)}
                          aria-label={$t('admin.deleteCollectionAria')}
                        >
                          {@html I.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>
      {/if}
    {/if}

    <!-- ── SETTINGS TAB ────────────────────────────────────────────────── -->
    {#if tab === 'settings'}
      <div class="settings-wrap">
        <Card title={$t('admin.uploadSettingsTitle')} subtitle={$t('admin.uploadSettingsSubtitle')}>
          {#if settingsLoading}
            <p class="ix-loading">{$t('common.loading')}</p>
          {:else}
            {#if settingsError}<p class="ix-error">{settingsError}</p>{/if}
            {#if settingsSuccess}<p class="ix-success">{$t('admin.settingsSaved')}</p>{/if}

            <div class="form-stack">
              <Input
                id="max_size"
                label={$t('admin.maxSizeLabel')}
                type="number"
                bind:value={settings.upload_max_size_mb}
                min="1"
                max="50"
                step="1"
                hint={$t('admin.maxSizeHint')}
                style="width:120px"
              />
              <Input
                id="allowed_types"
                label={$t('admin.allowedTypesLabel')}
                type="text"
                bind:value={settings.upload_allowed_types}
                placeholder="image/jpeg,image/png,image/webp,image/gif"
                hint={$t('admin.allowedTypesHint')}
              />
              <div>
                <Button onclick={saveSettings} loading={settingsSaving} disabled={settingsSaving}>
                  {$t('admin.saveSettings')}
                </Button>
              </div>
            </div>
          {/if}
        </Card>
      </div>
    {/if}

    <!-- ── CREDITS TAB ─────────────────────────────────────────────────── -->
    {#if tab === 'credits'}
      <div class="settings-wrap">
        <Card title={$t('admin.creditConfigTitle')} subtitle={$t('admin.creditConfigSubtitle')}>
          {#if settingsLoading}
            <p class="ix-loading">{$t('common.loading')}</p>
          {:else}
            {#if creditError}<p class="ix-error">{creditError}</p>{/if}
            {#if creditSuccess}<p class="ix-success">{$t('admin.creditSettingsSaved')}</p>{/if}

            <div class="form-stack">
              <Input
                id="default_credits"
                label={$t('admin.defaultCreditsLabel')}
                type="number"
                bind:value={creditSettings.default_credits}
                min="0"
                step="1"
                hint={$t('admin.defaultCreditsHint')}
                style="width:120px"
              />
              <Input
                id="teacher_upgrade_cost"
                label={$t('admin.teacherUpgradeCostLabel')}
                type="number"
                bind:value={creditSettings.teacher_upgrade_cost}
                min="0"
                step="1"
                hint={$t('admin.teacherUpgradeCostHint')}
                style="width:120px"
              />
              <Input
                id="default_exam_cost"
                label={$t('admin.defaultExamCostLabel')}
                type="number"
                bind:value={creditSettings.default_exam_cost}
                min="0"
                step="1"
                hint={$t('admin.defaultExamCostHint')}
                style="width:120px"
              />
              <div>
                <Button onclick={saveCreditSettings} loading={creditSaving} disabled={creditSaving}>
                  {$t('admin.saveSettings')}
                </Button>
              </div>
            </div>
          {/if}
        </Card>
      </div>
    {/if}
</div>

<!-- ── Create user modal ──────────────────────────────────────────────── -->
{#if showCreate}
  <div class="modal-overlay" onclick={closeCreate} role="presentation">
    <div class="modal-box" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={$t('admin.createAccountModalTitle')}>
      <div class="modal-header">
        <h2>{$t('admin.createAccountModalTitle')}</h2>
        <button class="modal-close" onclick={closeCreate} aria-label={$t('common.close')}>✕</button>
      </div>

      <div class="modal-body">
        {#if createError}
          <p class="create-error">{createError}</p>
        {/if}

        <div class="form-row">
          <label for="c-email">Email <span class="req">*</span></label>
          <Input id="c-email" type="email" bind:value={createForm.email} placeholder="user@example.com" />
        </div>

        <div class="form-row">
          <label for="c-password">{$t('admin.passwordLabel')} <span class="req">*</span></label>
          <Input id="c-password" type="password" bind:value={createForm.password} placeholder={$t('admin.passwordPlaceholder')} />
        </div>

        <div class="form-row">
          <label for="c-fullname">{$t('admin.thFullName')}</label>
          <Input id="c-fullname" type="text" bind:value={createForm.full_name} placeholder={$t('admin.fullNamePlaceholder')} />
        </div>

        <div class="form-row">
          <label for="c-role">{$t('admin.roleLabel')}</label>
          <select id="c-role" class="modal-select" bind:value={createForm.role}>
            <option value="student">{$t('roles.student')}</option>
            <option value="teacher">{$t('roles.teacher')}</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <Button variant="ghost" onclick={closeCreate} disabled={createLoading}>{$t('common.cancel')}</Button>
        <Button onclick={submitCreate} disabled={createLoading}>
          {createLoading ? $t('admin.creatingAccount') : $t('admin.createAccount')}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Tab navigation ───────────────────────────────────────────────────── */
  .tab-nav {
    display: flex;
    border-bottom: 1px solid var(--ix-border);
    margin-bottom: 24px;
    gap: 0;
    overflow-x: auto;
  }

  .tab-btn {
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ix-text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    transition: color 0.1s;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-btn:hover { color: var(--ix-text-primary); }
  .tab-btn.active {
    color: var(--ix-text-primary);
    border-bottom-color: var(--ix-text-primary);
    font-weight: 600;
  }

  .admin-content { /* spacing wrapper for tab content */ }

  /* ── Stats row ────────────────────────────────────────────────────────── */
  .stats-row {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--ix-bg-surface);
    border: 1px solid var(--ix-border);
    border-radius: 12px;
    padding: 16px 24px;
    margin-bottom: 20px;
    box-shadow: var(--ix-shadow-card);
    flex-wrap: wrap;
    gap: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 20px;
  }

  .stat-item:first-child { padding-left: 0; }
  .stat-item:last-child  { padding-right: 0; }

  .stat-num {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--ix-text-primary);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .stat-lbl {
    font-size: 12px;
    color: var(--ix-text-muted);
    margin-top: 2px;
  }

  .stat-sep {
    width: 1px;
    height: 36px;
    background: var(--ix-border);
    flex-shrink: 0;
  }

  /* ── Table ────────────────────────────────────────────────────────────── */
  .ix-table-wrap {
    overflow-x: auto;
  }

  .ix-table {
    width: 100%;
    border-collapse: collapse;
  }

  .ix-table th {
    padding: 10px 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ix-text-muted);
    text-align: left;
    border-bottom: 1px solid var(--ix-border);
    background: var(--ix-bg-surface);
    white-space: nowrap;
  }

  .ix-table td {
    padding: 14px 20px;
    border-bottom: 1px solid var(--ix-border);
    font-size: 14px;
    color: var(--ix-text-primary);
    vertical-align: middle;
  }

  .ix-table tbody tr:last-child td {
    border-bottom: none;
  }

  .ix-table tbody tr:hover td {
    background: var(--ix-bg-hover);
  }

  .td-email { font-size: 13px; color: var(--ix-text-secondary); }
  .td-name  { font-weight: 500; }
  .td-date  { font-size: 13px; color: var(--ix-text-muted); white-space: nowrap; }
  .td-num   { font-weight: 600; color: var(--ix-text-primary); }

  /* Role pill */
  .role-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Role select */
  .role-select {
    padding: 5px 8px;
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    background: var(--ix-bg-surface);
    color: var(--ix-text-primary);
    outline: none;
  }

  .role-select:focus { border-color: var(--ix-text-primary); box-shadow: 0 0 0 3px var(--ix-focus-ring); }
  .role-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Credit inline edit */
  .credit-view, .credit-edit {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .credit-val {
    font-weight: 600;
    color: var(--ix-text-primary);
    min-width: 28px;
  }

  .credit-input {
    width: 72px;
    padding: 4px 8px;
    border: 1px solid var(--ix-border);
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    background: var(--ix-bg-surface);
    color: var(--ix-text-primary);
    outline: none;
  }

  .credit-input:focus { border-color: var(--ix-text-primary); }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--ix-border);
    background: var(--ix-bg-surface);
    color: var(--ix-text-muted);
    cursor: pointer;
    transition: all 0.1s;
    flex-shrink: 0;
    padding: 0;
  }

  .icon-btn:hover { background: var(--ix-bg-hover); color: var(--ix-text-primary); border-color: var(--ix-text-primary); }
  .icon-btn--green { border-color: #16a34a; color: #16a34a; background: rgba(22,163,74,0.08); }
  .icon-btn--green:hover { background: #16a34a; color: white; }

  /* ── Collections ──────────────────────────────────────────────────────── */
  .col-title-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .col-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--ix-bg-hover);
    border: 1px solid var(--ix-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .col-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }

  .col-name { font-weight: 600; font-size: 14px; color: var(--ix-text-primary); }
  .col-desc { font-size: 12px; color: var(--ix-text-muted); margin-top: 1px; }

  .status-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 500;
    background: var(--ix-bg-hover);
    color: var(--ix-text-muted);
  }

  .status-pill.published {
    background: rgba(22, 163, 74, 0.1);
    color: #16a34a;
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    border: 1px solid var(--ix-border);
    background: var(--ix-bg-surface);
    color: var(--ix-text-secondary);
    cursor: pointer;
    text-decoration: none;
    transition: all 0.1s;
    line-height: 1;
  }

  .action-btn:hover { background: var(--ix-bg-hover); color: var(--ix-text-primary); border-color: var(--ix-text-primary); }
  .action-btn--danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.06); }

  /* ── Settings / Credits forms ─────────────────────────────────────────── */
  .settings-wrap {
    max-width: 560px;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Feedback ─────────────────────────────────────────────────────────── */
  .ix-error   { color: var(--danger); font-size: 14px; margin-bottom: 16px; }
  .ix-success { color: #16a34a; font-size: 14px; margin-bottom: 16px; }
  .ix-loading { font-size: 14px; color: var(--ix-text-muted); }
  .ix-note    { font-size: 12px; color: var(--ix-text-muted); margin-top: 12px; }

  /* ── Mobile ───────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .stats-row {
      gap: 12px;
      flex-wrap: wrap;
    }

    .stat-sep {
      display: none;
    }

    .stat-item {
      padding: 0;
    }

    .ix-table th, .ix-table td {
      padding: 10px 12px;
    }
  }

  /* ── Create-user bar ────────────────────────────────────────────────── */
  .create-user-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
  }

  /* ── Edit user link ─────────────────────────────────────────────────── */
  .edit-user-link {
    display: inline-block;
    padding: 0.3rem 0.75rem;
    background: var(--primary-light);
    color: var(--primary);
    border-radius: var(--radius-btn);
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .edit-user-link:hover { background: var(--primary); color: #fff; }

  /* ── Create modal ───────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 999;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .modal-box {
    background: var(--surface);
    border-radius: var(--radius-card);
    width: 100%; max-width: 480px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 1.5rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 { margin: 0; font-size: 1.1rem; color: var(--text); }
  .modal-close {
    background: none; border: none; cursor: pointer;
    color: var(--text); opacity: 0.5; font-size: 1.1rem; line-height: 1;
    padding: 0.25rem;
  }
  .modal-close:hover { opacity: 1; }
  .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .modal-footer {
    padding: 1rem 1.5rem 1.25rem;
    border-top: 1px solid var(--border);
    display: flex; gap: 0.75rem; justify-content: flex-end;
  }
  .form-row { display: flex; flex-direction: column; gap: 0.35rem; }
  .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text); opacity: 0.75; }
  .req { color: var(--primary); }
  .modal-select {
    width: 100%; padding: 0.55rem 0.75rem;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .modal-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
  .create-error {
    background: #fef2f2; border: 1px solid #fecaca;
    color: #dc2626; border-radius: 8px;
    padding: 0.6rem 0.9rem; font-size: 0.85rem; margin: 0;
  }
  :global([data-theme="dark"]) .create-error {
    background: rgba(220,38,38,0.15); border-color: rgba(220,38,38,0.35); color: #fca5a5;
  }
</style>
