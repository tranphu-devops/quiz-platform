<script>
  let { title, subtitle = '', children } = $props()
</script>

<div class="ix-page-header">
  <div class="ix-page-header-left">
    <h1 class="ix-page-title">{title}</h1>
    {#if subtitle}
      <p class="ix-page-subtitle">{subtitle}</p>
    {/if}
  </div>
  {#if children}
    <div class="ix-page-header-actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .ix-page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
  }

  .ix-page-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ix-text-primary);
    letter-spacing: -0.03em;
    line-height: 1.15;
    margin: 0;
  }

  .ix-page-subtitle {
    font-size: 14px;
    color: var(--ix-text-secondary);
    margin: 4px 0 0;
    line-height: 1.5;
  }

  .ix-page-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .ix-page-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .ix-page-title {
      font-size: 1.5rem;
    }
  }
</style>
