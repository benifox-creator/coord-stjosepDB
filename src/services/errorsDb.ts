// Tradueix els errors de Supabase que vol dir «no tens permís» a un missatge
// que s'entengui. La base de dades no ho diu mai així: segons per on passa,
// arriba com «Cannot coerce the result to a single JSON object» (l'actualització
// no ha tocat cap fila perquè les regles d'accés l'amaguen), com «violates
// row-level security policy», com «permission denied» o com el «No autoritzat»
// que llancen les funcions protegides. La resta d'errors es deixen com eren.

const SENSE_PERMIS = 'No tens permís per fer aquesta acció. Si creus que l’hauries de poder fer, parla amb coordinació.'

export interface ErrorDb { code?: string; message: string }

/** `prefix` (p. ex. «Error afegint registre a usuaris») només s'usa per als errors que no es tradueixen. */
export function missatgeError(error: ErrorDb, prefix?: string): string {
  const { code = '', message = '' } = error
  if (code === 'PGRST116') {
    return 'No tens permís per fer aquest canvi, o el registre ja no existeix. Si creus que l’hauries de poder fer, parla amb coordinació.'
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message) || message.trim() === 'No autoritzat') {
    return SENSE_PERMIS
  }
  if (code === 'PGRST301' || code === 'PGRST303' || /JWT expired/i.test(message)) {
    return 'La sessió ha caducat. Torna a carregar la pàgina i, si cal, torna a entrar.'
  }
  return prefix ? `${prefix}: ${message}` : message
}
