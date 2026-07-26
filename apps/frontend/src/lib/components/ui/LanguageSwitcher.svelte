<script>
  import { locale, setLocale, t } from '$lib/i18n'

  let { variant = 'default' } = $props()

  const languages = [
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' }
  ]

  function handleChange(e) {
    setLocale(e.target.value)
  }
</script>

{#if variant === 'button'}
  <!-- Legacy button variant for backward compatibility -->
  <button
    class="lang-switch-btn"
    onclick={() => setLocale(['vi', 'en', 'ja'][((['vi', 'en', 'ja'].indexOf($locale) + 1) % 3)])}
    type="button"
    aria-label={$t('langSwitcher.label')}
    title={$t('langSwitcher.label')}
  >
    <span class:active={$locale === 'vi'}>VI</span>
    <span class="sep">/</span>
    <span class:active={$locale === 'en'}>EN</span>
    <span class="sep">/</span>
    <span class:active={$locale === 'ja'}>JA</span>
  </button>
{:else}
  <!-- Selectbox variant (default) -->
  <select
    class="lang-select"
    class:compact={variant === 'compact'}
    value={$locale}
    onchange={handleChange}
    aria-label={$t('langSwitcher.label')}
  >
    {#each languages as lang}
      <option value={lang.code}>{lang.label}</option>
    {/each}
  </select>
{/if}

<style>
  .lang-select {
    border: 1.5px solid var(--ix-border, var(--border));
    background: var(--ix-bg-surface, var(--surface));
    color: var(--ix-text-secondary, var(--muted));
    border-radius: 7px;
    padding: 0.45rem 1.9rem 0.45rem 0.7rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23595d72' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.6rem center;
  }
  .lang-select:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
  .lang-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  .lang-select.compact {
    padding: 0.35rem 1.6rem 0.35rem 0.6rem;
    font-size: 0.75rem;
  }

  .lang-switch-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--ix-border, var(--border));
    background: var(--ix-bg-surface, var(--surface));
    color: var(--ix-text-secondary, var(--muted));
    border-radius: 7px;
    padding: 0.4rem 0.6rem;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: background 0.1s;
  }
  .lang-switch-btn:hover {
    background: var(--ix-bg-hover, var(--primary-light));
  }
  .lang-switch-btn span {
    opacity: 0.5;
  }
  .lang-switch-btn span.active {
    opacity: 1;
    color: var(--primary);
  }
  .lang-switch-btn .sep {
    opacity: 0.35;
  }
</style>
