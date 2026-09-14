import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore, potGestionar, potAprovarAbsencies } from '../../store/usuarisStore'
import { canAccessModul, useConfigStore } from '../../store/configStore'
import { getAll, callRpc } from '../../services/db'
import { useAbsencies } from '../absencies/useAbsencies'
import { useSubstitucions } from '../substitucions/useSubstitucions'
import { useHoraris } from '../horaris/useHoraris'
import { diaSetmanaDeData } from '../horaris/horaris.utils'
import { schoolYear, slotMinutes } from '../../utils/schoolCalendar'

interface Notification { id:string;subject:string;recipient:string;status:'pending'|'sending'|'sent'|'failed';last_error:string|null;created_at:string }
const statusLabel = {pending:'Pendent d’enviament',sending:'Enviant',sent:'Enviada',failed:'Enviament fallit'}

export function OperationsOverview() {
  const email = (useAuthStore(s => s.user?.email) ?? '').toLowerCase()
  const rol = useUsuarisStore(s => s.rol)
  const config = useConfigStore(s => s.config)
  const {absencies, load:loadAbsencies, error:absenceError} = useAbsencies()
  const {substitucions, load:loadSubstitucions, error:substitutionError} = useSubstitucions()
  const {horaris, load:loadHoraris, error:scheduleError} = useHoraris()
  const [today, setToday] = useState(() => new Date().toLocaleDateString('sv-SE'))
  useEffect(() => { const timer=setInterval(()=>setToday(new Date().toLocaleDateString('sv-SE')),60000);return ()=>clearInterval(timer) }, [])
  const canSubstitute = canAccessModul(config,'substitucions',rol)
  const canSchedule = canAccessModul(config,'horaris',rol)
  useEffect(() => {
    if (canSubstitute) { void loadAbsencies(); void loadSubstitucions() }
    if (canSchedule) void loadHoraris(schoolYear(new Date(today+'T12:00:00')))
  }, [canSubstitute,canSchedule,loadAbsencies,loadSubstitucions,loadHoraris,today])
  const mySlots = horaris.filter(h=>h.Professor===email && h.DiaSetmana===diaSetmanaDeData(today) && h.VigentDesde<=today && h.VigentFins>=today)
    .sort((a,b)=>slotMinutes(a.Franja)[0]-slotMinutes(b.Franja)[0])
  const mySubstitutions = substitucions.filter(s=>s.ProfessorSubstitut===email && s.Data===today && s.Estat!=='Cancel·lada')
  const pendingCover = substitucions.filter(s=>s.Data>=today && s.Estat==='Pendent' && !s.ProfessorSubstitut)
  const pendingReview = absencies.filter(a=>a.Estat==='Pendent revisió')
  const holiday=(config['centre.dies-no-lectius']??[]).includes(today)
  if (!canSubstitute && !canSchedule) return null
  return <section aria-labelledby="today-tasks" className="rounded-xl bg-white p-5 border border-gray-200">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 id="today-tasks" className="font-semibold text-lg">El teu dia al centre</h2>
      {canSubstitute && rol!=='convidat' && <Link className="text-sm text-primary underline underline-offset-4" to="/substitucions?tab=absencies">Comunica una absència</Link>}
    </div>
    {(absenceError || substitutionError || scheduleError) && <p role="alert" className="mb-3 text-sm text-red-700">No s'ha pogut actualitzar tota l'activitat. Revisa el mòdul corresponent.</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        {canSchedule && <>
          <h3 className="font-medium text-sm mb-2">Horari d'avui</h3>
          {holiday ? <p className="text-sm text-gray-600">Dia no lectiu segons el calendari del centre.</p> : mySlots.length ? <ul className="divide-y divide-gray-100">{mySlots.map(h=><li key={h.id} className="py-2 flex gap-4 text-sm"><span className="shrink-0 tabular-nums text-gray-600">{h.Franja}</span><span className="min-w-0 break-words">{h.Grup} {h.Materia}</span></li>)}</ul> : <p className="text-sm text-gray-600">No hi ha períodes registrats per avui. <Link to="/horaris" className="underline text-primary">Revisa el teu horari</Link>.</p>}
        </>}
        {canSubstitute && mySubstitutions.length>0 && <p className="mt-3 text-sm"><Link to="/substitucions" className="text-primary underline">Tens {mySubstitutions.length} substitucions assignades avui</Link>.</p>}
      </div>
      {canSubstitute && <div className="space-y-3">
        {potGestionar(rol) && <Link to="/substitucions" className="block rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50"><strong>{pendingCover.length}</strong> substitucions pendents d'assignació</Link>}
        {potAprovarAbsencies(rol) && <Link to="/substitucions?tab=absencies" className="block rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50"><strong>{pendingReview.length}</strong> absències pendents de revisió</Link>}
        {!potGestionar(rol) && <Link to="/substitucions?tab=absencies" className="block text-sm text-primary underline">Consulta les teves absències i substitucions</Link>}
      </div>}
    </div>
  </section>
}

export function NotificationStatus() {
  const [notifications,setNotifications] = useState<Notification[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  async function refresh() {
    setLoading(true);setError('')
    try { setNotifications(await getAll<Notification>('notifications','created_at')) }
    catch (err) { setError(err instanceof Error ? err.message : 'Error carregant avisos') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    void getAll<Notification>('notifications','created_at')
      .then(rows => { if (active) setNotifications(rows) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Error carregant avisos') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const pending = notifications.filter(n=>n.status!=='sent')
  return <details className="rounded-xl border border-gray-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium">Estat dels avisos · {pending.length} pendents o fallits</summary>
    <button onClick={()=>void refresh()} disabled={loading} className="my-3 inline-flex items-center gap-2 text-sm text-primary disabled:opacity-50"><RefreshCw size={15} />Actualitza</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !error && pending.length===0 && <p className="text-sm text-gray-600">No hi ha enviaments pendents.</p>}
    <ul className="divide-y divide-gray-100">{pending.map(n=><li key={n.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm"><div className="min-w-0 break-words"><p>{n.subject}</p><p className="text-gray-600">{n.recipient} · {statusLabel[n.status]}</p>{n.last_error && <p className="text-red-700">{n.last_error}</p>}</div>{n.status==='failed' && <button className="text-primary underline" onClick={async()=>{try{await callRpc('retry_notification',{p_id:n.id});await refresh()}catch(err){setError(err instanceof Error?err.message:'Error reintentant')}}}>Reintenta</button>}</li>)}</ul>
  </details>
}
