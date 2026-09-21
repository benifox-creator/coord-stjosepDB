import { useState, useEffect } from 'react'
import { Settings, Plus, X, Loader2, AlertCircle, RotateCcw, Users, ChevronDown, Eye, Mail, Upload } from 'lucide-react'
import { useConfigStore, CONFIG_DEFAULTS, MODULS_VISIBILITAT, ROLS_VISIBILITAT, ROL_VIS_LABELS } from '../../store/configStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { ROLS, ROL_LABELS, ROL_COLORS, ROL_DESCRIPCIONS, ETAPES_USUARI } from '../usuaris/types'
import type { Usuari, Rol, EtapaSubstitucio } from '../usuaris/types'
import { ETAPA_FRANJA_KEY, ETAPES_SUBSTITUCIO } from '../substitucions/types'
import { ImportarUsuarisModal, type ResultatImportacio } from '../usuaris/ImportarUsuarisModal'
import type { DadesUsuariImportat } from '../usuaris/excelImport.utils'
import { potGestionar, potVeureCostos } from '../excursions/permisos'

interface LlistaConfig {
  clau: string
  label: string
  descripcio: string
}

interface GrupConfig {
  modul: string
  color: string
  llistes: LlistaConfig[]
}

const GRUPS: GrupConfig[] = [
  {
    modul: 'Calendari del centre', color: '#861414',
    llistes: [{ clau: 'centre.dies-no-lectius', label: 'Dies no lectius', descripcio: 'Una data per entrada, en format AAAA-MM-DD. Aquests dies no generen períodes d’absència des de l’horari.' }],
  },
  {
    modul: 'Reserves',
    color: '#0c71c3',
    llistes: [
      { clau: 'reserves.espais', label: 'Espais disponibles', descripcio: 'Espais que apareixen al desplegable del formulari de nova reserva.' },
    ],
  },
  {
    modul: 'Material i Stock',
    color: '#7c3aed',
    llistes: [
      { clau: 'material.categories', label: 'Categories de material', descripcio: 'Categories del catàleg de material fungible i accessoris.' },
    ],
  },
  {
    modul: 'Inventari',
    color: '#15803d',
    llistes: [
      { clau: 'inventari.categories', label: 'Categories de dispositius', descripcio: 'Tipus de dispositius que es poden registrar a l\'inventari.' },
    ],
  },
  {
    modul: 'Incidències',
    color: '#861414',
    llistes: [
      { clau: 'incidencies.tipus', label: 'Tipus de problema', descripcio: 'Classificació del tipus d\'incidència. "Altre" sempre és disponible.' },
      { clau: 'incidencies.localitzacions', label: 'Localitzacions', descripcio: 'Suggeriments de localització al formulari d\'incidència.' },
    ],
  },
  {
    modul: 'Base de Coneixement',
    color: '#0891b2',
    llistes: [
      { clau: 'coneixement.categories', label: 'Categories d\'articles', descripcio: 'Temàtiques que apareixen al desplegable del formulari de nou article.' },
    ],
  },
  {
    modul: 'Absències',
    color: '#b45309',
    llistes: [
      { clau: 'absencies.motius', label: "Motius d'absència", descripcio: "Motius disponibles al formulari de reportar una absència. \"Altre\" sempre és disponible." },
    ],
  },
  {
    modul: 'Material Infantil',
    color: '#059669',
    llistes: [
      { clau: 'material-infantil.categories', label: 'Categories de material', descripcio: 'Categories del catàleg de material fungible d\'Infantil.' },
    ],
  },
  {
    modul: 'Grups del centre',
    color: '#0891b2',
    llistes: [
      { clau: 'substitucions.grups', label: 'Grups', descripcio: 'Les classes del centre, una per entrada. Es fan servir per dir quins grups van a cada excursió. Fins ara aquesta llista no es podia editar des d\'aquí.' },
    ],
  },
  {
    modul: 'Horaris',
    color: '#861414',
    llistes: [
      { clau: 'horaris.tipus-no-lectiva', label: 'Tipus de no lectiva', descripcio: 'Opcions disponibles en marcar un període de l\'horari com a no lectiu (guàrdies, pati, tutoria...).' },
      ...ETAPES_USUARI.map((etapa) => ({
        clau: ETAPA_FRANJA_KEY[etapa],
        label: `Franges — ${etapa}`,
        descripcio: `Files de la graella d'horari de ${etapa}, en format H:MM-H:MM. El pati també és una franja: qui el té el marca com a "No lectiva → Pati". Canviar aquesta llista no toca els horaris ja desats; els períodes amb una franja que ja no hi és continuen sortint a la graella.`,
      })),
    ],
  },
]

function LlistaEditor({ llista }: { llista: LlistaConfig }) {
  const savedValues = useConfigStore((s) => s.config[llista.clau])
  const update = useConfigStore((s) => s.update)
  const valors = savedValues ?? CONFIG_DEFAULTS[llista.clau] ?? []

  const [nouValor, setNouValor] = useState('')
  const [afegint, setAfegint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isProtegit = (v: string) =>
    llista.clau === 'incidencies.tipus' && v === 'Altre'

  async function handleAfegir() {
    const trimmed = nouValor.trim()
    if (!trimmed) return
    if (llista.clau === 'centre.dies-no-lectius' && (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(new Date(trimmed).getTime()) || new Date(trimmed).toISOString().slice(0, 10) !== trimmed)) {
      setError('Introdueix una data vàlida en format AAAA-MM-DD.'); return
    }
    if (valors.includes(trimmed)) {
      setError('Aquesta opció ja existeix.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await update(llista.clau, [...valors, trimmed])
      setNouValor('')
      setAfegint(false)
    } catch {
      setError('Error en desar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(valor: string) {
    if (isProtegit(valor)) return
    setSaving(true)
    setError(null)
    try {
      await update(llista.clau, valors.filter((v) => v !== valor))
    } catch {
      setError('Error en desar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    setError(null)
    try {
      await update(llista.clau, CONFIG_DEFAULTS[llista.clau] ?? [])
    } catch {
      setError('Error en desar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-sm font-semibold text-text-main">{llista.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{llista.descripcio}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {saving && <Loader2 size={14} className="animate-spin text-gray-400" />}
          <button
            onClick={handleReset}
            disabled={saving}
            title="Restaurar valors per defecte"
            className="text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1 mb-2">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5 mt-3 mb-2">
        {valors.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200"
          >
            {v}
            {!isProtegit(v) && (
              <button
                onClick={() => handleEliminar(v)}
                disabled={saving}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 ml-0.5"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Afegir */}
      {afegint ? (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={nouValor}
            onChange={(e) => { setNouValor(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAfegir(); if (e.key === 'Escape') { setAfegint(false); setNouValor('') } }}
            placeholder="Nova opció..."
            className="input text-sm flex-1"
            autoFocus
          />
          <button
            onClick={handleAfegir}
            disabled={saving || !nouValor.trim()}
            className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#861414' }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : 'Afegir'}
          </button>
          <button onClick={() => { setAfegint(false); setNouValor('') }} className="text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAfegint(true)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1"
        >
          <Plus size={13} /> Afegir opció
        </button>
      )}
    </div>
  )
}

function RolBadge({ rol }: { rol: Rol }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROL_COLORS[rol]}`}>
      {ROL_LABELS[rol]}
    </span>
  )
}

function UsuariRow({ usuari, esJoMateix }: { usuari: Usuari; esJoMateix: boolean }) {
  const updateRol = useUsuarisStore((s) => s.updateRol)
  const updateEtapa = useUsuarisStore((s) => s.updateEtapa)
  const updatePotGestionarMaterial = useUsuarisStore((s) => s.updatePotGestionarMaterial)
  const updatePotGestionarExcursions = useUsuarisStore((s) => s.updatePotGestionarExcursions)
  const updatePotGestionarCostosExcursions = useUsuarisStore((s) => s.updatePotGestionarCostosExcursions)
  const [savingPotGestionar, setSavingPotGestionar] = useState(false)
  const [savingExcursions, setSavingExcursions] = useState(false)
  const [obert, setObert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEtapa, setSavingEtapa] = useState(false)
  useEffect(() => {
    if (!obert) return
    function handler(e: MouseEvent) {
      const el = document.getElementById(`rol-dropdown-${usuari.Email}`)
      if (el && !el.contains(e.target as Node)) setObert(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [obert, usuari.Email])

  async function handleCanviarRol(nouRol: Rol) {
    if (nouRol === usuari.Rol) { setObert(false); return }
    setSaving(true)
    try {
      await updateRol(usuari, nouRol)
    } finally {
      setSaving(false)
      setObert(false)
    }
  }

  async function handleCanviarEtapa(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as EtapaSubstitucio | ''
    setSavingEtapa(true)
    try {
      await updateEtapa(usuari, v === '' ? null : v)
    } finally {
      setSavingEtapa(false)
    }
  }

  async function handleToggleExcursions(quin: 'logistica' | 'costos') {
    setSavingExcursions(true)
    try {
      if (quin === 'logistica') await updatePotGestionarExcursions(usuari, !usuari.PotGestionarExcursions)
      else await updatePotGestionarCostosExcursions(usuari, !usuari.PotGestionarCostosExcursions)
    } finally {
      setSavingExcursions(false)
    }
  }

  async function handleTogglePotGestionarMaterial() {
    setSavingPotGestionar(true)
    try {
      await updatePotGestionarMaterial(usuari, !usuari.PotGestionarMaterial)
    } finally {
      setSavingPotGestionar(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-semibold text-gray-600">
        {(usuari.Nom || usuari.Email).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-main truncate">
          {usuari.Nom || '—'}
          {esJoMateix && <span className="ml-1.5 text-xs text-gray-400">(tu)</span>}
        </p>
        <p className="text-xs text-gray-400 truncate">{usuari.Email}</p>
      </div>
      <label
        className="shrink-0 flex items-center gap-1 text-[11px] text-gray-500"
        title="Pot gestionar el mòdul Material Infantil"
      >
        <input
          type="checkbox"
          checked={usuari.PotGestionarMaterial}
          onChange={handleTogglePotGestionarMaterial}
          disabled={savingPotGestionar}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Material
      </label>
      <label
        className="shrink-0 flex items-center gap-1 text-[11px] text-gray-500"
        title="Pot organitzar excursions: reservar, circular i cancel·lar. No veu cap cost."
      >
        <input
          type="checkbox"
          checked={usuari.PotGestionarExcursions}
          onChange={() => handleToggleExcursions('logistica')}
          disabled={savingExcursions}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Excursions
      </label>
      <label
        className="shrink-0 flex items-center gap-1 text-[11px] text-gray-500"
        title="Pot veure i editar els costos i el preu de les excursions"
      >
        <input
          type="checkbox"
          checked={usuari.PotGestionarCostosExcursions}
          onChange={() => handleToggleExcursions('costos')}
          disabled={savingExcursions}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Costos
      </label>
      <select
        value={usuari.Etapa ?? ''}
        onChange={handleCanviarEtapa}
        disabled={savingEtapa}
        title="Etapa"
        className="shrink-0 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 disabled:opacity-60"
      >
        <option value="">Sense etapa</option>
        {ETAPES_USUARI.map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      <div id={`rol-dropdown-${usuari.Email}`} className="relative shrink-0">
        <button
          onClick={() => setObert((o) => !o)}
          disabled={saving || esJoMateix}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:cursor-default disabled:opacity-70"
        >
          {saving ? <Loader2 size={12} className="animate-spin text-gray-400" /> : <RolBadge rol={usuari.Rol} />}
          {!esJoMateix && <ChevronDown size={12} className={`text-gray-400 transition-transform ${obert ? 'rotate-180' : ''}`} />}
        </button>
        {obert && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[220px] overflow-hidden">
            {ROLS.map((r) => (
              <button
                key={r}
                onClick={() => handleCanviarRol(r)}
                className={`w-full flex flex-col items-start gap-0.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${r === usuari.Rol ? 'bg-gray-50' : ''}`}
              >
                <RolBadge rol={r} />
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{ROL_DESCRIPCIONS[r]}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AfegirUsuariForm() {
  const crear = useUsuarisStore((s) => s.crear)
  const [afegint, setAfegint] = useState(false)
  const [email, setEmail] = useState('')
  const [nom, setNom] = useState('')
  const [rol, setRol] = useState<Rol>('convidat')
  const [etapa, setEtapa] = useState<EtapaSubstitucio | ''>('')
  const [potGestionarMaterial, setPotGestionarMaterial] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function tancar() {
    setAfegint(false)
    setEmail('')
    setNom('')
    setRol('convidat')
    setEtapa('')
    setPotGestionarMaterial(false)
    setError(null)
  }

  async function handleAfegir() {
    const trimmed = email.trim()
    if (!trimmed) { setError("Cal indicar l'email."); return }
    setSaving(true)
    setError(null)
    try {
      await crear(trimmed, nom.trim(), rol, etapa === '' ? null : etapa, potGestionarMaterial)
      tancar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en desar.')
    } finally {
      setSaving(false)
    }
  }

  if (!afegint) {
    return (
      <button
        onClick={() => setAfegint(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus size={13} /> Afegir usuari
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(null) }}
        placeholder="email@stjosep.org"
        className="input text-sm w-full"
        autoFocus
      />
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom (opcional)"
        className="input text-sm w-full"
      />
      <select
        value={rol}
        onChange={(e) => setRol(e.target.value as Rol)}
        className="input text-sm w-full"
      >
        {ROLS.map((r) => (
          <option key={r} value={r}>{ROL_LABELS[r]}</option>
        ))}
      </select>
      <select
        value={etapa}
        onChange={(e) => setEtapa(e.target.value as EtapaSubstitucio | '')}
        className="input text-sm w-full"
      >
        <option value="">Sense etapa</option>
        {ETAPES_USUARI.map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={potGestionarMaterial}
          onChange={(e) => setPotGestionarMaterial(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Pot gestionar Material Infantil
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleAfegir}
          disabled={saving || !email.trim()}
          className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: '#861414' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Afegir'}
        </button>
        <button onClick={tancar} className="text-gray-400 hover:text-gray-600">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

function GestioUsuaris({ emailActual }: { emailActual: string }) {
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const loading = useUsuarisStore((s) => s.loading)
  const error = useUsuarisStore((s) => s.error)
  const loadAll = useUsuarisStore((s) => s.loadAll)
  const crear = useUsuarisStore((s) => s.crear)
  const [important, setImportant] = useState(false)

  useEffect(() => { loadAll() }, [loadAll])

  // Alta seqüencial i no en paral·lel: amb un claustre són poques desenes de
  // files i la velocitat és igual, però així se sap exactament quina ha fallat
  // en lloc de quedar-se amb mitja importació feta i cap pista de quina part.
  async function handleImportar(dades: DadesUsuariImportat[]): Promise<ResultatImportacio> {
    const errors: ResultatImportacio['errors'] = []
    let creats = 0
    for (const u of dades) {
      try {
        await crear(u.Email, u.Nom, u.Rol, u.Etapa, u.PotGestionarMaterial)
        creats++
      } catch (err) {
        errors.push({ correu: u.Email, error: err instanceof Error ? err.message : 'Error desconegut' })
      }
    }
    await loadAll()
    return { creats, errors }
  }

  if (loading && usuaris.length === 0) {
    return <div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 size={14} className="animate-spin" /> Carregant usuaris...</div>
  }

  if (error) {
    return <p className="text-xs text-red-600 py-2">{error}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Afegeix un usuari abans que iniciï sessió per assignar-li el perfil correcte des del primer moment.
        </p>
        <button
          type="button"
          onClick={() => setImportant(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 shrink-0"
        >
          <Upload size={13} /> Importa d’Excel
        </button>
      </div>
      {important && (
        <ImportarUsuarisModal
          usuarisExistents={usuaris}
          onImportar={handleImportar}
          onClose={() => setImportant(false)}
        />
      )}
      <div className="bg-white border border-gray-200 rounded-xl">
        {usuaris.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-4 py-3">Sense usuaris registrats.</p>
        ) : (
          usuaris.map((u) => (
            <UsuariRow key={u.Email} usuari={u} esJoMateix={u.Email.toLowerCase() === emailActual.toLowerCase()} />
          ))
        )}
      </div>
      <AfegirUsuariForm />
    </div>
  )
}

function MantenimentEmailEditor() {
  const savedValues = useConfigStore((s) => s.config['manteniment.email'])
  const update = useConfigStore((s) => s.update)
  const email = savedValues?.[0] ?? ''
  const [valor, setValor] = useState(email)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleDesar() {
    if (!valor.trim()) return
    setSaving(true)
    try {
      await update('manteniment.email', [valor.trim()])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <Mail size={14} className="text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-text-main">Correu del responsable de manteniment</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Quan es reporti un desperfecte s'enviarà una notificació a aquest correu.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          className="input text-sm flex-1"
          value={valor}
          onChange={(e) => { setValor(e.target.value); setSaved(false) }}
          placeholder="manteniment@stjosep.org"
          onKeyDown={(e) => e.key === 'Enter' && handleDesar()}
        />
        <button
          onClick={handleDesar}
          disabled={saving || !valor.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#861414' }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? '✓' : 'Desar'}
        </button>
      </div>
    </div>
  )
}

function FirmaEmailEditor() {
  const savedValues = useConfigStore((s) => s.config['emails.firma'])
  const update = useConfigStore((s) => s.update)
  const firma = savedValues?.[0] ?? 'Administració'
  const [valor, setValor] = useState(firma)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleDesar() {
    if (!valor.trim()) return
    setSaving(true)
    try {
      await update('emails.firma', [valor.trim()])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <Mail size={14} className="text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-text-main">Firma dels correus automàtics</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Nom que apareix al peu dels correus d'absències, substitucions i incidències (ex: "Administració", "Direcció").
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="input text-sm flex-1"
          value={valor}
          onChange={(e) => { setValor(e.target.value); setSaved(false) }}
          placeholder="Administració"
          onKeyDown={(e) => e.key === 'Enter' && handleDesar()}
        />
        <button
          onClick={handleDesar}
          disabled={saving || !valor.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#861414' }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? '✓' : 'Desar'}
        </button>
      </div>
    </div>
  )
}

function VisibilitatModuls() {
  const config = useConfigStore((s) => s.config)
  const update = useConfigStore((s) => s.update)
  const [saving, setSaving] = useState<string | null>(null) // key que s'està desant

  async function handleToggle(visKey: string, rol: string, actiu: boolean) {
    const clau = `visibilitat.${visKey}`
    const actuals = config[clau] ?? CONFIG_DEFAULTS[clau] ?? [...ROLS_VISIBILITAT]
    const nous = actiu
      ? [...actuals.filter((r) => r !== rol), rol]
      : actuals.filter((r) => r !== rol)
    setSaving(`${visKey}-${rol}`)
    try {
      await update(clau, nous)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Capçalera de la taula */}
      <div className="grid border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns: `1fr repeat(${ROLS_VISIBILITAT.length}, 100px)` }}>
        <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mòdul</div>
        {ROLS_VISIBILITAT.map((rol) => (
          <div key={rol} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
            {ROL_VIS_LABELS[rol]}
          </div>
        ))}
      </div>

      {/* Files de mòduls */}
      {MODULS_VISIBILITAT.map(({ key, label }, idx) => {
        const clau = `visibilitat.${key}`
        const actuals = config[clau] ?? CONFIG_DEFAULTS[clau] ?? [...ROLS_VISIBILITAT]
        return (
          <div
            key={key}
            className={`grid items-center border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}
            style={{ gridTemplateColumns: `1fr repeat(${ROLS_VISIBILITAT.length}, 100px)` }}
          >
            <div className="px-4 py-3 text-sm text-text-main font-medium">{label}</div>
            {ROLS_VISIBILITAT.map((rol) => {
              const actiu = actuals.includes(rol)
              const isSaving = saving === `${key}-${rol}`
              return (
                <div key={rol} className="flex items-center justify-center py-3">
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  ) : (
                    <button
                      onClick={() => handleToggle(key, rol, !actiu)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        actiu
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      title={actiu ? `Amagar ${label} a ${ROL_VIS_LABELS[rol]}` : `Mostrar ${label} a ${ROL_VIS_LABELS[rol]}`}
                    >
                      {actiu && (
                        <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Nota coordinador */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          El perfil <strong className="text-gray-600">Coordinador</strong> sempre té accés a tots els mòduls.
        </p>
      </div>
    </div>
  )
}

interface CampPreuConfig { clau: string; label: string; step?: string }

// Un camp de previsió i un de marge per etapa, més els dos globals. Es
// genera a partir d'ETAPES_SUBSTITUCIO perquè si mai canvia el llistat
// d'etapes (poc probable, però ja ha passat amb els grups) aquesta pantalla
// no es quedi desactualitzada en silenci.
const CAMPS_PREU_EXCURSIONS: CampPreuConfig[] = [
  ...ETAPES_SUBSTITUCIO.map((etapa) => ({ clau: `excursions.previsio.${etapa}`, label: `Previsió d'assistència — ${etapa}` })),
  ...ETAPES_SUBSTITUCIO.map((etapa) => ({ clau: `excursions.marge-pct.${etapa}`, label: `Marge de seguretat — ${etapa} (%)` })),
  { clau: 'excursions.iva-pct', label: 'IVA del transport (%)' },
  { clau: 'excursions.arrodoniment', label: "Pas d'arrodoniment del preu (€)" },
]

// Els dos terminis que la circular esmenta en dies (no en diners, per això
// van amb els textos i no amb el preu): quan s'envia i quan tanca el pagament.
const CAMPS_DIES_CIRCULAR: CampPreuConfig[] = [
  { clau: 'excursions.dies-abans-circular', label: "Dies d'antelació per enviar la circular", step: '1' },
  { clau: 'excursions.dies-abans-termini', label: 'Dies de termini per fer el pagament', step: '1' },
]

// Genèric perquè el mateix editor serveix tant per als paràmetres de preu
// (només costos) com pels dies de la circular (qualsevol que gestioni).
function CampsNumericsEditor({ camps }: { camps: CampPreuConfig[] }) {
  const update = useConfigStore((s) => s.update)
  const getValues = useConfigStore((s) => s.getValues)
  const [valors, setValors] = useState<Record<string, string>>(() =>
    Object.fromEntries(camps.map((c) => [c.clau, getValues(c.clau)[0]])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  async function handleDesar(clau: string) {
    setError('')
    setSaving(clau)
    try {
      await update(clau, [valors[clau]])
      setSaved(clau)
      setTimeout(() => setSaved(null), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant la configuració')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {camps.map(({ clau, label, step }) => (
          <div key={clau} className="flex flex-col gap-1.5 bg-white border border-gray-200 rounded-xl p-3">
            <label htmlFor={clau} className="text-xs font-medium text-gray-600">{label}</label>
            <div className="flex gap-2">
              <input
                id={clau}
                type="number"
                step={step ?? '0.01'}
                min={0}
                value={valors[clau]}
                onChange={(e) => setValors((v) => ({ ...v, [clau]: e.target.value }))}
                className="input text-sm flex-1"
              />
              <button
                onClick={() => handleDesar(clau)}
                disabled={saving === clau}
                className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#861414' }}
              >
                {saving === clau ? <Loader2 size={12} className="animate-spin" /> : saved === clau ? '✓' : 'Desar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CampTextConfig { clau: string; label: string; descripcio: string }

// Els textos de la circular: frases fixes que abans estaven escrites al codi
// del generador. Un `textarea` perquè són frases senceres, no valors curts.
const CAMPS_TEXT_CIRCULAR: CampTextConfig[] = [
  { clau: 'excursions.text-pagament-intro', label: 'Introducció del pagament', descripcio: 'Frase que presenta el codi de barres del pagament a la circular.' },
  { clau: 'excursions.text-ampa', label: "Contribució de l'AMPA", descripcio: "Frase que explica la participació de l'AMPA en el finançament, quan n'hi ha." },
  { clau: 'excursions.text-devolucions', label: 'Devolucions per no assistència', descripcio: 'Explica què passa quan un alumne no assisteix i s’avisa fora de termini.' },
  { clau: 'excursions.text-resguard', label: 'Resguard del pagament', descripcio: 'Recorda què cal fer amb el resguard un cop pagat.' },
]

function CampTextLlargEditor({ camp }: { camp: CampTextConfig }) {
  const savedValues = useConfigStore((s) => s.config[camp.clau])
  const update = useConfigStore((s) => s.update)
  const valorPerDefecte = CONFIG_DEFAULTS[camp.clau]?.[0] ?? ''
  const [valor, setValor] = useState(savedValues?.[0] ?? valorPerDefecte)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleDesar() {
    if (!valor.trim()) return
    setSaving(true)
    try {
      await update(camp.clau, [valor.trim()])
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <label htmlFor={camp.clau} className="text-sm font-semibold text-text-main">{camp.label}</label>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">{camp.descripcio}</p>
      <textarea
        id={camp.clau}
        value={valor}
        onChange={(e) => { setValor(e.target.value); setSaved(false) }}
        rows={2}
        className="input text-sm w-full resize-y"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleDesar}
          disabled={saving || !valor.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#861414' }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? '✓' : 'Desar'}
        </button>
      </div>
    </div>
  )
}

const LLISTA_PASSOS_PAGAMENT: LlistaConfig = {
  clau: 'excursions.passos-pagament',
  label: 'Passos del pagament',
  descripcio: 'Cada entrada és un pas de la circular, en l’ordre que ha de seguir la família.',
}

export function ConfiguracioPage() {
  const loaded = useConfigStore((s) => s.loaded)
  const loading = useConfigStore((s) => s.loading)
  const error = useConfigStore((s) => s.error)
  const rolActual = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const emailActual = useAuthStore((s) => s.user?.email ?? '')
  const esCoordinador = rolActual === 'coordinador'
  const jo = usuaris.find((u) => u.Email.toLowerCase() === emailActual.toLowerCase()) ?? null
  const potGestionarExcursions = potGestionar(rolActual, jo)
  const potVeureCostosExcursions = potVeureCostos(rolActual, jo)

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-main">Configuració</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestiona les opcions dels desplegables de cada mòdul</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-8 max-w-2xl">

        {!loaded && loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Carregant configuració...
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {esCoordinador && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-gray-500" />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">Usuaris i permisos</h2>
            </div>
            <GestioUsuaris emailActual={emailActual} />
          </section>
        )}

        {esCoordinador && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-gray-500" />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">Visibilitat de mòduls</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Activa o desactiva quins mòduls pot veure cada perfil. Les caselles marcades indiquen que el mòdul és visible per aquell perfil.
            </p>
            <VisibilitatModuls />
          </section>
        )}

        {esCoordinador && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Mail size={14} className="text-gray-500" />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">Correus automàtics</h2>
            </div>
            <FirmaEmailEditor />
          </section>
        )}

        {esCoordinador && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">Manteniment</h2>
            </div>
            <MantenimentEmailEditor />
          </section>
        )}

        {potGestionarExcursions && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#059669' }} />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">Excursions</h2>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Circular</p>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Terminis i textos fixos de la circular que reben les famílies. No són dades
                  econòmiques: hi té accés tothom qui pot gestionar excursions.
                </p>
                <div className="space-y-3">
                  <CampsNumericsEditor camps={CAMPS_DIES_CIRCULAR} />
                  {CAMPS_TEXT_CIRCULAR.map((camp) => (
                    <CampTextLlargEditor key={camp.clau} camp={camp} />
                  ))}
                  <LlistaEditor llista={LLISTA_PASSOS_PAGAMENT} />
                </div>
              </div>

              {potVeureCostosExcursions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preu</p>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    Paràmetres del càlcul del preu per alumne, per etapa: quants matriculats s'espera
                    que hi vagin i el marge de seguretat, més l'IVA del transport i el pas d'arrodoniment,
                    que són comuns a totes les etapes. Només ho veu qui té accés als costos.
                  </p>
                  <CampsNumericsEditor camps={CAMPS_PREU_EXCURSIONS} />
                </div>
              )}
            </div>
          </section>
        )}

        {GRUPS.map((grup) => (
          <section key={grup.modul}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: grup.color }} />
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wide">{grup.modul}</h2>
            </div>
            <div className="space-y-3">
              {grup.llistes.map((llista) => (
                <LlistaEditor key={llista.clau} llista={llista} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
