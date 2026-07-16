import { useState, useMemo } from 'react'
import { BookOpen, Plus, Search, RefreshCw, Tag, ExternalLink, EyeOff } from 'lucide-react'
import type { Article } from './types'
import { parseTags, parseLinks } from './coneixement.utils'

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-3 bg-gray-100 rounded w-5/6" />
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
      </div>
    </div>
  )
}

function ArticleCard({
  article,
  onClick,
  esCoordinador,
}: {
  article: Article
  onClick: () => void
  esCoordinador: boolean
}) {
  const tags = parseTags(article.Tags)
  const links = parseLinks(article.Links)
  const esBorrany = article.Publicat !== 'true'

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-primary/30 hover:shadow-sm transition-all group flex flex-col gap-3"
    >
      {/* Capçalera */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors leading-snug">
            {article.Titol}
          </p>
          <p className="text-xs text-gray-400 mt-1">{article.Categoria}</p>
        </div>
        {esCoordinador && esBorrany && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
            <EyeOff size={10} /> Esborrany
          </span>
        )}
      </div>

      {/* Resum contingut */}
      {article.Contingut && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
          {article.Contingut}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              <Tag size={9} />
              {tag}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-xs text-gray-400">+{tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Peu */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <p className="text-xs text-gray-400">{article.Creat_el}</p>
        {links.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <ExternalLink size={11} />
            {links.length} {links.length === 1 ? 'enllaç' : 'enllaços'}
          </span>
        )}
      </div>
    </button>
  )
}

interface Props {
  articles: Article[]
  loading: boolean
  error: string | null
  esCoordinador: boolean
  onNou: () => void
  onVeureDetall: (article: Article) => void
  onRefresh: () => void
}

export function ConeixementPage({
  articles,
  loading,
  error,
  esCoordinador,
  onNou,
  onVeureDetall,
  onRefresh,
}: Props) {
  const [cerca, setCerca] = useState('')
  const [filtreCategoria, setFiltreCategoria] = useState('')

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.Categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [articles])

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return articles.filter((a) => {
      if (filtreCategoria && a.Categoria !== filtreCategoria) return false
      if (q) {
        const h = `${a.Titol} ${a.Tags} ${a.Contingut}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [articles, filtreCategoria, cerca])

  const stats = useMemo(() => ({
    total: articles.length,
    publicats: articles.filter((a) => a.Publicat === 'true').length,
    esborranys: articles.filter((a) => a.Publicat !== 'true').length,
  }), [articles])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Base de Coneixement</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${filtrats.length} de ${stats.total} articles`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              title="Actualitzar"
              className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            {esCoordinador && (
              <button
                onClick={onNou}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={16} />
                Nou article
              </button>
            )}
          </div>
        </div>

        {/* KPIs coordinador */}
        {esCoordinador && (
          <div className="flex gap-5 mb-4">
            {[
              { label: 'Total', val: stats.total, color: '#861414' },
              { label: 'Publicats', val: stats.publicats, color: '#15803d' },
              { label: 'Esborranys', val: stats.esborranys, color: '#d97706' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xl font-bold" style={{ color }}>{val}</span>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cercar per títol o paraules clau..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filtreCategoria}
              onChange={(e) => setFiltreCategoria(e.target.value)}
              className="input text-sm w-48"
            >
              <option value="">Totes les categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {(cerca || filtreCategoria) && (
            <button
              onClick={() => { setCerca(''); setFiltreCategoria('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Netejar filtres
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Graella d'articles */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtrats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen size={36} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              {articles.length === 0
                ? 'Encara no hi ha articles a la base de coneixement.'
                : 'Cap article coincideix amb la cerca.'}
            </p>
            {esCoordinador && articles.length === 0 && (
              <button
                onClick={onNou}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                Crear el primer article
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrats.map((a) => (
              <ArticleCard
                key={a.ID}
                article={a}
                onClick={() => onVeureDetall(a)}
                esCoordinador={esCoordinador}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
