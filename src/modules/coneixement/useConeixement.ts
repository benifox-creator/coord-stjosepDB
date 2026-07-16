import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import { useAuthStore } from '../../store/authStore'
import {
  SHEET, HEADERS, ensureHeaders, generateId, formatDateISO,
  serializeLinks,
} from './coneixement.utils'
import type { Article, ArticleFormData } from './types'

// Google Sheets amb USER_ENTERED pot convertir "true" a booleà TRUE,
// que torna com "TRUE" en llegir-lo. Normalitzem a minúscules per comparar.
function normalitzaPublicat(v: string | undefined): string {
  const s = (v ?? '').toLowerCase().trim()
  return s === 'true' ? 'true' : 'false'
}

function rowToArticle(row: Record<string, string>, index: number): Article {
  return {
    ID: row['ID'] ?? '',
    Titol: row['Titol'] ?? '',
    Categoria: row['Categoria'] ?? '',
    Contingut: row['Contingut'] ?? '',
    Tags: row['Tags'] ?? '',
    Links: row['Links'] ?? '',
    Autor: row['Autor'] ?? '',
    Creat_el: row['Creat_el'] ?? '',
    Actualitzat_el: row['Actualitzat_el'] ?? '',
    Publicat: normalitzaPublicat(row['Publicat']),
    _rowIndex: index,
  }
}

function articleToRow(a: Article): Record<string, string> {
  return HEADERS.reduce((acc, h) => {
    acc[h] = a[h as keyof Omit<Article, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
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
      await ensureHeaders()
      const rows = await getRows(SHEET)
      const tots = rows.map((r, i) => rowToArticle(r, i))
      // Coordinador veu tots; la resta només els publicats
      setArticles(esCoordinador ? tots : tots.filter((a) => a.Publicat === 'true'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [esCoordinador])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ArticleFormData): Promise<void> {
    const existingIds = articles.map((a) => a.ID)
    const avui = formatDateISO(new Date())
    const nou: Article = {
      ID: generateId(existingIds),
      Titol: data.Titol,
      Categoria: data.Categoria,
      Contingut: data.Contingut,
      Tags: data.Tags,
      Links: serializeLinks(data.Links),
      Autor: user?.email ?? '',
      Creat_el: avui,
      Actualitzat_el: avui,
      Publicat: data.Publicat ? 'true' : 'false',
      _rowIndex: -1,
    }
    await appendRow(SHEET, articleToRow(nou))
    await fetchData()
  }

  async function editar(article: Article, data: ArticleFormData): Promise<void> {
    const updated: Article = {
      ...article,
      Titol: data.Titol,
      Categoria: data.Categoria,
      Contingut: data.Contingut,
      Tags: data.Tags,
      Links: serializeLinks(data.Links),
      Publicat: data.Publicat ? 'true' : 'false',
      Actualitzat_el: formatDateISO(new Date()),
    }
    await updateRow(SHEET, article._rowIndex, articleToRow(updated))
    await fetchData()
  }

  async function togglePublicat(article: Article): Promise<void> {
    const updated: Article = {
      ...article,
      Publicat: article.Publicat === 'true' ? 'false' : 'true',
      Actualitzat_el: formatDateISO(new Date()),
    }
    await updateRow(SHEET, article._rowIndex, articleToRow(updated))
    await fetchData()
  }

  async function eliminar(article: Article): Promise<void> {
    await deleteRow(SHEET, article._rowIndex)
    await fetchData()
  }

  return { articles, loading, error, crear, editar, togglePublicat, eliminar, refetch: fetchData }
}
