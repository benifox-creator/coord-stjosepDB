import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Link as LinkIcon } from 'lucide-react'
import { useConfigStore } from '../../store/configStore'
import { parseLinks } from './coneixement.utils'
import type { Article, ArticleFormData, ArticleLink } from './types'

const EMPTY_LINK: ArticleLink = { label: '', url: '' }
const MAX_LINKS = 5

interface Props {
  inicial?: Article
  onClose: () => void
  onGuardar: (data: ArticleFormData) => Promise<void>
}

export function ConeixementForm({ inicial, onClose, onGuardar }: Props) {
  const categories = useConfigStore((s) => s.getValues('coneixement.categories'))

  const [titol, setTitol] = useState(inicial?.Titol ?? '')
  const [categoria, setCategoria] = useState(inicial?.Categoria ?? '')
  const [contingut, setContingut] = useState(inicial?.Contingut ?? '')
  const [tags, setTags] = useState(inicial?.Tags ?? '')
  const [links, setLinks] = useState<ArticleLink[]>(() => {
    const parsed = inicial ? parseLinks(inicial.Links) : []
    return parsed.length > 0 ? parsed : []
  })
  const [publicat, setPublicat] = useState(inicial ? inicial.Publicat === 'true' : false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function addLink() {
    if (links.length < MAX_LINKS) setLinks((l) => [...l, { ...EMPTY_LINK }])
  }

  function updateLink(i: number, field: keyof ArticleLink, value: string) {
    setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleGuardar() {
    if (!titol.trim()) { setError('El títol és obligatori.'); return }
    if (!categoria) { setError('Selecciona una categoria.'); return }

    setSaving(true)
    setError(null)
    try {
      await onGuardar({
        Titol: titol.trim(),
        Categoria: categoria,
        Contingut: contingut.trim(),
        Tags: tags.trim(),
        Links: links,
        Publicat: publicat,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en desar.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-text-main">
            {inicial ? 'Editar article' : 'Nou article'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Títol */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Títol <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titol}
              onChange={(e) => setTitol(e.target.value)}
              placeholder="Títol de l'article..."
              className="input w-full"
              autoFocus
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="input w-full"
            >
              <option value="">Selecciona una categoria...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

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

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Paraules clau
              <span className="font-normal text-gray-400 ml-1">(separades per comes)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="xarxa, wifi, impressora, manualment..."
              className="input w-full"
            />
          </div>

          {/* Links */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Enllaços externs
              <span className="font-normal text-gray-400 ml-1">(màx. {MAX_LINKS})</span>
            </label>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-gray-300 shrink-0" />
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(i, 'label', e.target.value)}
                    placeholder="Etiqueta (ex: Manual PDF)"
                    className="input text-sm flex-1"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="input text-sm flex-[2]"
                  />
                  <button
                    onClick={() => removeLink(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {links.length < MAX_LINKS && (
                <button
                  onClick={addLink}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Plus size={13} /> Afegir enllaç
                </button>
              )}
            </div>
          </div>

          {/* Publicat toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-medium text-text-main">Publicat</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {publicat
                  ? 'Visible per a tots els usuaris'
                  : 'Esborrany — només el veus tu'}
              </p>
            </div>
            <button
              onClick={() => setPublicat((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${publicat ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${publicat ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 shrink-0">
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-40"
            >
              Cancel·lar
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#861414' }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {inicial ? 'Desar canvis' : 'Crear article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
