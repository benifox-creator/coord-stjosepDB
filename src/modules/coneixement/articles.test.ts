import { describe, it, expect } from 'vitest'
import { esVigent, agrupaPerTipus, cerca, aLlista, type ArticleLlista, type ArticleDesat } from './articles'

const AVUI = '2026-09-24'

function art(canvis: Partial<ArticleLlista> = {}): ArticleLlista {
  return {
    id: 'a1', titol: 'Com es reserva el carro', tipus: 'procediment',
    categoria: 'Procediments', contingut: 'Primer entres a Reserves.',
    tags: ['carro', 'portàtils'], caducaEl: null, publicat: true,
    ...canvis,
  }
}

describe('si un article encara val', () => {
  it('el que no caduca, sempre', () => {
    expect(esVigent(art(), AVUI)).toBe(true)
  })

  it('un avís amb la data per venir, sí', () => {
    expect(esVigent(art({ tipus: 'avis', caducaEl: '2026-12-31' }), AVUI)).toBe(true)
  })

  it('un avís que caduca avui encara val', () => {
    // El dia que caduca és l'últim que serveix, no el primer que no.
    expect(esVigent(art({ tipus: 'avis', caducaEl: AVUI }), AVUI)).toBe(true)
  })

  it('un avís d’ahir, no', () => {
    expect(esVigent(art({ tipus: 'avis', caducaEl: '2026-09-23' }), AVUI)).toBe(false)
  })
})

describe('agrupar per a la pantalla', () => {
  const tots = [
    art({ id: 'p1', tipus: 'pregunta', titol: 'Qui obre el gimnàs' }),
    art({ id: 'pr1', tipus: 'procediment' }),
    art({ id: 'd1', tipus: 'document', titol: 'Protocol d’absentisme' }),
    art({ id: 'av1', tipus: 'avis', titol: 'Novetat', caducaEl: '2026-12-31' }),
    art({ id: 'av2', tipus: 'avis', titol: 'Vella', caducaEl: '2026-01-01' }),
  ]

  it('cada tipus al seu lloc', () => {
    const g = agrupaPerTipus(tots, AVUI)
    expect(g.preguntes.map((a) => a.id)).toEqual(['p1'])
    expect(g.procediments.map((a) => a.id)).toEqual(['pr1'])
    expect(g.documents.map((a) => a.id)).toEqual(['d1'])
  })

  it('els avisos vigents van a part dels caducats', () => {
    const g = agrupaPerTipus(tots, AVUI)
    expect(g.avisos.map((a) => a.id)).toEqual(['av1'])
    expect(g.caducats.map((a) => a.id)).toEqual(['av2'])
  })

  it('un avís caducat no surt entre els vigents encara que hi hagi molts', () => {
    const g = agrupaPerTipus([art({ id: 'x', tipus: 'avis', caducaEl: '2020-01-01' })], AVUI)
    expect(g.avisos).toEqual([])
    expect(g.caducats.map((a) => a.id)).toEqual(['x'])
  })

  it('cap article es perd pel camí', () => {
    const g = agrupaPerTipus(tots, AVUI)
    const total = g.preguntes.length + g.procediments.length + g.documents.length
      + g.avisos.length + g.caducats.length
    expect(total).toBe(tots.length)
  })

  it('un tipus fora de la unió no fa petar l’agrupació ni tota l’aplicació: cau a Documents', () => {
    // Una fila corrupta o una migració a mitges pot dur un valor que la
    // unió no admet. `agrupaPerTipus` corre sota l'ErrorBoundary de tota
    // l'aplicació: si llencés aquí, un sol article estrany deixaria
    // tothom en blanc, no només aquesta pantalla.
    const estrany = art({ id: 'z', tipus: 'faq' as ArticleLlista['tipus'] })
    expect(() => agrupaPerTipus([estrany], AVUI)).not.toThrow()
    const g = agrupaPerTipus([estrany], AVUI)
    expect(g.documents.map((a) => a.id)).toEqual(['z'])
  })
})

describe('cercar', () => {
  const tots = [
    art({ id: 'a', titol: 'Com es reserva el carro', contingut: 'Primer entres a Reserves.', tags: ['carro'] }),
    art({ id: 'b', titol: 'Qui obre el gimnàs', contingut: 'El conserge, a les vuit.', tags: ['gimnàs'] }),
  ]

  it('sense text, tots', () => {
    expect(cerca(tots, '').map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('pel títol', () => {
    expect(cerca(tots, 'gimnàs').map((a) => a.id)).toEqual(['b'])
  })

  it('per l’etiqueta', () => {
    expect(cerca(tots, 'carro').map((a) => a.id)).toEqual(['a'])
  })

  it('i **pel contingut**, que és el que ara no fa', () => {
    // Quan busques, el que recordes sol ser una paraula de dins, no el títol.
    expect(cerca(tots, 'conserge').map((a) => a.id)).toEqual(['b'])
  })

  it('sense accents i sense majúscules', () => {
    expect(cerca(tots, 'GIMNAS').map((a) => a.id)).toEqual(['b'])
  })

  it('el que no hi és, no hi surt', () => {
    expect(cerca(tots, 'piscina')).toEqual([])
  })
})

describe('passar de l’article desat al de la llista', () => {
  const desat: ArticleDesat = {
    id: 'a1', Titol: 'Com es reserva el carro', Tipus: 'procediment' as const,
    Categoria: 'Procediments', Contingut: 'Primer...', Tags: 'carro, portàtils',
    CaducaEl: null, Publicat: 'true',
  }

  it('les etiquetes passen de cadena a llista', () => {
    expect(aLlista(desat).tags).toEqual(['carro', 'portàtils'])
  })

  it('sense etiquetes, una llista buida i no una amb una cadena buida', () => {
    expect(aLlista({ ...desat, Tags: '' }).tags).toEqual([])
  })

  it('el publicat passa de text a booleà', () => {
    expect(aLlista(desat).publicat).toBe(true)
    expect(aLlista({ ...desat, Publicat: 'false' }).publicat).toBe(false)
  })
})
