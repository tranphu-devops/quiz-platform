<script>
  import { locale, toggleLocale, t } from '$lib/i18n'

  let { variant = 'default' } = $props()
</script>

<button
  class="lang-switch"
  class:compact={variant === 'compact'}
  onclick={toggleLocale}
  type="button"
  aria-label={$t('langSwitcher.label')}
  title={$t('langSwitcher.label')}
>
  <span class:active={$locale === 'vi'}>VI</span>
  <span class="sep">/</span>
  <span class:active={$locale === 'en'}>EN</span>
</button>

<style>
  .lang-switch {
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
  .lang-switch:hover {
    background: var(--ix-bg-hover, var(--primary-light));
  }
  .lang-switch.compact {
    padding: 0.3rem 0.5rem;
    font-size: 11px;
  }
  .lang-switch span {
    opacity: 0.5;
  }
  .lang-switch span.active {
    opacity: 1;
    color: var(--primary);
  }
  .lang-switch .sep {
    opacity: 0.35;
  }
</style>
