<script>
  let {
    sections = [],
    userInfo = null,
    onLogout = () => {},
    mobileOpen = false,
    onMobileClose = () => {},
    children,
  } = $props()
</script>

<aside
  class="ix-sidebar"
  class:mobile-open={mobileOpen}
  aria-label="Điều hướng"
>
  <a href="/" class="ix-brand">QuizPlatform</a>

  <nav class="ix-nav">
    {#each sections as section}
      {#if section.label}
        <div class="ix-section-label">{section.label}</div>
      {/if}
      {#each section.items as item}
        {#if item.href}
          <a
            href={item.href}
            class="ix-nav-item"
            class:active={item.active}
            aria-current={item.active ? 'page' : undefined}
            onclick={onMobileClose}
          >
            {#if item.icon}
              <span class="ix-nav-icon" aria-hidden="true">{@html item.icon}</span>
            {/if}
            <span>{item.label}</span>
          </a>
        {:else}
          <button
            class="ix-nav-item"
            class:active={item.active}
            onclick={() => { item.onClick?.(); onMobileClose() }}
            aria-pressed={item.active}
          >
            {#if item.icon}
              <span class="ix-nav-icon" aria-hidden="true">{@html item.icon}</span>
            {/if}
            <span>{item.label}</span>
          </button>
        {/if}
      {/each}
    {/each}
  </nav>

  {#if children}
    <div class="ix-sidebar-extra">
      {@render children()}
    </div>
  {/if}

  {#if userInfo}
    <div class="ix-sidebar-user">
      <div class="ix-user-avatar" aria-hidden="true">
        {#if userInfo.avatarUrl}
          <img src={userInfo.avatarUrl} alt="" />
        {:else}
          {(userInfo.name || userInfo.email || '?').charAt(0).toUpperCase()}
        {/if}
      </div>
      <div class="ix-user-meta">
        <div class="ix-user-name">{userInfo.name || userInfo.email}</div>
        <div class="ix-user-role">{userInfo.role}</div>
      </div>
      <button
        class="ix-logout-btn"
        onclick={onLogout}
        aria-label="Đăng xuất"
        title="Đăng xuất"
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
    width: 200px;
    flex-shrink: 0;
    background: var(--ix-bg-sidebar);
    border-right: 1px solid var(--ix-border);
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .ix-brand {
    display: block;
    padding: 18px 16px 14px;
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--ix-text-primary);
    text-decoration: none;
    border-bottom: 1px solid var(--ix-border);
    flex-shrink: 0;
  }

  .ix-nav {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
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

  .ix-sidebar-extra {
    padding: 12px;
    border-top: 1px solid var(--ix-border);
    flex-shrink: 0;
  }

  .ix-sidebar-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 12px;
    border-top: 1px solid var(--ix-border);
    flex-shrink: 0;
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

  /* ── Mobile ───────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .ix-sidebar {
      position: fixed;
      top: var(--mobile-bar-h, 56px);
      left: -220px;
      bottom: 0;
      z-index: 200;
      width: 200px;
      min-height: auto;
      transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
    }

    .ix-sidebar.mobile-open {
      left: 0;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
    }
  }
</style>
