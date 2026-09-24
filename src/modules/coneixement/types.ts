import type { TipusArticle } from './articles'

export interface ArticleLink {
  label: string
  url: string
}

export interface Article {
  id: string
  ID: string
  Titol: string
  Tipus: TipusArticle
  Categoria: string
  Contingut: string
  Tags: string          // paraules clau separades per comes
  Links: string         // JSON: ArticleLink[]
  /** Només els avisos. ISO `YYYY-MM-DD`. */
  CaducaEl: string | null
  Autor: string         // email de qui l'ha creat
  Creat_el: string      // ISO date YYYY-MM-DD
  Actualitzat_el: string
  Publicat: string      // 'true' | 'false'
}

export type ArticleFormData = {
  Titol: string
  Tipus: TipusArticle
  Categoria: string
  Contingut: string
  Tags: string
  Links: ArticleLink[]
  /** Només els avisos. ISO `YYYY-MM-DD`. */
  CaducaEl: string | null
}
