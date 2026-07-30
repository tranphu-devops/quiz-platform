<script>
  // Rendered as visible markup, not only as JSON-LD: breadcrumbs are how a
  // reader (and a crawler following links) climbs back up the tree.
  let { crumbs } = $props()
</script>

<nav class="crumbs" aria-label="Breadcrumb">
  {#each crumbs as crumb, i}
    {#if i < crumbs.length - 1}
      <a href={crumb.path}>{crumb.name}</a>
      <span aria-hidden="true">›</span>
    {:else}
      <span class="current" aria-current="page">{crumb.name}</span>
    {/if}
  {/each}
</nav>

<style>
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .crumbs a { color: var(--primary); text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }
  .current { opacity: 0.75; }
</style>
