import { describe, it, expect } from 'vitest'
import { CONFIG_DEFAULTS } from '../../../store/configStore'
import { textosCircular } from './textos'

describe('textos de la circular', () => {
  it('la devolució del 75 % parla de qui avisa tard, no de qui paga tard', () => {
    // La plantilla antiga ho lligava al pagament fora de termini i no
    // s'entenia. El centre va confirmar que és per a qui avisa a última hora
    // que no ve. La frase sencera, i no només un parell de bocins: amb
    // «no assisteix» i «75» hi passaria igual una frase que digués el contrari
    // —qui no ve es queda el 75 %— i és un import que les famílies reclamen.
    // És la frase que el disseny (§8) cita literalment; aquí duu els apòstrofs
    // tipogràfics que fa servir tota l'app.
    expect(CONFIG_DEFAULTS['excursions.text-devolucions'][0]).toBe(
      'Si un alumne no assisteix i s’avisa fora de termini, es retornarà el 75 % de l’import; el 25 % restant cobreix despeses ja compromeses.',
    )
  })

  it('els passos del pagament són sis i comencen per la introducció de targeta', () => {
    const passos = CONFIG_DEFAULTS['excursions.passos-pagament']
    expect(passos.length).toBe(6)
    expect(passos[0]).toContain('Introducció de la targeta')
  })

  it('els llegeix de la configuració quan n’hi ha', () => {
    const t = textosCircular({ 'excursions.text-ampa': ['L’AMPA hi col·labora amb 4 €.'] })
    expect(t.ampa).toBe('L’AMPA hi col·labora amb 4 €.')
  })

  it('i si no n’hi ha, fa servir els de sèrie', () => {
    const t = textosCircular({})
    expect(t.devolucions).toBe(CONFIG_DEFAULTS['excursions.text-devolucions'][0])
    expect(t.passosPagament.length).toBeGreaterThan(1)
  })

  it('una llista buidada a Configuració es respecta: no torna la de sèrie', () => {
    // Esborrar tots els passos del pagament desa `[]`. Si això es llegís com
    // «no hi ha res desat», la pantalla en mostraria zero i la circular en
    // seguiria imprimint sis, sense que ningú ho pogués veure.
    expect(textosCircular({ 'excursions.passos-pagament': [] }).passosPagament).toEqual([])
    expect(textosCircular({ 'excursions.text-ampa': [] }).ampa).toBe('')
  })
})
