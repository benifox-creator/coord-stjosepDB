// src/modules/coneixement/articles.ts
//
// Què veu el claustre i en quin ordre. Aïllat de tota la resta a propòsit:
// és la part que decideix si una cosa es troba o no, i s'ha de poder provar
// sense muntar ni pantalla ni base de dades.

export type TipusArticle = 'pregunta' | 'procediment' | 'document' | 'avis'

export interface ArticleLlista {
  id: string
  titol: string
  tipus: TipusArticle
  categoria: string
  contingut: string
  tags: string[]
  /** Només els avisos en tenen. ISO `YYYY-MM-DD`. */
  caducaEl: string | null
  publicat: boolean
}

export interface GrupsArticles {
  avisos: ArticleLlista[]
  preguntes: ArticleLlista[]
  procediments: ArticleLlista[]
  documents: ArticleLlista[]
  /** Els avisos que ja han passat. No s'esborren: deixen d'ocupar el lloc. */
  caducats: ArticleLlista[]
}

/**
 * El dia que caduca encara val: és l'últim dia que serveix, no el primer que
 * no. Les dates són ISO, així que comparar-les com a cadenes és correcte.
 */
export function esVigent(a: ArticleLlista, avui: string): boolean {
  return a.caducaEl === null || a.caducaEl >= avui
}

export function agrupaPerTipus(articles: ArticleLlista[], avui: string): GrupsArticles {
  const g: GrupsArticles = { avisos: [], preguntes: [], procediments: [], documents: [], caducats: [] }
  for (const a of articles) {
    if (a.tipus === 'avis') {
      // Un avís del gener al mig de la llista al juny fa que algú s'hi fiï i
      // que a partir d'aquell dia no torni. Per això surt de la llista, però
      // no s'esborra: va passar, i de vegades cal recordar quan.
      ;(esVigent(a, avui) ? g.avisos : g.caducats).push(a)
      continue
    }
    if (a.tipus === 'pregunta') g.preguntes.push(a)
    else if (a.tipus === 'procediment') g.procediments.push(a)
    else g.documents.push(a)
  }
  return g
}

/** Sense accents i sense majúscules: qui busca no els encerta. */
function clau(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function cerca(articles: ArticleLlista[], text: string): ArticleLlista[] {
  const q = clau(text.trim())
  if (q === '') return articles
  // També dins el contingut: quan busques, el que recordes sol ser una
  // paraula de dins i no pas el títol, que és el que fins ara es mirava.
  return articles.filter((a) =>
    clau(a.titol).includes(q) || clau(a.contingut).includes(q) ||
    a.tags.some((t) => clau(t).includes(q)))
}

/** La forma que té un article tal com el torna el hook, heretada del full de càlcul. */
export interface ArticleDesat {
  id: string
  Titol: string
  Tipus: TipusArticle
  Categoria: string
  Contingut: string
  /** Separades per comes. */
  Tags: string
  CaducaEl: string | null
  /** `'true'` o `'false'`, en text. */
  Publicat: string
}

export function aLlista(a: ArticleDesat): ArticleLlista {
  return {
    id: a.id, titol: a.Titol, tipus: a.Tipus, categoria: a.Categoria,
    contingut: a.Contingut,
    tags: a.Tags.split(',').map((t) => t.trim()).filter(Boolean),
    caducaEl: a.CaducaEl,
    publicat: a.Publicat === 'true',
  }
}
