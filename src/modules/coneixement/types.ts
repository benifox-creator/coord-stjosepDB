export interface ArticleLink {
  label: string
  url: string
}

export interface Article {
  ID: string
  Titol: string
  Categoria: string
  Contingut: string
  Tags: string          // paraules clau separades per comes
  Links: string         // JSON: ArticleLink[]
  Autor: string         // email de qui l'ha creat
  Creat_el: string      // ISO date YYYY-MM-DD
  Actualitzat_el: string
  Publicat: string      // 'true' | 'false'
  _rowIndex: number
}

export type ArticleFormData = {
  Titol: string
  Categoria: string
  Contingut: string
  Tags: string
  Links: ArticleLink[]
  Publicat: boolean
}
