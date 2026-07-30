<script>
  import { publicT } from '$lib/i18n/public'
  import { SITE_ORIGIN, catalogUrl } from '$lib/seo'

  let { data, children } = $props()
  const t = $derived(publicT(data.lang))
  const home = $derived(data.lang === 'vi' ? `${SITE_ORIGIN}/vi` : SITE_ORIGIN)
</script>

<div class="pub">
  <header class="pub-head">
    <a class="pub-brand" href={home}>
      <img src="/logo.svg" alt="" width="28" height="28" />
      <span>NovaQuiz</span>
    </a>
    <nav class="pub-nav">
      <a href={catalogUrl(data.lang)}>{t('nav.exams')}</a>
      <a href="{SITE_ORIGIN}/contact">{t('nav.contact')}</a>
    </nav>
  </header>

  <main class="pub-main">
    {@render children()}
  </main>

  <footer class="pub-foot">
    <p class="pub-foot-brand">NovaQuiz — {t('footer.tagline')}</p>
    <nav class="pub-foot-nav">
      <a href={home}>{t('nav.home')}</a>
      <a href={catalogUrl(data.lang)}>{t('nav.exams')}</a>
      <a href="{SITE_ORIGIN}/brand">{t('nav.brand')}</a>
      <a href="{SITE_ORIGIN}/contact">{t('nav.contact')}</a>
    </nav>
  </footer>
</div>

<style>
  /* Design tokens come from the :global block in src/routes/+layout.svelte,
     which is emitted regardless of which branch that layout renders. */
  .pub {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
  }

  .pub-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .pub-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--text);
    text-decoration: none;
  }

  .pub-nav {
    display: flex;
    gap: 1.25rem;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .pub-nav a {
    color: var(--text);
    text-decoration: none;
    opacity: 0.85;
  }

  .pub-nav a:hover { opacity: 1; color: var(--primary); }

  .pub-main {
    flex: 1;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
  }

  .pub-foot {
    border-top: 1px solid var(--border);
    background: var(--surface);
    padding: 1.5rem;
    text-align: center;
  }

  .pub-foot-brand {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    opacity: 0.75;
  }

  .pub-foot-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    font-size: 0.9rem;
  }

  .pub-foot-nav a { color: var(--primary); text-decoration: none; }
  .pub-foot-nav a:hover { text-decoration: underline; }

  @media (max-width: 768px) {
    .pub-head { padding: 0.85rem 1rem; }
    .pub-main { padding: 1.5rem 1rem 2.5rem; }
  }
</style>
