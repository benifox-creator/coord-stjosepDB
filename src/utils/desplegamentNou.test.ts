import { describe, it, expect } from 'vitest'
import { esChunkCaducat, calRecarregar } from './desplegamentNou'

describe('reconèixer una pàgina que ha quedat enrere', () => {
  it('reconeix el missatge de cada navegador', () => {
    // No en diuen dos igual, i el que veu l'usuari depèn del que tingui obert.
    const missatges = [
      'Failed to fetch dynamically imported module: https://exemple.org/assets/DashboardPage-Cfp3qJ-Q.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/index-CgbfdDle.css',
    ]
    for (const m of missatges) expect(esChunkCaducat(new Error(m)), m).toBe(true)
  })

  it('no confon qualsevol altre error amb aquest', () => {
    // Si ho confongués, un error de debò es respondria recarregant, l'usuari
    // tornaria al mateix lloc i no sabria mai què ha passat.
    for (const m of ['No autoritzat', 'Error desant els costos: timeout', 'undefined is not a function']) {
      expect(esChunkCaducat(new Error(m)), m).toBe(false)
    }
  })

  it('no peta amb el que no és un error', () => {
    for (const v of [null, undefined, 42, {}, 'text solt']) expect(esChunkCaducat(v)).toBe(false)
  })
})

describe('decidir si recarregar', () => {
  const ARA = 1_700_000_000_000

  it('la primera vegada, sí', () => {
    expect(calRecarregar(null, ARA)).toBe(true)
  })

  it('però no dues vegades seguides', () => {
    // Si el fitxer segueix sense existir després de recarregar, insistir seria
    // un bucle: la pàgina no arrencaria mai i l'usuari no veuria ni l'error.
    expect(calRecarregar(String(ARA - 2000), ARA)).toBe(false)
  })

  it('i sí al cap d’una estona, que serà un desplegament nou', () => {
    expect(calRecarregar(String(ARA - 60_000), ARA)).toBe(true)
  })

  it('amb una marca il·legible, recarrega', () => {
    // Val més una recàrrega de més que quedar-se encallat per una marca
    // que algú ha tocat o que s'ha desat a mitges.
    expect(calRecarregar('això no és un número', ARA)).toBe(true)
  })
})
