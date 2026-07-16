import { useState } from 'react'
import {
  X, Pencil, Trash2, ExternalLink, Tag, Calendar,
  User, Eye, EyeOff, Loader2,
} from 'lucide-react'
import type { Article } from './types'
import { parseTags, parseLinks } from './coneixement.utils'

interface Props {
  article: Article
  esCoordinador: boolean
  onClose: () => void
  onEditar: () => void
  onTogglePublicat: (article: Article) => Promise<void>
  onEliminar: (article: Article) => Promise<void>
}

export function ConeixementDetall({ article, esCoordinador, onClose, onEditar, onTogglePublicat, onEliminar }: Props) {
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminant, setEliminant] = useState(false)
  const [toggling, setToggling] = useState(false)

  const tags = parseTags(article.Tags)
  const links = parseLinks(article.Links)
  const esBorrany = article.Publicat !== 'true'

  async function handleTogglePublicat() {
    setToggling(true)
    try {
      await onTogglePublicat(article)
    } finally {
      setToggling(false)
    }
  }

  async function handleEliminar() {
    setEliminant(true)
    try {
      await onEliminar(article)
      onClose()
    } catch {
      setEliminant(false)
      setConfirmEliminar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel lateral */}
      <div className="relative z-10 w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-primary">{article.ID}</span>
              {esCoordinador && esBorrany && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <EyeOff size={10} /> Esborrany
                </span>
              )}
              {!esBorrany && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <Eye size={10} /> Publicat
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-text-main leading-snug">{article.Titol}</h2>
            <p className="text-xs text-gray-400 mt-1">{article.Categoria}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <User size={12} /> {article.Autor || '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={12} /> Creat: {article.Creat_el}
            </span>
            {article.Actualitzat_el && article.Actualitzat_el !== article.Creat_el && (
              <span className="flex items-center gap-1.5">
                <Calendar size={12} /> Actualitzat: {article.Actualitzat_el}
              </span>
            )}
          </div>

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

          {/* Links */}
          {links.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recursos i enllaços</p>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                  >
                    <ExternalLink size={14} className="text-primary shrink-0 group-hover:text-primary" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary flex-1 truncate">
                      {link.label || link.url}
                    </span>
                    <span className="text-xs text-gray-400 truncate max-w-40 hidden sm:block">
                      {link.url}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paraules clau</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200"
                  >
                    <Tag size={10} /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer coordinador */}
        {esCoordinador && (
          <div className="border-t border-gray-200 px-6 py-4 shrink-0">
            {confirmEliminar ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs text-red-700 font-medium">Eliminar aquest article permanentment?</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmEliminar(false)}
                    disabled={eliminant}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancel·lar
                  </button>
                  <button
                    onClick={handleEliminar}
                    disabled={eliminant}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
                  >
                    {eliminant && <Loader2 size={12} className="animate-spin" />}
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setConfirmEliminar(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePublicat}
                    disabled={toggling}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
                      esBorrany
                        ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                        : 'border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {toggling
                      ? <Loader2 size={12} className="animate-spin" />
                      : esBorrany ? <Eye size={13} /> : <EyeOff size={13} />
                    }
                    {esBorrany ? 'Publicar' : 'Tornar a esborrany'}
                  </button>
                  <button
                    onClick={onEditar}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#861414' }}
                  >
                    <Pencil size={14} /> Editar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
