import { useState } from 'react'
import { Boxes, ClipboardList, Layers, Truck, BarChart2, Settings } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useConfigStore } from '../../store/configStore'
import { potGestionarMaterialInfantil, potVeureMaterialInfantil } from './permisos'
import { CatalegInfantilTab } from './CatalegInfantilTab'
import { ComandesInfantilTab } from './ComandesInfantilTab'
import { ConsolidatInfantilTab } from './ConsolidatInfantilTab'
import { ProveidorsInfantilTab } from './ProveidorsInfantilTab'
import { DashboardInfantilTab } from './DashboardInfantilTab'
import { ConfiguracioCursInfantilTab } from './ConfiguracioCursInfantilTab'

type Tab = 'cataleg' | 'comandes' | 'consolidat' | 'proveidors' | 'dashboard' | 'configuracio'

const TABS: [Tab, string, React.ElementType][] = [
  ['cataleg', 'Catàleg', Boxes],
  ['comandes', 'Comandes', ClipboardList],
  ['consolidat', 'Consolidat', Layers],
  ['proveidors', 'Proveïdors', Truck],
  ['dashboard', 'Dashboard', BarChart2],
  ['configuracio', 'Configuració', Settings],
]

export function MaterialInfantilPage() {
  const [tab, setTab] = useState<Tab>('cataleg')
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = useAuthStore((s) => s.user?.email)
  const config = useConfigStore((s) => s.config)

  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === (email ?? '').toLowerCase()) ?? null
  const potVeure = potVeureMaterialInfantil(usuariActual, rol, config)
  const potGestionar = potGestionarMaterialInfantil(rol, usuariActual?.PotGestionarMaterial ?? false)

  if (!potVeure) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-text-main mb-3">Material Infantil</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'cataleg' && <CatalegInfantilTab potGestionar={potGestionar} />}
        {tab === 'comandes' && <ComandesInfantilTab potGestionar={potGestionar} />}
        {tab === 'consolidat' && <ConsolidatInfantilTab />}
        {tab === 'proveidors' && <ProveidorsInfantilTab potGestionar={potGestionar} />}
        {tab === 'dashboard' && <DashboardInfantilTab />}
        {tab === 'configuracio' && <ConfiguracioCursInfantilTab potGestionar={potGestionar} />}
      </div>
    </div>
  )
}
