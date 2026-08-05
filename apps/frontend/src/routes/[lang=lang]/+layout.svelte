<script>
  import { publicT } from '$lib/i18n/public'
  import { SITE_ORIGIN, catalogUrl, landingHome, langSwitchLinks } from '$lib/seo'
  import PublicChrome from '$lib/components/public/PublicChrome.svelte'

  let { data, children } = $props()
  const t = $derived(publicT(data.lang))

  // Absolute, and pointing at the landing host: these pages answer on both
  // novaquiz.net and app.novaquiz.net, and /brand, /contact and the home page
  // only exist on the former. landingHome() knows where each language's home
  // is; /brand and /contact sit under the same prefix.
  const prefix = $derived(data.lang === 'en' ? '' : `/${data.lang}`)
  const home = $derived(`${SITE_ORIGIN}${landingHome(data.lang)}`)
  const brand = $derived(`${SITE_ORIGIN}${prefix}/brand`)
  const contact = $derived(`${SITE_ORIGIN}${prefix}/contact`)
</script>

<PublicChrome
  homePath={home}
  catalogPath={catalogUrl(data.lang)}
  brandPath={brand}
  contactPath={contact}
  langs={langSwitchLinks(data.lang)}
  {t}
>
  {@render children()}
</PublicChrome>
