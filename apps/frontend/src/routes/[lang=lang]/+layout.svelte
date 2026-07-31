<script>
  import { publicT } from '$lib/i18n/public'
  import { SITE_ORIGIN, catalogUrl } from '$lib/seo'
  import PublicChrome from '$lib/components/public/PublicChrome.svelte'

  let { data, children } = $props()
  const t = $derived(publicT(data.lang))

  // Absolute, and pointing at the landing host: these pages answer on both
  // novaquiz.net and app.novaquiz.net, and /brand, /contact and the home page
  // only exist on the former.
  const home = $derived(data.lang === 'vi' ? `${SITE_ORIGIN}/vi` : SITE_ORIGIN)
  const brand = $derived(data.lang === 'vi' ? `${SITE_ORIGIN}/vi/brand` : `${SITE_ORIGIN}/brand`)
  const contact = $derived(data.lang === 'vi' ? `${SITE_ORIGIN}/vi/contact` : `${SITE_ORIGIN}/contact`)
</script>

<PublicChrome
  homePath={home}
  catalogPath={catalogUrl(data.lang)}
  brandPath={brand}
  contactPath={contact}
  {t}
>
  {@render children()}
</PublicChrome>
