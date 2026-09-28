// src/modules/coneixement/markdown.ts
//
// D'un text a un arbre de nodes, en dues passades: primer es parteix en
// blocs línia a línia, i dins de cada bloc es torna a analitzar l'inline.
// Mòdul pur i sense cap import a propòsit: és on es decideix com es llegeix
// un text, i s'ha de poder provar sense pantalla ni base de dades. Mateix
// patró que `preu.ts` o `balanc.ts`.
//
// El que no encaixa amb cap regla surt com el text literal que és. Un
// `**negreta` sense tancar no és un error, és el text `**negreta`.

export type NodeInline =
  | { tipus: 'text'; valor: string }
  | { tipus: 'negreta'; fills: NodeInline[] }
  | { tipus: 'cursiva'; fills: NodeInline[] }
  | { tipus: 'codi'; valor: string }
  | { tipus: 'enllac'; text: NodeInline[]; url: string }

export type TipusBloc = 'titol' | 'paragraf' | 'llista' | 'cita' | 'imatge'

export type NodeBloc =
  | { tipus: 'titol'; nivell: 2 | 3; contingut: NodeInline[] }
  | { tipus: 'paragraf'; contingut: NodeInline[] }
  | { tipus: 'llista'; ordenada: boolean; items: NodeInline[][] }
  | { tipus: 'cita'; contingut: NodeInline[] }
  | { tipus: 'imatge'; alt: string; url: string }

/**
 * De text a l'inline: negreta, cursiva, codi en línia i enllaços. Cada regla
 * prova de tancar-se; si no ho troba, el marcador d'obertura es tracta com
 * un caràcter de text més i es continua des del següent.
 */
export function analitzaInline(text: string): NodeInline[] {
  const nodes: NodeInline[] = []
  let buffer = ''
  let i = 0

  function flush() {
    if (buffer) {
      nodes.push({ tipus: 'text', valor: buffer })
      buffer = ''
    }
  }

  while (i < text.length) {
    // Codi en línia: `codi`. El de dins no es torna a analitzar.
    if (text[i] === '`') {
      const tancament = text.indexOf('`', i + 1)
      if (tancament !== -1) {
        flush()
        nodes.push({ tipus: 'codi', valor: text.slice(i + 1, tancament) })
        i = tancament + 1
        continue
      }
    }

    // Enllaç: [text](url)
    if (text[i] === '[') {
      const tancaText = text.indexOf(']', i + 1)
      if (tancaText !== -1 && text[tancaText + 1] === '(') {
        const tancaUrl = text.indexOf(')', tancaText + 2)
        if (tancaUrl !== -1) {
          flush()
          const etiqueta = text.slice(i + 1, tancaText)
          const url = text.slice(tancaText + 2, tancaUrl)
          nodes.push({ tipus: 'enllac', text: analitzaInline(etiqueta), url })
          i = tancaUrl + 1
          continue
        }
      }
    }

    // Negreta: **text** — es prova abans que la cursiva, perquè comparteixen
    // el caràcter `*`.
    if (text[i] === '*' && text[i + 1] === '*') {
      const tancament = text.indexOf('**', i + 2)
      if (tancament !== -1) {
        flush()
        nodes.push({ tipus: 'negreta', fills: analitzaInline(text.slice(i + 2, tancament)) })
        i = tancament + 2
        continue
      }
    }

    // Cursiva: *text*. Si la negreta de dalt no ha trobat tancament (perquè
    // no hi ha cap altre `**`), l'execució cau aquí amb la mateixa `i` i
    // `text[i + 1]` encara és el segon `*` d'aquell intent. Sense l'exigència
    // `tancament > i + 1`, `indexOf` trobaria aquest mateix caràcter contigu
    // com a «tancament» i produiria una cursiva buida que es menjaria els
    // dos asteriscs — just el contrari del que ha de passar amb `**sense
    // tancar`, que ha de sortir com a text literal.
    if (text[i] === '*') {
      const tancament = text.indexOf('*', i + 1)
      if (tancament !== -1 && tancament > i + 1) {
        flush()
        nodes.push({ tipus: 'cursiva', fills: analitzaInline(text.slice(i + 1, tancament)) })
        i = tancament + 1
        continue
      }
    }

    buffer += text[i]
    i++
  }
  flush()
  return nodes
}

interface ConstructorLlista {
  ordenada: boolean
  items: string[]
}

/** De text a blocs: títols, paràgrafs, llistes, cites i imatges. */
export function analitzaMarkdown(text: string): NodeBloc[] {
  const blocs: NodeBloc[] = []
  let paragraf: string[] = []
  let llistaActual: ConstructorLlista | null = null
  let citaActual: string[] | null = null

  function tancaParagraf() {
    if (paragraf.length > 0) {
      blocs.push({ tipus: 'paragraf', contingut: analitzaInline(paragraf.join(' ')) })
      paragraf = []
    }
  }
  function tancaLlista() {
    if (llistaActual) {
      blocs.push({
        tipus: 'llista',
        ordenada: llistaActual.ordenada,
        items: llistaActual.items.map(analitzaInline),
      })
      llistaActual = null
    }
  }
  function tancaCita() {
    if (citaActual) {
      blocs.push({ tipus: 'cita', contingut: analitzaInline(citaActual.join(' ')) })
      citaActual = null
    }
  }
  function tancaTot() {
    tancaParagraf()
    tancaLlista()
    tancaCita()
  }

  for (const liniaOriginal of text.split('\n')) {
    const linia = liniaOriginal.trimEnd()

    if (linia.trim() === '') {
      tancaTot()
      continue
    }

    const titolMatch = /^(#{2,3})\s+(.*)$/.exec(linia)
    if (titolMatch) {
      tancaTot()
      blocs.push({
        tipus: 'titol',
        nivell: titolMatch[1].length as 2 | 3,
        contingut: analitzaInline(titolMatch[2]),
      })
      continue
    }

    const imatgeMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(linia.trim())
    if (imatgeMatch) {
      tancaTot()
      blocs.push({ tipus: 'imatge', alt: imatgeMatch[1], url: imatgeMatch[2] })
      continue
    }

    const citaMatch = /^>\s?(.*)$/.exec(linia)
    if (citaMatch) {
      tancaParagraf()
      tancaLlista()
      citaActual = citaActual ?? []
      citaActual.push(citaMatch[1])
      continue
    }

    const llistaOrdMatch = /^\d+\.\s+(.*)$/.exec(linia)
    const llistaNoOrdMatch = llistaOrdMatch ? null : /^[-*]\s+(.*)$/.exec(linia)
    if (llistaOrdMatch || llistaNoOrdMatch) {
      tancaParagraf()
      tancaCita()
      const ordenada = !!llistaOrdMatch
      const contingutItem = (llistaOrdMatch ?? llistaNoOrdMatch)![1]
      if (!llistaActual || llistaActual.ordenada !== ordenada) {
        tancaLlista()
        llistaActual = { ordenada, items: [] }
      }
      llistaActual.items.push(contingutItem)
      continue
    }

    tancaLlista()
    tancaCita()
    paragraf.push(linia.trim())
  }

  tancaTot()
  return blocs
}
