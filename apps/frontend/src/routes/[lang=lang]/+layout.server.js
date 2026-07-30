// `publicShell` tells the root layout to render these pages bare, without the
// authenticated app chrome. It has to come from server data — not from a store
// or a pathname check in the component — so it is already true during SSR and
// stays true through hydration, meaning a logged-in visitor never sees the
// sidebar flash in over a public page.
export function load({ params }) {
  return { publicShell: true, lang: params.lang }
}
