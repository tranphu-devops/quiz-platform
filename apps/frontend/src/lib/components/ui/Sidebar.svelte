<script>
  import { t } from '$lib/i18n'

  let {
    sections = [],
    userInfo = null,
    onLogout = () => {},
    onToggleCollapse = () => {},
    collapsed = false,
    mobileOpen = false,
    onMobileClose = () => {},
    children,
  } = $props()

  const chevronLeft = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L4 7l5 5"/></svg>`
  const chevronRight = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2l5 5-5 5"/></svg>`

  const roleLabel = $derived(userInfo?.role ? $t(`roles.${userInfo.role}`) : '')
</script>

<aside
  class="ix-sidebar"
  class:mobile-open={mobileOpen}
  class:collapsed
  aria-label={$t('sidebar.navLabel')}
>
  <!-- Brand + collapse toggle -->
  <div class="ix-brand-row">
    <a href="/" class="ix-brand" title="QuizPlatform">
      <img src="/favicon.svg" alt="logo" class="ix-brand-icon" />
      {#if !collapsed}<span class="ix-brand-text">QuizPlatform</span>{/if}
    </a>
    <button
      class="ix-collapse-btn"
      onclick={onToggleCollapse}
      aria-label={collapsed ? $t('sidebar.expandAria') : $t('sidebar.collapseAria')}
      title={collapsed ? $t('sidebar.expand') : $t('sidebar.collapse')}
    >
      {@html collapsed ? chevronRight : chevronLeft}
    </button>
  </div>

  <nav class="ix-nav">
    {#each sections as section}
      {#if section.label && !collapsed}
        <div class="ix-section-label">{section.label}</div>
      {:else if section.label && collapsed}
        <div class="ix-section-divider"></div>
      {/if}
      {#each section.items as item}
        {#if item.href}
          <a
            href={item.href}
            class="ix-nav-item"
            class:active={item.active}
            aria-current={item.active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            onclick={onMobileClose}
          >
            {#if item.icon}
              <span class="ix-nav-icon" aria-hidden="true">{@html item.icon}</span>
            {/if}
            {#if !collapsed}<span>{item.label}</span>{/if}
          </a>
        {:else}
          <button
            class="ix-nav-item"
            class:active={item.active}
            title={collapsed ? item.label : undefined}
            onclick={() => { item.onClick?.(); onMobileClose() }}
            aria-pressed={item.active}
          >
            {#if item.icon}
              <span class="ix-nav-icon" aria-hidden="true">{@html item.icon}</span>
            {/if}
            {#if !collapsed}<span>{item.label}</span>{/if}
          </button>
        {/if}
      {/each}
    {/each}
  </nav>

  {#if children && !collapsed}
    <div class="ix-sidebar-extra">
      {@render children()}
    </div>
  {/if}

  {#if userInfo}
    <div class="ix-sidebar-user" class:collapsed>
      <div class="ix-user-avatar" aria-hidden="true" title={collapsed ? (userInfo.name || userInfo.email) : undefined}>
        {#if userInfo.avatarUrl}
          <img src={userInfo.avatarUrl} alt="" />
        {:else}
          {(userInfo.name || userInfo.email || '?').charAt(0).toUpperCase()}
        {/if}
      </div>
      {#if !collapsed}
        <div class="ix-user-meta">
          <div class="ix-user-name">{userInfo.name || userInfo.email}</div>
          <div class="ix-user-role">{roleLabel}</div>
        </div>
      {/if}
      <button
        class="ix-logout-btn"
        onclick={onLogout}
        aria-label={$t('sidebar.logout')}
        title={$t('sidebar.logout')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 2h3a1 1 0 011 1v8a1 1 0 01-1 1H9"/>
          <path d="M6 9.5L9 7 6 4.5"/>
          <line x1="9" y1="7" x2="1" y2="7"/>
        </svg>
      </button>
    </div>
  {/if}
</aside>

<style>
  .ix-sidebar {
    width: 232px;
    flex-shrink: 0;
    background: var(--ix-bg-sidebar);
    border-right: 1px solid var(--ix-border);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .ix-sidebar.collapsed { width: 56px; }

  /* ── Brand row ─────────────────────────────────────────────────────── */
  .ix-brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--ix-border);
    flex-shrink: 0;
    min-height: 60px;
    padding: 0 8px 0 14px;
    gap: 6px;
  }

  .collapsed .ix-brand-row { padding: 0 6px; justify-content: center; }

  .ix-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--ix-text-primary);
    text-decoration: none;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .collapsed .ix-brand { flex: 0; }

  .ix-brand-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .ix-brand-text {
    white-space: nowrap;
    overflow: hidden;
  }

  .ix-collapse-btn {
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    border: 1px solid var(--ix-border);
    border-radius: 6px;
    background: var(--ix-bg-surface);
    cursor: pointer;
    color: var(--ix-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
    padding: 0;
  }
  .ix-collapse-btn:hover { background: var(--ix-bg-hover); color: var(--ix-text-primary); }

  /* ── Nav ─────────────────────────────────────────────────────────── */
  .ix-nav {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .ix-section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ix-text-muted);
    padding: 12px 12px 4px;
    margin-top: 4px;
    white-space: nowrap;
  }

  .ix-section-divider {
    height: 1px;
    background: var(--ix-border);
    margin: 8px 4px 4px;
    flex-shrink: 0;
  }

  .ix-nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ix-text-secondary);
    text-decoration: none;
    border: none;
    background: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.1s, color 0.1s;
    line-height: 1.4;
    font-family: inherit;
    white-space: nowrap;
    overflow: hidden;
  }

  .collapsed .ix-nav-item {
    justify-content: center;
    padding: 9px;
    gap: 0;
  }

  .ix-nav-item:hover {
    background: var(--ix-bg-hover);
    color: var(--ix-text-primary);
  }

  .ix-nav-item.active {
    background: var(--ix-bg-hover);
    color: var(--ix-text-primary);
    font-weight: 600;
  }

  .ix-nav-item:focus-visible {
    outline: 2px solid var(--ix-btn-black-bg);
    outline-offset: 1px;
  }

  .ix-nav-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ix-text-muted);
    line-height: 1;
  }

  .ix-nav-item:hover .ix-nav-icon,
  .ix-nav-item.active .ix-nav-icon {
    color: var(--ix-text-primary);
  }

  /* ── Extra slot ──────────────────────────────────────────────────── */
  .ix-sidebar-extra {
    padding: 12px;
    border-top: 1px solid var(--ix-border);
    flex-shrink: 0;
  }

  /* ── User row ────────────────────────────────────────────────────── */
  .ix-sidebar-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 12px;
    border-top: 1px solid var(--ix-border);
    flex-shrink: 0;
  }

  .ix-sidebar-user.collapsed {
    flex-direction: column;
    padding: 8px 6px;
    gap: 4px;
  }

  .ix-user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
    overflow: hidden;
  }

  .ix-user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ix-user-meta {
    flex: 1;
    min-width: 0;
  }

  .ix-user-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--ix-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .ix-user-role {
    font-size: 11px;
    color: var(--ix-text-muted);
    text-transform: capitalize;
  }

  .ix-logout-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 5px;
    border-radius: 6px;
    color: var(--ix-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.1s, background 0.1s;
    flex-shrink: 0;
  }

  .ix-logout-btn:hover {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }

  .ix-logout-btn:focus-visible {
    outline: 2px solid var(--danger);
    outline-offset: 1px;
  }

  /* ── Mobile ──────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .ix-sidebar {
      position: fixed;
      top: var(--mobile-bar-h, 56px);
      left: -232px;
      bottom: 0;
      z-index: 200;
      width: 232px !important; /* always full on mobile */
      min-height: auto;
      transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
    }

    .ix-sidebar.mobile-open {
      left: 0;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
    }

    .ix-collapse-btn { display: none; }
  }
</style>
