import { useMemo, useState } from 'react'
import {
  BookOpen, Plus, Search, RefreshCw, Tag, ExternalLink, EyeOff, Eye,
  Loader2, AlertTriangle, HelpCircle, Wrench, FileText, Archive,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Article } from './types'
import type { TipusArticle } from './articles'
import { agrupaPerTipus, cerca, filtraPerCategoria, aLlista } from './articles'
import { parseTags, parseLinks, formatDateISO } from './coneixement.utils'

const TIPUS_FILTRE_OPCIONS: { valor: TipusArticle; etiqueta: string }[] = [
  { valor: 'avis', etiqueta: 'Avisos' },
  { valor: 'pregunta', etiqueta: 'Preguntes' },
  { valor: 'procediment', etiqueta: 'Procediments' },
  { valor: 'document', etiqueta: 'Documents' },
]

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

/** Etiqueta d'esborrany: la veu tothom qui l'article. El botó, no. */
function BadgeEsborrany() {
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
      <EyeOff size={10} /> Esborrany
    </span>
  )
}

/** Publica / Retira: només qui pot publicar el veu. */
function BotoPublicar({
  esBorrany,
  publicant,
  onClick,
}: {
  esBorrany: boolean
  publicant: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={publicant}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 shrink-0 ${
        esBorrany
          ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
          : 'border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {publicant
        ? <Loader2 size={12} className="animate-spin" />
        : esBorrany ? <Eye size={12} /> : <EyeOff size={12} />
      }
      {esBorrany ? 'Publica' : 'Retira'}
    </button>
  )
}

function ArticleCard({
  article,
  onClick,
  potPublicar,
  publicant,
  onPublica,
  destacat,
}: {
  article: Article
  onClick: () => void
  potPublicar: boolean
  publicant: boolean
  onPublica: () => void
  /** Els avisos porten un accent visual perquè no passin desapercebuts. */
  destacat?: boolean
}) {
  const tags = parseTags(article.Tags)
  const links = parseLinks(article.Links)
  const esBorrany = article.Publicat !== 'true'

  return (
    <div
      className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-all group flex flex-col gap-3 ${
        destacat ? 'border-amber-200 border-l-4 border-l-amber-400' : 'border-gray-200 hover:border-primary/30'
      }`}
    >
      <button onClick={onClick} className="text-left w-full flex flex-col gap-3">
        {/* Capçalera */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors leading-snug">
              {article.Titol}
            </p>
            <p className="text-xs text-gray-500 mt-1">{article.Categoria}</p>
          </div>
          {esBorrany && <BadgeEsborrany />}
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
              <span className="text-xs text-gray-500">+{tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Peu */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-500">{article.Creat_el}</p>
          {links.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <ExternalLink size={11} />
              {links.length} {links.length === 1 ? 'enllaç' : 'enllaços'}
            </span>
          )}
        </div>
      </button>

      {potPublicar && (
        <div className="flex justify-end">
          <BotoPublicar esBorrany={esBorrany} publicant={publicant} onClick={onPublica} />
        </div>
      )}
    </div>
  )
}

/** Una fila desplegable: el format que es llegeix quan n'hi ha moltes, a
 * diferència de la targeta, pensada per a poques. */
function ArticleDesplegable({
  article,
  onVeureDetall,
  potPublicar,
  publicant,
  onPublica,
}: {
  article: Article
  onVeureDetall: () => void
  potPublicar: boolean
  publicant: boolean
  onPublica: () => void
}) {
  const tags = parseTags(article.Tags)
  const links = parseLinks(article.Links)
  const esBorrany = article.Publicat !== 'true'

  return (
    <details className="group bg-white border border-gray-200 rounded-xl px-4 py-3 open:pb-4">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-text-main truncate">{article.Titol}</span>
          {esBorrany && <BadgeEsborrany />}
        </span>
        <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none shrink-0">+</span>
      </summary>

      <div className="mt-3 space-y-3">
        {article.Contingut ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{article.Contingut}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">Sense contingut.</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                <Tag size={9} /> {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button onClick={onVeureDetall} className="text-xs font-medium text-primary hover:underline">
            Veure la fitxa completa
          </button>
          <div className="flex items-center gap-3">
            {links.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <ExternalLink size={11} />
                {links.length} {links.length === 1 ? 'enllaç' : 'enllaços'}
              </span>
            )}
            {potPublicar && (
              <BotoPublicar esBorrany={esBorrany} publicant={publicant} onClick={onPublica} />
            )}
          </div>
        </div>
      </div>
    </details>
  )
}

function CapcaleraSeccio({ icon: Icon, titol, total }: { icon: LucideIcon; titol: string; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-primary" />
      <h2 className="text-sm font-semibold text-text-main">{titol}</h2>
      <span className="text-xs text-gray-500">({total})</span>
    </div>
  )
}

interface Props {
  articles: Article[]
  loading: boolean
  error: string | null
  /** Crea, edita i veu els esborranys: rol coordinador o casella marcada. */
  potRedactar: boolean
  /** Publica, retira i esborra un article publicat: només el coordinador. */
  potPublicar: boolean
  onNou: () => void
  onVeureDetall: (article: Article) => void
  onRefresh: () => void
  publica: (id: string, publicat: boolean) => Promise<void>
}

export function ConeixementPage({
  articles,
  loading,
  error,
  potRedactar,
  potPublicar,
  onNou,
  onVeureDetall,
  onRefresh,
  publica,
}: Props) {
  const [textCerca, setTextCerca] = useState('')
  const [filtreTipus, setFiltreTipus] = useState<TipusArticle | ''>('')
  const [filtreCategoria, setFiltreCategoria] = useState('')
  const [publicantId, setPublicantId] = useState<string | null>(null)

  const avui = useMemo(() => formatDateISO(new Date()), [])

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.Categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [articles])

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a] as const)), [articles])
  const llistes = useMemo(() => articles.map(aLlista), [articles])
  const trobatsPerText = useMemo(() => cerca(llistes, textCerca), [llistes, textCerca])
  const trobats = useMemo(
    () => filtraPerCategoria(trobatsPerText, filtreCategoria),
    [trobatsPerText, filtreCategoria],
  )
  const grups = useMemo(() => agrupaPerTipus(trobats, avui), [trobats, avui])

  const stats = useMemo(() => ({
    total: articles.length,
    publicats: articles.filter((a) => a.Publicat === 'true').length,
    esborranys: articles.filter((a) => a.Publicat !== 'true').length,
  }), [articles])

  async function handlePublica(article: Article) {
    const publicarA = article.Publicat !== 'true'
    setPublicantId(article.id)
    try {
      await publica(article.id, publicarA)
    } finally {
      setPublicantId(null)
    }
  }

  const mostraAvisos = filtreTipus === '' || filtreTipus === 'avis'
  const mostraPreguntes = filtreTipus === '' || filtreTipus === 'pregunta'
  const mostraProcediments = filtreTipus === '' || filtreTipus === 'procediment'
  const mostraDocuments = filtreTipus === '' || filtreTipus === 'document'

  const totalVisible =
    (mostraAvisos ? grups.avisos.length : 0) +
    (mostraPreguntes ? grups.preguntes.length : 0) +
    (mostraProcediments ? grups.procediments.length : 0) +
    (mostraDocuments ? grups.documents.length : 0)

  const capRes = totalVisible === 0 && !(mostraAvisos && grups.caducats.length > 0)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Base de Coneixement</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading ? 'Carregant...' : `${trobats.length} de ${stats.total} articles`}
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
            {potRedactar && (
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

        {/* KPIs: només qui veu els esborranys en treu res, la resta ja només veu publicats */}
        {potRedactar && (
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
              value={textCerca}
              onChange={(e) => setTextCerca(e.target.value)}
              placeholder="Cercar per títol, contingut o paraules clau..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <select
            value={filtreTipus}
            onChange={(e) => setFiltreTipus(e.target.value as TipusArticle | '')}
            className="input text-sm w-48"
          >
            <option value="">Tots els tipus</option>
            {TIPUS_FILTRE_OPCIONS.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          {categories.length > 0 && (
            <select
              value={filtreCategoria}
              onChange={(e) => setFiltreCategoria(e.target.value)}
              className="input text-sm w-48"
            >
              <option value="">Totes les categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {(textCerca || filtreTipus || filtreCategoria) && (
            <button
              onClick={() => { setTextCerca(''); setFiltreTipus(''); setFiltreCategoria('') }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
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

      {/* Contingut agrupat */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : capRes ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen size={36} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">
              {articles.length === 0
                ? 'Encara no hi ha articles a la base de coneixement.'
                : 'Cap article coincideix amb la cerca.'}
            </p>
            {potRedactar && articles.length === 0 && (
              <button
                onClick={onNou}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                Crear el primer article
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {mostraAvisos && grups.avisos.length > 0 && (
              <section>
                <CapcaleraSeccio icon={AlertTriangle} titol="Avisos" total={grups.avisos.length} />
                <div className="space-y-3">
                  {grups.avisos.map((al) => {
                    const original = byId.get(al.id)
                    if (!original) return null
                    return (
                      <ArticleCard
                        key={al.id}
                        article={original}
                        destacat
                        onClick={() => onVeureDetall(original)}
                        potPublicar={potPublicar}
                        publicant={publicantId === original.id}
                        onPublica={() => handlePublica(original)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {mostraPreguntes && grups.preguntes.length > 0 && (
              <section>
                <CapcaleraSeccio icon={HelpCircle} titol="Preguntes" total={grups.preguntes.length} />
                <div className="space-y-2">
                  {grups.preguntes.map((al) => {
                    const original = byId.get(al.id)
                    if (!original) return null
                    return (
                      <ArticleDesplegable
                        key={al.id}
                        article={original}
                        onVeureDetall={() => onVeureDetall(original)}
                        potPublicar={potPublicar}
                        publicant={publicantId === original.id}
                        onPublica={() => handlePublica(original)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {mostraProcediments && grups.procediments.length > 0 && (
              <section>
                <CapcaleraSeccio icon={Wrench} titol="Procediments" total={grups.procediments.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grups.procediments.map((al) => {
                    const original = byId.get(al.id)
                    if (!original) return null
                    return (
                      <ArticleCard
                        key={al.id}
                        article={original}
                        onClick={() => onVeureDetall(original)}
                        potPublicar={potPublicar}
                        publicant={publicantId === original.id}
                        onPublica={() => handlePublica(original)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {mostraDocuments && grups.documents.length > 0 && (
              <section>
                <CapcaleraSeccio icon={FileText} titol="Documents" total={grups.documents.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grups.documents.map((al) => {
                    const original = byId.get(al.id)
                    if (!original) return null
                    return (
                      <ArticleCard
                        key={al.id}
                        article={original}
                        onClick={() => onVeureDetall(original)}
                        potPublicar={potPublicar}
                        publicant={publicantId === original.id}
                        onPublica={() => handlePublica(original)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {mostraAvisos && grups.caducats.length > 0 && (
              <details className="group bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 open:pb-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Archive size={14} />
                    {grups.caducats.length} {grups.caducats.length === 1 ? 'avís caducat' : 'avisos caducats'}
                  </span>
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {grups.caducats.map((al) => {
                    const original = byId.get(al.id)
                    if (!original) return null
                    return (
                      <ArticleDesplegable
                        key={al.id}
                        article={original}
                        onVeureDetall={() => onVeureDetall(original)}
                        potPublicar={potPublicar}
                        publicant={publicantId === original.id}
                        onPublica={() => handlePublica(original)}
                      />
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
