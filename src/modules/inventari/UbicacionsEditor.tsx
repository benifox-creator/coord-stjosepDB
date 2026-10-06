import { useState } from 'react'
import { Plus, Trash2, Loader2, Pencil, Check, X } from 'lucide-react'
import { useUbicacions } from './useUbicacions'
import { missatgeErrorUbicacio } from './ubicacions'
import type { Ubicacio } from './ubicacions'

type Dades = Omit<Ubicacio, 'id'>
const BUIT: Dades = { Codi: '', Edifici: '', Planta: '' }
const CAMPS = ['Codi', 'Edifici', 'Planta'] as const
const EXEMPLE: Record<typeof CAMPS[number], string> = { Codi: 'Ex: A21-ESO-2A', Edifici: 'Ex: A-EscC', Planta: 'Ex: PTA1' }

export function UbicacionsEditor() {
  const { ubicacions, loading, error, crear, editar, eliminar } = useUbicacions()
  const [nova, setNova] = useState<Dades>(BUIT)
  const [editantId, setEditantId] = useState<string | null>(null)
  const [esborrany, setEsborrany] = useState<Dades>(BUIT)
  const [ocupat, setOcupat] = useState<string | null>(null)
  const [errorAccio, setErrorAccio] = useState<string | null>(null)
  const enCurs = ocupat !== null

  async function fes(clau: string, accio: () => Promise<void>) {
    setOcupat(clau)
    setErrorAccio(null)
    try {
      await accio()
    } catch (err) {
      setErrorAccio(missatgeErrorUbicacio(err))
    } finally {
      setOcupat(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-text-main">Ubicacions</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-3 leading-relaxed">
        Catàleg d’aules i espais. En triar-ne una per a un dispositiu, l’edifici i la planta surten d’aquí; si en canvies el codi, el canvi arriba a tots els seus dispositius.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" /> Carregant…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-1.5 pr-2 font-medium">Codi</th>
                <th className="py-1.5 pr-2 font-medium">Edifici</th>
                <th className="py-1.5 pr-2 font-medium">Planta</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ubicacions.map((u) => editantId === u.id ? (
                <tr key={u.id}>
                  {CAMPS.map((camp) => (
                    <td key={camp} className="py-1.5 pr-2">
                      <input
                        className="input text-sm w-full"
                        value={esborrany[camp]}
                        aria-label={camp}
                        onChange={(e) => setEsborrany((d) => ({ ...d, [camp]: e.target.value }))}
                      />
                    </td>
                  ))}
                  <td className="py-1.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      aria-label="Desa"
                      disabled={enCurs || !esborrany.Codi.trim()}
                      onClick={() => fes(u.id, async () => { await editar(u, esborrany); setEditantId(null) })}
                      className="p-1 text-green-700 disabled:opacity-40"
                    >
                      {ocupat === u.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button type="button" aria-label="Cancel·la" disabled={enCurs} onClick={() => setEditantId(null)} className="p-1 text-gray-500 disabled:opacity-40">
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={u.id}>
                  <td className="py-1.5 pr-2 font-mono text-xs text-text-main">{u.Codi}</td>
                  <td className="py-1.5 pr-2 text-gray-600">{u.Edifici || '—'}</td>
                  <td className="py-1.5 pr-2 text-gray-600">{u.Planta || '—'}</td>
                  <td className="py-1.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      aria-label={`Edita ${u.Codi}`}
                      disabled={enCurs}
                      onClick={() => { setEditantId(u.id); setEsborrany({ Codi: u.Codi, Edifici: u.Edifici, Planta: u.Planta }) }}
                      className="p-1 text-gray-500 hover:text-primary disabled:opacity-40"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Esborra ${u.Codi}`}
                      disabled={enCurs}
                      onClick={() => fes(u.id, () => eliminar(u))}
                      className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-40"
                    >
                      {ocupat === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                {CAMPS.map((camp) => (
                  <td key={camp} className="pt-3 pr-2">
                    <input
                      className="input text-sm w-full"
                      value={nova[camp]}
                      placeholder={EXEMPLE[camp]}
                      aria-label={`${camp} de la nova ubicació`}
                      onChange={(e) => setNova((d) => ({ ...d, [camp]: e.target.value }))}
                    />
                  </td>
                ))}
                <td className="pt-3 text-right">
                  <button
                    type="button"
                    aria-label="Afegeix la ubicació"
                    disabled={enCurs || !nova.Codi.trim()}
                    onClick={() => fes('nova', async () => { await crear(nova); setNova(BUIT) })}
                    className="p-1.5 text-white rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {ocupat === 'nova' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {errorAccio && <p className="mt-2 text-xs text-red-600">{errorAccio}</p>}
    </div>
  )
}
