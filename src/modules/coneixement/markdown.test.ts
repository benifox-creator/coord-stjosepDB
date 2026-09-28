import { describe, it, expect } from 'vitest'
import { analitzaInline, analitzaMarkdown } from './markdown'

describe('l’inline', () => {
  it('text pla, tal qual', () => {
    expect(analitzaInline('Hola món')).toEqual([{ tipus: 'text', valor: 'Hola món' }])
  })

  it('negreta', () => {
    expect(analitzaInline('**important**')).toEqual([
      { tipus: 'negreta', fills: [{ tipus: 'text', valor: 'important' }] },
    ])
  })

  it('cursiva', () => {
    expect(analitzaInline('*destacat*')).toEqual([
      { tipus: 'cursiva', fills: [{ tipus: 'text', valor: 'destacat' }] },
    ])
  })

  it('codi en línia, i el que hi ha dins no es torna a analitzar', () => {
    // Si `**no és negreta**` es tornés a analitzar dins del codi, deixaria de
    // mostrar els asteriscs, que és exactament el que el codi ha de conservar.
    expect(analitzaInline('`**no és negreta**`')).toEqual([
      { tipus: 'codi', valor: '**no és negreta**' },
    ])
  })

  it('un enllaç, amb el text també analitzat per dins', () => {
    expect(analitzaInline('[**Manual**](https://exemple.cat)')).toEqual([
      {
        tipus: 'enllac',
        url: 'https://exemple.cat',
        text: [{ tipus: 'negreta', fills: [{ tipus: 'text', valor: 'Manual' }] }],
      },
    ])
  })

  it('negreta i cursiva enllaçades, cadascuna amb el seu tancament', () => {
    expect(analitzaInline('**a** i **b**')).toEqual([
      { tipus: 'negreta', fills: [{ tipus: 'text', valor: 'a' }] },
      { tipus: 'text', valor: ' i ' },
      { tipus: 'negreta', fills: [{ tipus: 'text', valor: 'b' }] },
    ])
  })

  it('cursiva dins de negreta', () => {
    expect(analitzaInline('**molt *destacat* de veritat**')).toEqual([
      {
        tipus: 'negreta',
        fills: [
          { tipus: 'text', valor: 'molt ' },
          { tipus: 'cursiva', fills: [{ tipus: 'text', valor: 'destacat' }] },
          { tipus: 'text', valor: ' de veritat' },
        ],
      },
    ])
  })

  it('un asterisc doble sense tancar és text literal', () => {
    expect(analitzaInline('**sense tancar')).toEqual([{ tipus: 'text', valor: '**sense tancar' }])
  })

  it('un asterisc sol sense tancar és text literal', () => {
    expect(analitzaInline('*sense tancar')).toEqual([{ tipus: 'text', valor: '*sense tancar' }])
  })

  it('un accent obert sense tancar és text literal', () => {
    expect(analitzaInline('`sense tancar')).toEqual([{ tipus: 'text', valor: '`sense tancar' }])
  })

  it('un claudàtor obert sense parèntesi és text literal', () => {
    expect(analitzaInline('[no és un enllaç')).toEqual([{ tipus: 'text', valor: '[no és un enllaç' }])
  })

  it('cadena buida', () => {
    expect(analitzaInline('')).toEqual([])
  })
})

describe('els blocs', () => {
  it('un títol de nivell 2', () => {
    expect(analitzaMarkdown('## Com es fa')).toEqual([
      { tipus: 'titol', nivell: 2, contingut: [{ tipus: 'text', valor: 'Com es fa' }] },
    ])
  })

  it('un títol de nivell 3', () => {
    expect(analitzaMarkdown('### Pas 1')).toEqual([
      { tipus: 'titol', nivell: 3, contingut: [{ tipus: 'text', valor: 'Pas 1' }] },
    ])
  })

  it('un sol coixinet no és cap títol', () => {
    expect(analitzaMarkdown('# Títol gran')).toEqual([
      { tipus: 'paragraf', contingut: [{ tipus: 'text', valor: '# Títol gran' }] },
    ])
  })

  it('quatre coixinets tampoc', () => {
    expect(analitzaMarkdown('#### Massa')).toEqual([
      { tipus: 'paragraf', contingut: [{ tipus: 'text', valor: '#### Massa' }] },
    ])
  })

  it('dues línies seguides fan un sol paràgraf', () => {
    expect(analitzaMarkdown('Primera línia\nSegona línia')).toEqual([
      { tipus: 'paragraf', contingut: [{ tipus: 'text', valor: 'Primera línia Segona línia' }] },
    ])
  })

  it('una línia en blanc separa dos paràgrafs', () => {
    expect(analitzaMarkdown('Un.\n\nDos.')).toEqual([
      { tipus: 'paragraf', contingut: [{ tipus: 'text', valor: 'Un.' }] },
      { tipus: 'paragraf', contingut: [{ tipus: 'text', valor: 'Dos.' }] },
    ])
  })

  it('una llista amb pic, amb guionet', () => {
    expect(analitzaMarkdown('- U\n- Dos\n- Tres')).toEqual([
      {
        tipus: 'llista', ordenada: false,
        items: [
          [{ tipus: 'text', valor: 'U' }],
          [{ tipus: 'text', valor: 'Dos' }],
          [{ tipus: 'text', valor: 'Tres' }],
        ],
      },
    ])
  })

  it('una llista amb pic, amb asterisc', () => {
    expect(analitzaMarkdown('* U\n* Dos')).toEqual([
      {
        tipus: 'llista', ordenada: false,
        items: [[{ tipus: 'text', valor: 'U' }], [{ tipus: 'text', valor: 'Dos' }]],
      },
    ])
  })

  it('una llista numerada', () => {
    expect(analitzaMarkdown('1. Primer\n2. Segon')).toEqual([
      {
        tipus: 'llista', ordenada: true,
        items: [[{ tipus: 'text', valor: 'Primer' }], [{ tipus: 'text', valor: 'Segon' }]],
      },
    ])
  })

  it('canviar de tipus de llista sense línia en blanc en tanca una i n’obre una altra', () => {
    const blocs = analitzaMarkdown('- U\n1. Dos')
    expect(blocs).toHaveLength(2)
    expect(blocs[0]).toMatchObject({ tipus: 'llista', ordenada: false })
    expect(blocs[1]).toMatchObject({ tipus: 'llista', ordenada: true })
  })

  it('una cita', () => {
    expect(analitzaMarkdown('> Una frase citada')).toEqual([
      { tipus: 'cita', contingut: [{ tipus: 'text', valor: 'Una frase citada' }] },
    ])
  })

  it('una cita de dues línies es fusiona en una de sola', () => {
    expect(analitzaMarkdown('> Primera part\n> segona part')).toEqual([
      { tipus: 'cita', contingut: [{ tipus: 'text', valor: 'Primera part segona part' }] },
    ])
  })

  it('una imatge tota sola a la línia', () => {
    expect(analitzaMarkdown('![Captura del formulari](https://exemple.cat/img.png)')).toEqual([
      { tipus: 'imatge', alt: 'Captura del formulari', url: 'https://exemple.cat/img.png' },
    ])
  })

  it('una seqüència amb de tot, en l’ordre que toca', () => {
    const text = [
      '## Com es reserva el carro',
      '',
      'Primer entres a **Reserves**.',
      '',
      '- Tria la data',
      '- Confirma',
      '',
      '![Pantalla de reserves](https://exemple.cat/pas1.png)',
      '',
      '> Si el carro ja està reservat, tria un altre dia.',
    ].join('\n')
    const blocs = analitzaMarkdown(text)
    expect(blocs.map((b) => b.tipus)).toEqual(['titol', 'paragraf', 'llista', 'imatge', 'cita'])
  })

  it('cap article es queda a mitges: el text buit no dona cap bloc', () => {
    expect(analitzaMarkdown('')).toEqual([])
  })

  it('només línies en blanc, tampoc', () => {
    expect(analitzaMarkdown('\n\n   \n')).toEqual([])
  })
})
