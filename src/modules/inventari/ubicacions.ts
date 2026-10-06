export interface Ubicacio {
  id: string
  Codi: string
  Edifici: string
  Planta: string
}

// `A21-ESO-2A · A-EscC · PTA1`, sense les parts buides. Un codi que no és al
// catàleg es mostra tal qual: millor veure'l que amagar-lo.
export function ubicacioCompleta(codi: string, ubicacions: Ubicacio[]): string {
  if (!codi) return ''
  const u = ubicacions.find((x) => x.Codi === codi)
  return [codi, u?.Edifici ?? '', u?.Planta ?? ''].filter((p) => p.trim() !== '').join(' · ')
}

// Els dos errors que pot donar el catàleg arriben amb el text de Postgres,
// que no el sabria llegir ningú.
export function missatgeErrorUbicacio(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('foreign key')) {
    return 'Aquesta ubicació encara té dispositius assignats. Canvia’ls d’ubicació abans d’esborrar-la.'
  }
  if (msg.includes('duplicate key')) return 'Ja hi ha una ubicació amb aquest codi.'
  return msg
}
