// Decideix què cal fer a Firebase perquè cada correu pugui entrar a l'app.
// Supabase només accepta el testimoni de Firebase si porta el claim
// `role: authenticated`, i Firebase no el posa sol: cal crear el compte (si
// la persona encara no ha entrat mai) i afegir-li el claim, conservant la
// resta de claims que ja tingués. Sense dependències de Deno, per poder-ho
// provar amb Vitest.

export const DOMINI = '@stjosep.org'
export const MAX_CORREUS = 300

export interface CompteFirebase {
  localId: string
  email?: string
  /** JSON amb els claims personalitzats, tal com el torna Identity Toolkit. */
  customAttributes?: string
}

export interface Pla {
  /** Correus sense compte a Firebase: cal crear-lo i després marcar-lo. */
  crear: string[]
  /** Comptes que existeixen però no tenen el claim. */
  marcar: { email: string; localId: string; claims: Record<string, unknown> }[]
  /** Comptes que ja ho tenien tot. */
  jaFets: string[]
  /** Correus descartats: fora del domini o no registrats a l'app. */
  descartats: string[]
}

export function normalitza(emails: unknown): string[] {
  if (!Array.isArray(emails)) return []
  const nets = emails.filter((e): e is string => typeof e === 'string').map((e) => e.trim().toLowerCase())
  return [...new Set(nets)].filter(Boolean)
}

export function claimsAmbRol(customAttributes?: string): Record<string, unknown> {
  let actuals: Record<string, unknown> = {}
  try {
    const parsed = customAttributes ? JSON.parse(customAttributes) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) actuals = parsed
  } catch {
    // claims il·legibles: es reescriuen només amb el rol
  }
  return { ...actuals, role: 'authenticated' }
}

export function planifica(emails: string[], registrats: Set<string>, comptes: CompteFirebase[]): Pla {
  const perCorreu = new Map(comptes.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]))
  const pla: Pla = { crear: [], marcar: [], jaFets: [], descartats: [] }
  for (const email of emails) {
    if (!email.endsWith(DOMINI) || !registrats.has(email)) { pla.descartats.push(email); continue }
    const compte = perCorreu.get(email)
    if (!compte) { pla.crear.push(email); continue }
    const claims = claimsAmbRol(compte.customAttributes)
    let actual: unknown
    try { actual = compte.customAttributes ? JSON.parse(compte.customAttributes)?.role : undefined } catch { actual = undefined }
    if (actual === 'authenticated') pla.jaFets.push(email)
    else pla.marcar.push({ email, localId: compte.localId, claims })
  }
  return pla
}
