import { redirect } from '@sveltejs/kit'
import { catalogUrl } from '$lib/seo'

// /vi and /vi/ would otherwise 404 in the app: nginx's `location = /vi` is an
// exact match serving the static landing file, so only the bare path reaches
// it — anything else falls through here.
export function load({ params }) {
  redirect(308, catalogUrl(params.lang))
}
