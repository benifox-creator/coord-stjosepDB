/**
 * Codi curt i llegible d'un error d'inici de sessió, pensat per ensenyar-lo a
 * qui no ha pogut entrar. Firebase els dona a `err.code` (per exemple
 * `auth/popup-closed-by-user`), i és l'única pista útil quan algú avisa que
 * no pot accedir: sense això, l'únic que es pot dir és "no funciona".
 */
export function codiError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    if (typeof code === 'string' && code.trim()) return code.trim()
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return 'desconegut'
}

export function missatgeErrorLogin(err: unknown): string {
  return `No s'ha pogut iniciar sessió. Torna-ho a intentar. (codi: ${codiError(err)})`
}
