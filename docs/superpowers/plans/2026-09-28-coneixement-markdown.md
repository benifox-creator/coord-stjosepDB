# Base de Coneixement B — el Markdown, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El contingut d'un article passa de text pla a Markdown, escrit amb una previsualització i pintat amb títols, negreta, cursiva, llistes, cites, codi en línia, enllaços i imatges.

**Architecture:** Un mòdul pur (`markdown.ts`) analitza el text en dues passades —bloc i després línia— i produeix un arbre de nodes tipats; un component prim (`MarkdownContent.tsx`) el recorre i el pinta com a elements de React, mai com a HTML. Dos punts d'ús ja existents es connecten a aquest component: la fitxa d'un article i la previsualització del formulari.

**Tech Stack:** React 19 + TypeScript estricte, Tailwind, Vitest amb `environment: 'node'` (sense DOM).

**Spec:** `docs/superpowers/specs/2026-09-24-base-coneixement-design.md`, §4 («El contingut: Markdown, i sense HTML enlloc»).

## Global Constraints

- **El Markdown es converteix en elements de React, mai en HTML.** Cap `dangerouslySetInnerHTML` a tot el projecte, i aquesta peça no en pot ser la primera.
- **El subconjunt que s'entén, i res més**: títols (`##`, `###`), negreta, cursiva, llistes (amb pic i numerades), cites, codi en línia, enllaços i imatges. El que no hi encaixi surt com el text literal que és — mai un error, mai es perd.
- **`markdown.ts` no importa res del projecte.** És on es decideix com es llegeix un text, i s'ha de poder provar sense pantalla ni base de dades.
- **Tot en català**: noms, comentaris, textos de pantalla.
- **Apòstrof tipogràfic `’` a tot el text de cara a l'usuari**; als comentaris de codi, l'apòstrof recte és la convenció del repositori.
- **TypeScript estricte** (`verbatimModuleSyntax`, `noUnusedLocals`): els tipus amb `import type`.
- **No hi ha proves de components**: Vitest corre amb `environment: 'node'`, sense DOM. Tota lògica provable viu al mòdul pur.
- **`npx tsc --noEmit` compila zero fitxers** en aquest projecte: el `tsconfig.json` de l'arrel és només referències. La comprovació real és `npm run typecheck`.
- Mai `text-gray-400` per a text que s'hagi de llegir; text secundari, `text-gray-500`.
- **Cap migració ni canvi a la base de dades.** `Contingut` ja és `text`; el Markdown hi cap tal com és.

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `src/modules/coneixement/markdown.ts` **(nou)** | Analitza un text i en fa un arbre de nodes: blocs (títols, paràgrafs, llistes, cites, imatges) i, dins de cada bloc, l'inline (negreta, cursiva, codi, enllaços). |
| `src/modules/coneixement/markdown.test.ts` **(nou)** | Les seves proves. |
| `src/modules/coneixement/MarkdownContent.tsx` **(nou)** | Recorre l'arbre i el pinta com a elements de React. Capa prima, sense decisions: si sembla que en cal una, és que ha de tornar a `markdown.ts`. |
| `src/modules/coneixement/ConeixementDetall.tsx` **(modificar)** | La fitxa d'un article pinta el Markdown en comptes de text pla. |
| `src/modules/coneixement/ConeixementForm.tsx` **(modificar)** | El camp de contingut guanya un interruptor «Escriu / Previsualitza». |

---

### Task 1: L'analitzador

**Files:**
- Create: `src/modules/coneixement/markdown.ts`
- Test: `src/modules/coneixement/markdown.test.ts`

**Interfaces:**
- Consumes: res del projecte.
- Produces: `TipusBloc`, `NodeBloc`, `NodeInline`, `analitzaInline(text: string): NodeInline[]`, `analitzaMarkdown(text: string): NodeBloc[]`.

**Context que et cal i que no pots endevinar:**

- Es fa en **dues passades**: primer es parteix el text en blocs línia a línia (títols, paràgrafs, llistes, cites, imatges), i **dins de cada bloc** es torna a analitzar el text per l'inline (negreta, cursiva, codi, enllaços). Un paràgraf de dues línies seguides es fusiona en un de sol, separat per un espai —el «line folding» habitual del Markdown.
- **El que no encaixa surt com el text literal que és.** Un `**negreta` sense tancar no és un error: és el text `**negreta` tal com s'ha escrit. Cada regla de l'analitzador ha de tenir aquest camí de sortida.
- Només `##` i `###` són títols. Un `#` sol, o quatre o més, **no** és cap títol: cau a paràgraf tal com està escrit.
- Una imatge només compta si ocupa **tota la línia**: `![descripció](url)` sola. No hi ha imatges enmig d'una frase en aquest subconjunt.

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/coneixement/markdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/coneixement/markdown.test.ts`
Expected: FAIL — el mòdul `./markdown` no existeix.

- [ ] **Step 3: Escriu `markdown.ts`**

```ts
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

    // Cursiva: *text*
    if (text[i] === '*') {
      const tancament = text.indexOf('*', i + 1)
      if (tancament !== -1) {
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
```

- [ ] **Step 4: Executa-les i comprova que passen**

Run: `npx vitest run src/modules/coneixement/markdown.test.ts`
Expected: PASS, 28 proves.

- [ ] **Step 5: Comprova amb dues mutacions que les proves proven alguna cosa**

1. Treu la comprovació `if (tancament !== -1)` de la negreta (deixa-la sempre executar-se, encara que `tancament` sigui `-1`). Ha de fallar «un asterisc doble sense tancar és text literal» — probablement amb un error en temps d'execució (`text.slice` amb un índex `-1` no peta, però dona un tros de text equivocat) o amb el resultat equivocat. Desfés-ho.
2. Al bloc de llistes, canvia `llistaActual.ordenada !== ordenada` per `false` (mai tanquis la llista per canvi de tipus). Ha de fallar «canviar de tipus de llista sense línia en blanc en tanca una i n'obre una altra». Desfés-ho.

Digues a l'informe què va passar exactament a cadascuna.

- [ ] **Step 6: Commit**

```bash
git add src/modules/coneixement/markdown.ts src/modules/coneixement/markdown.test.ts
git commit -m "feat(coneixement): l'analitzador de Markdown, de text a arbre de nodes"
```

---

### Task 2: El component que ho pinta

**Files:**
- Create: `src/modules/coneixement/MarkdownContent.tsx`
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: `NodeBloc`, `NodeInline`, `analitzaMarkdown` de `./markdown` (Task 1).
- Produces: `<MarkdownContent text={string} />`.

**Context que et cal i que no pots endevinar:**

- **Capa prima, sense decisions.** Aquest component no ha de tenir cap `if` que decideixi *què* és una cosa —això ja ho ha decidit `markdown.ts`—, només *com* es pinta.
- **Sense HTML.** Res de `dangerouslySetInnerHTML` ni de construir cadenes d'HTML. Tot són elements de React.
- El projecte **no té cap plugin de tipografia de Tailwind** (`@tailwindcss/typography`). No l'afegeixis: estila cada element a mà amb les classes que ja fa servir la resta del mòdul.
- **Aquest component és qui decideix què vol dir «sense contingut».** Els dos llocs que el criden (Task 3 i Task 4) no han de repetir aquesta comprovació.

- [ ] **Step 1: Escriu `MarkdownContent.tsx`**

```tsx
// src/modules/coneixement/MarkdownContent.tsx
//
// Pinta l'arbre que produeix `markdown.ts`. Capa prima i sense decisions:
// si sembla que en cal una, és que ha de tornar a `markdown.ts`, que és on
// es pot provar sense muntar cap component.
import type { NodeBloc, NodeInline } from './markdown'
import { analitzaMarkdown } from './markdown'

function pintaInline(nodes: NodeInline[]): React.ReactNode {
  return nodes.map((node, i) => {
    switch (node.tipus) {
      case 'text':
        return node.valor
      case 'negreta':
        return <strong key={i}>{pintaInline(node.fills)}</strong>
      case 'cursiva':
        return <em key={i}>{pintaInline(node.fills)}</em>
      case 'codi':
        return (
          <code key={i} className="px-1 py-0.5 bg-gray-100 rounded text-[13px] font-mono">
            {node.valor}
          </code>
        )
      case 'enllac':
        return (
          <a
            key={i}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {pintaInline(node.text)}
          </a>
        )
    }
  })
}

function pintaBloc(bloc: NodeBloc, i: number): React.ReactNode {
  switch (bloc.tipus) {
    case 'titol':
      return bloc.nivell === 2 ? (
        <h2 key={i} className="text-base font-semibold text-text-main mt-1">
          {pintaInline(bloc.contingut)}
        </h2>
      ) : (
        <h3 key={i} className="text-sm font-semibold text-text-main mt-1">
          {pintaInline(bloc.contingut)}
        </h3>
      )
    case 'paragraf':
      return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {pintaInline(bloc.contingut)}
        </p>
      )
    case 'llista': {
      const Etiqueta = bloc.ordenada ? 'ol' : 'ul'
      return (
        <Etiqueta key={i} className={`text-sm text-gray-700 leading-relaxed pl-5 space-y-1 ${bloc.ordenada ? 'list-decimal' : 'list-disc'}`}>
          {bloc.items.map((item, j) => <li key={j}>{pintaInline(item)}</li>)}
        </Etiqueta>
      )
    }
    case 'cita':
      return (
        <blockquote key={i} className="border-l-2 border-gray-300 pl-3 text-sm text-gray-500 italic">
          {pintaInline(bloc.contingut)}
        </blockquote>
      )
    case 'imatge':
      return (
        <img
          key={i}
          src={bloc.url}
          alt={bloc.alt}
          className="rounded-lg border border-gray-200 max-w-full"
        />
      )
  }
}

export function MarkdownContent({ text }: { text: string }) {
  const blocs = analitzaMarkdown(text)
  if (blocs.length === 0) {
    return <p className="text-sm text-gray-500 italic">Sense contingut.</p>
  }
  return <div className="space-y-3">{blocs.map(pintaBloc)}</div>
}
```

- [ ] **Step 2: Tanca la porta a `dangerouslySetInnerHTML` per a tot el projecte**

A `eslint.config.js`, afegeix la regla `no-restricted-syntax` al bloc de `rules` (crea'l si no hi és):

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // El Markdown de la Base de Coneixement es pinta com a elements de
      // React i mai com a HTML: és el que fa que la injecció de codi no
      // estigui filtrada, sinó que no sigui possible. Aquesta regla ho manté
      // cert per a tot el projecte, no només per a qui ho recordi avui.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'Aquest projecte no fa servir dangerouslySetInnerHTML: tot el contingut de l’usuari es pinta com a elements de React.',
        },
      ],
    },
  },
])
```

No cal cap dependència nova: `no-restricted-syntax` és una regla del nucli d'ESLint.

- [ ] **Step 3: Portes**

Run: `npm run lint && npm run typecheck`
Expected: net. Si vols comprovar que la regla nova funciona de debò, afegeix temporalment un `<div dangerouslySetInnerHTML={{ __html: 'x' }} />` a qualsevol `.tsx`, executa `npm run lint` i mira que falli amb el missatge d'amunt; treu-lo després.

- [ ] **Step 4: Commit**

```bash
git add src/modules/coneixement/MarkdownContent.tsx eslint.config.js
git commit -m "feat(coneixement): el component que pinta el Markdown, i tanca la porta a l'HTML per sempre"
```

---

### Task 3: La fitxa d'un article

**Files:**
- Modify: `src/modules/coneixement/ConeixementDetall.tsx`

**Interfaces:**
- Consumes: `<MarkdownContent text={string} />` de la Task 2.

**Context que et cal:**

- El bloc que has de canviar és el de «Contingut», aproximadament a les línies 102-112 del fitxer, que avui fa `whitespace-pre-wrap` sobre `article.Contingut` en text pla.
- `MarkdownContent` **ja porta el seu propi missatge de «Sense contingut.»** quan el text és buit (Task 2). Aquí ja no cal repetir la comprovació `article.Contingut ? ... : ...`: mostra sempre l'etiqueta «Contingut» i deixa que `MarkdownContent` decideixi què hi ha a sota. És un canvi petit i deliberat: abans, un article sense cos no ensenyava ni tan sols l'etiqueta; ara la fitxa diu explícitament que hi ha una secció de contingut i que és buida, en comptes de no dir-ne res.

- [ ] **Step 1: Substitueix el bloc**

Canvia:

```tsx
{/* Contingut */}
{article.Contingut ? (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contingut</p>
    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100">
      {article.Contingut}
    </div>
  </div>
) : (
  <p className="text-sm text-gray-400 italic">Sense contingut.</p>
)}
```

per:

```tsx
{/* Contingut, en Markdown */}
<div>
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contingut</p>
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
    <MarkdownContent text={article.Contingut} />
  </div>
</div>
```

I afegeix l'import, al costat dels altres imports del fitxer:

```tsx
import { MarkdownContent } from './MarkdownContent'
```

- [ ] **Step 2: Portes**

Run: `npm run lint && npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/modules/coneixement/ConeixementDetall.tsx
git commit -m "feat(coneixement): la fitxa pinta el contingut en Markdown"
```

---

### Task 4: Escriure amb previsualització

**Files:**
- Modify: `src/modules/coneixement/ConeixementForm.tsx`

**Interfaces:**
- Consumes: `<MarkdownContent text={string} />` de la Task 2.

**Context que et cal i que no pots endevinar:**

- **Un interruptor, no dues columnes.** La spec en parla com d'una previsualització «al costat», però el formulari és un diàleg de `max-w-2xl`: dues columnes hi quedarien massa estretes per llegir-s'hi còmodament. Es fa amb un interruptor «Escriu / Previsualitza» que mostra l'un o l'altre, amb el mateix estil de píndola que ja fa servir el projecte (`GraficEtapes.tsx` a Excursions, i el panell de categories de Configuració): `role="tablist"`, `bg-gray-100 rounded-lg p-0.5`, la pestanya activa en blanc amb ombra suau.
- **El text que s'edita no es toca en canviar de vista.** `contingut` és el mateix estat tant si es mostra el `<textarea>` com la previsualització; l'interruptor només decideix quin dels dos es pinta.

- [ ] **Step 1: Afegeix l'estat i l'import**

Al costat dels altres `useState` del component:

```tsx
const [vista, setVista] = useState<'escriu' | 'previsualitza'>('escriu')
```

I al capçal del fitxer, al costat dels altres imports:

```tsx
import { MarkdownContent } from './MarkdownContent'
```

- [ ] **Step 2: Substitueix el bloc de contingut**

Canvia:

```tsx
{/* Contingut */}
<div>
  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contingut</label>
  <textarea
    value={contingut}
    onChange={(e) => setContingut(e.target.value)}
    placeholder="Escriu el cos de l'article..."
    className="input w-full resize-y"
    rows={8}
  />
</div>
```

per:

```tsx
{/* Contingut, amb Markdown */}
<div>
  <div className="flex items-center justify-between mb-1.5">
    <label className="text-xs font-semibold text-gray-600">Contingut</label>
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={vista === 'escriu'}
        onClick={() => setVista('escriu')}
        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
          vista === 'escriu' ? 'bg-white text-text-main font-medium shadow-sm' : 'text-gray-500'
        }`}
      >
        Escriu
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={vista === 'previsualitza'}
        onClick={() => setVista('previsualitza')}
        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
          vista === 'previsualitza' ? 'bg-white text-text-main font-medium shadow-sm' : 'text-gray-500'
        }`}
      >
        Previsualitza
      </button>
    </div>
  </div>

  {vista === 'escriu' ? (
    <textarea
      value={contingut}
      onChange={(e) => setContingut(e.target.value)}
      placeholder="Escriu el cos de l'article..."
      className="input w-full resize-y"
      rows={8}
    />
  ) : (
    <div className="border border-gray-200 rounded-lg px-4 py-3 min-h-48 bg-gray-50">
      <MarkdownContent text={contingut} />
    </div>
  )}

  <p className="text-xs text-gray-500 mt-1">
    Admet Markdown: <code className="px-1 bg-gray-100 rounded">##</code> per a un títol,{' '}
    <code className="px-1 bg-gray-100 rounded">**text**</code> per a negreta,{' '}
    <code className="px-1 bg-gray-100 rounded">-</code> per a una llista, i{' '}
    <code className="px-1 bg-gray-100 rounded">![descripció](url)</code> per a una imatge.
  </p>
</div>
```

- [ ] **Step 3: Portes senceres**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tot verd. Informa del nombre de **fitxers** de prova, no només del de proves.

- [ ] **Step 4: Commit**

```bash
git add src/modules/coneixement/ConeixementForm.tsx
git commit -m "feat(coneixement): interruptor d'escriure i previsualitzar el Markdown"
```

---

## Comprovació manual abans de fusionar

No es pot provar amb Vitest i és el que de debò farà servir el claustre:

1. `npm run dev`, entra com a algú que pugui redactar, i crea un article amb un `##`, un `**text**`, una llista i una imatge (fes servir qualsevol URL pública per a la imatge, per exemple una de Wikimedia). Prem «Previsualitza» i comprova que es veu tal com toca.
2. Escriu `**sense tancar` i comprova a la previsualització que surt literalment `**sense tancar`, no que desapareix ni que peta.
3. Desa'l i obre la fitxa des de la llista: ha de veure's igual que a la previsualització.
4. Enganxa un enllaç d'imatge d'un Drive privat del centre (no cal que carregui, només comprovar que l'element `<img>` hi és i que l'`alt` es llegeix si la imatge no carrega).

## Què no entra

Pujar fitxers des de l'ordinador (part C: el bucket de Storage); taules; salts de línia forçats dins d'un paràgraf sense doble salt; qualsevol sintaxi de Markdown fora del subconjunt de l'spec §4.
