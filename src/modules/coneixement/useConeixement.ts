import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import { formatDateISO, serializeLinks } from './coneixement.utils'
import type { Article, ArticleFormData, ArticleLink } from './types'

const TABLE = 'coneixement'

interface ConeixementRow {
  id: string
  codi: string
  titol: string
  categoria: string
  contingut: string
  tags: string[]
  links: ArticleLink[]
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
    Categoria: row.categoria,
    Contingut: row.contingut,
    Tags: (row.tags ?? []).join(', '),
    Links: JSON.stringify(row.links ?? []),
    Autor: row.autor,
    Creat_el: row.creat_el,
    Actualitzat_el: row.actualitzat_el,
    Publicat: row.publicat ? 'true' : 'false',
  }
}

function tagsToArray(tags: string): string[] {
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export function useConeixement(esCoordinador: boolean) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const user = useAuthStore((s) => s.user)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<ConeixementRow>(TABLE, 'titol')
      const tots = rows.map(rowToArticle)
      // Coordinador veu tots; la resta només els publicats
      setArticles(esCoordinador ? tots : tots.filter((a) => a.Publicat === 'true'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [esCoordinador])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ArticleFormData): Promise<void> {
    const avui = formatDateISO(new Date())
    await insertRow(TABLE, {
      titol: data.Titol,
      categoria: data.Categoria,
      contingut: data.Contingut,
      tags: tagsToArray(data.Tags),
      links: JSON.parse(serializeLinks(data.Links) || '[]'),
      autor: user?.email ?? '',
      creat_el: avui,
      actualitzat_el: avui,
      publicat: data.Publicat,
    })
    await fetchData()
  }

  async function editar(article: Article, data: ArticleFormData): Promise<void> {
    await updateRowById(TABLE, article.id, {
      titol: data.Titol,
      categoria: data.Categoria,
      contingut: data.Contingut,
      tags: tagsToArray(data.Tags),
      links: JSON.parse(serializeLinks(data.Links) || '[]'),
      publicat: data.Publicat,
      actualitzat_el: formatDateISO(new Date()),
    })
    await fetchData()
  }

  async function togglePublicat(article: Article): Promise<void> {
    await updateRowById(TABLE, article.id, {
      publicat: article.Publicat !== 'true',
      actualitzat_el: formatDateISO(new Date()),
    })
    await fetchData()
  }

  async function eliminar(article: Article): Promise<void> {
    await deleteRowById(TABLE, article.id)
    await fetchData()
  }

  return { articles, loading, error, crear, editar, togglePublicat, eliminar, refetch: fetchData }
}
