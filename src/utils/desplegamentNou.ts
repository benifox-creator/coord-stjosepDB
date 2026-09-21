// Què passa quan es publica una versió nova mentre algú té l'aplicació oberta.
//
// Els fitxers de codi porten un hash al nom (`DashboardPage-Cfp3qJ-Q.js`) que
// canvia a cada compilació, i cada pàgina només sap els noms que existien quan
// es va carregar. Publicar esborra els antics. Així que qui tingui la pestanya
// oberta —o hi entri dins dels 10 minuts que dura la memòria cau del HTML— pot
// demanar un fitxer que ja no hi és, i el mòdul no carrega.
//
// Passa a cada desplegament i a tothom qui estigui a mitges. La sortida és
// recarregar: la pàgina nova ja demana els noms bons. Però només un cop, que
// si el fitxer no hi és per una altra raó, insistir deixaria l'usuari en un
// bucle sense veure mai què ha fallat.

const MISSATGES = [
  'failed to fetch dynamically imported module',  // Chrome, Edge
  'error loading dynamically imported module',    // Firefox
  'importing a module script failed',             // Safari
  'unable to preload css',                        // Vite, per als fulls d'estil
]

/** Si aquest error és el d'una pàgina que ha quedat enrere. */
export function esChunkCaducat(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const missatge = err.message.toLowerCase()
  return MISSATGES.some((m) => missatge.includes(m))
}

/**
 * Si val la pena recarregar. `darrera` és quan ho vam provar per última vegada,
 * tal com s'ha desat; una marca que no s'entén compta com si no n'hi hagués,
 * perquè val més una recàrrega de més que quedar-se encallat.
 */
export function calRecarregar(darrera: string | null, ara: number, finestraMs = 10_000): boolean {
  if (!darrera) return true
  const quan = Number(darrera)
  if (!Number.isFinite(quan)) return true
  return ara - quan > finestraMs
}

const CLAU = 'sjo-hub:darrera-recarrega'

/**
 * Recarrega si toca, i diu si ho ha fet. Quan torna `false` vol dir que ja ho
 * hem provat fa un moment i no ha servit: qui cridi això ha d'ensenyar l'error
 * en comptes de confiar que la recàrrega l'arregli.
 *
 * Tot va dins d'un `try`: en una finestra privada o amb les dades del lloc
 * bloquejades, llegir `sessionStorage` llança. Quedar-se sense recarregar per
 * això seria canviar un error per un altre.
 */
export function recarregaSiCal(): boolean {
  try {
    if (!calRecarregar(sessionStorage.getItem(CLAU), Date.now())) return false
    sessionStorage.setItem(CLAU, String(Date.now()))
  } catch {
    // Sense on desar la marca no podem saber si ja ho hem provat. Recarreguem
    // igualment: el cas normal és que funcioni a la primera.
  }
  window.location.reload()
  return true
}
