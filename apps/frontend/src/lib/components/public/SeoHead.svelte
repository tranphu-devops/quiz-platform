<script>
  import { jsonLdText } from '$lib/seo'

  // Every tag a public page needs in <head>. The root layout suppresses its own
  // defaults whenever `page.data.seo` is set, so nothing here is duplicated —
  // see the {#if !$page.data?.seo} guard in src/routes/+layout.svelte.
  let { seo, ogImage = 'https://novaquiz.net/brand-assets/banner-og.png' } = $props()
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <link rel="canonical" href={seo.canonical} />

  {#each seo.hreflang ?? [] as alt}
    <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
  {/each}

  <meta property="og:type" content={seo.ogType ?? 'website'} />
  <meta property="og:site_name" content="NovaQuiz" />
  <meta property="og:title" content={seo.title} />
  <meta property="og:description" content={seo.description} />
  <meta property="og:url" content={seo.canonical} />
  <meta property="og:image" content={seo.ogImage ?? ogImage} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seo.title} />
  <meta name="twitter:description" content={seo.description} />
  <meta name="twitter:image" content={seo.ogImage ?? ogImage} />

  {#if seo.jsonLd}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html `<script type="application/ld+json">${jsonLdText(seo.jsonLd)}<\/script>`}
  {/if}
</svelte:head>
