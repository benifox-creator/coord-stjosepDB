import { useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'

const COLOR = '#861414'

export function DashboardInfantilTab() {
  const { comandes, load } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const getValues = useConfigStore((s) => s.getValues)
  const cursActiu = getValues('material-infantil.curs-actiu')[0]
  const pressupost = Number(getValues('material-infantil.pressupost-objectiu')[0]) || 0

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  function calculaCost(c: (typeof comandes)[number]) {
    const material = materials.find((m) => m.id === c.MaterialId)
    const nAlumnes = nreAlumnesFromConfig(config, c.Etapa)
    const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
    const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
    return { material, cost: material ? costEstimat(quantitat, material.PreuUnitari) : 0 }
  }

  const liniesCursActiu = useMemo(
    () => comandes.filter((c) => c.CursEscolar === cursActiu).map((c) => ({ comanda: c, ...calculaCost(c) })),
    [comandes, materials, config, cursActiu],
  )

  const costTotal = liniesCursActiu.reduce((s, l) => s + l.cost, 0)
  const pctPressupost = pressupost > 0 ? (costTotal / pressupost) * 100 : 0
  const pendents = liniesCursActiu.filter((l) => l.comanda.Estat === 'Pendent').length

  const perCategoria = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of liniesCursActiu) {
      const cat = l.material?.Categoria ?? 'Altres'
      map.set(cat, (map.get(cat) ?? 0) + l.cost)
    }
    return Array.from(map.entries())
      .map(([categoria, cost]) => ({ categoria, cost: Math.round(cost * 100) / 100 }))
      .filter((c) => c.cost > 0)
      .sort((a, b) => b.cost - a.cost)
  }, [liniesCursActiu])

  const resumHistoric = useMemo(() => {
    const map = new Map<string, { cost: number; linies: number }>()
    for (const c of comandes) {
      const { cost } = calculaCost(c)
      const prev = map.get(c.CursEscolar) ?? { cost: 0, linies: 0 }
      map.set(c.CursEscolar, { cost: prev.cost + cost, linies: prev.linies + 1 })
    }
    return Array.from(map.entries())
      .map(([curs, v]) => ({ curs, cost: Math.round(v.cost * 100) / 100, linies: v.linies }))
      .sort((a, b) => b.curs.localeCompare(a.curs))
  }, [comandes, materials, config])

  return (
    <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Cost estimat (curs {cursActiu})</p>
          <p className="text-2xl font-bold text-text-main">{costTotal.toFixed(2)}€</p>
          {pressupost > 0 && (
            <p className={`text-xs mt-1 ${pctPressupost > 100 ? 'text-red-600' : 'text-gray-400'}`}>
              {pctPressupost.toFixed(0)}% del pressupost ({pressupost.toFixed(2)}€)
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Línies pendents</p>
          <p className="text-2xl font-bold text-text-main">{pendents}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Línies totals (curs actiu)</p>
          <p className="text-2xl font-bold text-text-main">{liniesCursActiu.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cost per categoria</p>
        {perCategoria.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sense dades encara.</p>
        ) : (
          <div style={{ width: '100%', height: Math.max(160, perCategoria.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perCategoria} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="categoria"
                  width={120}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value}€`, 'Cost']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="cost" fill={COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4">Resum per curs escolar</p>
        <p className="text-[11px] text-gray-400 px-4 pt-0.5">
          Cost recalculat amb els paràmetres actuals (alumnes i preus), no és un valor congelat de cada curs.
        </p>
        <table className="w-full text-sm mt-2">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Curs</th>
              <th className="px-4 py-2.5 font-medium text-right">Línies</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resumHistoric.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Sense dades encara.</td></tr>
            )}
            {resumHistoric.map((r) => (
              <tr key={r.curs}>
                <td className="px-4 py-2.5 text-text-main">{r.curs}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{r.linies}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-text-main">{r.cost.toFixed(2)}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
