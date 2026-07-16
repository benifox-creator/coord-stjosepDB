import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Package,
  Archive,
  Smartphone,
  CalendarDays,
  UserCheck,
  BookOpen,
  Target,
  Wrench,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../services/auth'
import { useUsuarisStore } from '../store/usuarisStore'
import { useConfigStore, canAccessModul } from '../store/configStore'

const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard',          icon: LayoutDashboard, end: true,  visKey: null },
  { to: '/incidencies',   label: 'Incidències',        icon: AlertTriangle,               visKey: 'incidencies' },
  { to: '/inventari',     label: 'Inventari',          icon: Package,                     visKey: 'inventari' },
  { to: '/material',      label: 'Material i Stock',   icon: Archive,                     visKey: 'material' },
  { to: '/prestecs',      label: 'Préstecs',           icon: Smartphone,                  visKey: 'prestecs' },
  { to: '/reserves',      label: 'Reserves',           icon: CalendarDays,                visKey: 'reserves' },
  { to: '/substitucions', label: 'Substitucions',       icon: UserCheck,                   visKey: 'substitucions' },
  { to: '/coneixement',   label: 'Base Coneixement',   icon: BookOpen,                    visKey: 'coneixement' },
  { to: '/pla-accio',     label: "Pla d'Acció",        icon: Target,                      visKey: 'pla-accio' },
  { to: '/manteniment',   label: 'Manteniment',        icon: Wrench,                      visKey: 'manteniment' },
]

const NAV_SETTINGS = [
  { to: '/configuracio', label: 'Configuració', icon: Settings },
]

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const rol = useUsuarisStore((s) => s.rol)
  const esCoordinador = rol === 'coordinador'
  const config = useConfigStore((s) => s.config)

  // Mentre el rol carrega (null), mostrem tots els ítems optimistament
  const itemsVisibles = NAV_ITEMS.filter(({ visKey }) =>
    visKey === null || rol === null || canAccessModul(config, visKey, rol)
  )

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Overlay mòbil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 flex flex-col bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200" style={{ backgroundColor: '#861414' }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
            SJ
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-semibold text-sm leading-tight truncate">Sant Josep Obrer</p>
            <p className="text-white/70 text-xs truncate">Coordinació Digital</p>
          </div>
          <button
            onClick={closeSidebar}
            className="ml-auto text-white/80 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegació */}
        <nav className="flex-1 overflow-y-auto py-3">
          {itemsVisibles.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-primary' : 'text-gray-400'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Configuració — només coordinador */}
        {esCoordinador && (
          <div className="border-t border-gray-100 py-2">
            {NAV_SETTINGS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} className={isActive ? 'text-primary' : 'text-gray-400'} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={14} className="text-primary" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Usuari + logout */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                {user?.displayName?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-text-main truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Tancar sessió"
              className="text-gray-400 hover:text-red-600 transition-colors"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contingut principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mòbil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-primary"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold text-text-main text-sm">Coordinació Digital</span>
        </header>

        {/* Àrea de contingut */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
