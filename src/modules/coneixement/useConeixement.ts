import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById, callRpc } from '../../services/db'
import { serializeLinks } from './coneixement.utils'
import type { TipusArticle } from './articles'
import type { Article, ArticleFormData, ArticleLink } from './types'

const TABLE = 'coneixement'

interface ConeixementRow {
  id: string
  codi: string
  titol: string
  tipus: TipusArticle
  categoria: string
  contingut: string
  tags: string[]
  links: ArticleLink[]
  caduca_el: string | null
  autor: string
  creat_el: string
  actualitzat_el: string
  publicat: boolean
}

function rowToArticle(row: ConeixementRow): Article {
  return {
    id: row.id,
    ID: row.codi,
    Titol: row.titol,
    Tipus: row.tipus,
    Categoria: row.categoria,
    Contingut: row.contingut,
    Tags: (row.tags ?? []).join(', '),
    Links: JSON.stringify(row.links ?? []),
    CaducaEl: row.caduca_el,
    Autor: row.autor,
    Creat_el: row.creat_el,
    Actualitzat_el: row.actualitzat_el,
    Publicat: row.publicat ? 'true' : 'false',
  }
}

function tagsToArray(tags: string): string[] {
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export function useConeixement(potRedactar: boolean) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<ConeixementRow>(TABLE, 'titol')
      const tots = rows.map(rowToArticle)
      // Qui redacta veu tots els esborranys; la resta només els publicats.
      setArticles(potRedactar ? tots : tots.filter((a) => a.Publicat === 'true'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [potRedactar])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ArticleFormData): Promise<void> {
    await insertRow(TABLE, {
      titol: data.Titol,
      tipus: data.Tipus,
      categoria: data.Categoria,
      contingut: data.Contingut,
      tags: tagsToArray(data.Tags),
      links: JSON.parse(serializeLinks(data.Links) || '[]'),
      caduca_el: data.CaducaEl,
    })
    await fetchData()
  }

  async function editar(article: Article, data: ArticleFormData): Promise<void> {
    await updateRowById(TABLE, article.id, {
      titol: data.Titol,
      tipus: data.Tipus,
      categoria: data.Categoria,
      contingut: data.Contingut,
      tags: tagsToArray(data.Tags),
      links: JSON.parse(serializeLinks(data.Links) || '[]'),
      caduca_el: data.CaducaEl,
    })
    await fetchData()
  }

  // `publicat`, `autor`, `creat_el` i `actualitzat_el` ja no es poden escriure
  // des del client (disparador `coneixement_segell`): publicar només passa
  // per aquest RPC.
  const publica = useCallback(async (id: string, publicat: boolean) => {
    await callRpc('publica_article', { p_id: id, p_publicat: publicat })
    await fetchData()
  }, [fetchData])

  async function togglePublicat(article: Article): Promise<void> {
    await publica(article.id, article.Publicat !== 'true')
  }

  async function eliminar(article: Article): Promise<void> {
    await deleteRowById(TABLE, article.id)
    await fetchData()
  }

  return { articles, loading, error, crear, editar, togglePublicat, publica, eliminar, refetch: fetchData }
}
