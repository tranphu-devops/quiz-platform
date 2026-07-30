<script>
  // Real <a href> links, not buttons: with csr = false there is no client-side
  // router, and a crawler has to be able to follow these to reach the exams
  // that only exist on later pages.
  let { page, pageSize, total, basePath, t } = $props()
  const lastPage = $derived(Math.max(1, Math.ceil(total / pageSize)))
  const href = (n) => (n === 1 ? basePath : `${basePath}?page=${n}`)
</script>

{#if lastPage > 1}
  <nav class="pager">
    {#if page > 1}
      <a rel="prev" href={href(page - 1)}>← {t('pager.prev')}</a>
    {/if}
    <span class="pager-pos">{t('pager.page', { n: page })} / {lastPage}</span>
    {#if page < lastPage}
      <a rel="next" href={href(page + 1)}>{t('pager.next')} →</a>
    {/if}
  </nav>
{/if}

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    font-size: 0.92rem;
  }

  .pager a {
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-btn, 10px);
    background: var(--surface);
    color: var(--primary);
    text-decoration: none;
    font-weight: 600;
  }

  .pager a:hover { border-color: var(--primary); }
  .pager-pos { opacity: 0.7; }
</style>
