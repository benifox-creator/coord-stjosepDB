// Offline visual fixture. No AuthSync, API writes or email delivery.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../src/store/authStore'
import { useUsuarisStore } from '../src/store/usuarisStore'
import { useConfigStore } from '../src/store/configStore'
import { useHoraris } from '../src/modules/horaris/useHoraris'
import { useAbsencies } from '../src/modules/absencies/useAbsencies'
import { useSubstitucions } from '../src/modules/substitucions/useSubstitucions'
import { HorarisPage } from '../src/modules/horaris/HorarisPage'
import { AbsenciaForm } from '../src/modules/absencies/AbsenciaForm'
import { OperationsOverview } from '../src/modules/dashboard/OperationsOverview'
import { schoolYear, yearDates } from '../src/utils/schoolCalendar'
import '../src/index.css'
const year=schoolYear(), dates=yearDates(year)
const email='demo@stjosep.org'
useAuthStore.setState({user:{email,displayName:'Docent de prova',uid:'fixture'} as never})
useUsuarisStore.setState({rol:'coordinador',usuaris:[{id:'demo',Email:email,Nom:'Docent de prova',Rol:'coordinador',Etapa:'EP',PotGestionarMaterial:false,Data_alta:''}],loading:false})
useConfigStore.setState({loaded:true,config:{},load:async()=>{}})
useHoraris.setState({load:async()=>{},horaris:[
  {id:'slot1',Professor:email,DiaSetmana:'Dilluns',Etapa:'EP',Franja:'9:00-10:00',Tipus:'Lectiva',Grup:'EP-1r A',Materia:'Matemàtiques',CursEscolar:year,VigentDesde:dates.start,VigentFins:dates.end,NecessitaCobertura:true,Creat_el:'',Creat_per:email},
  {id:'slot2',Professor:email,DiaSetmana:'Dilluns',Etapa:'EP',Franja:'11:30-12:30',Tipus:'No lectiva',Grup:'',Materia:'Guàrdia',CursEscolar:year,VigentDesde:dates.start,VigentFins:dates.end,NecessitaCobertura:true,Creat_el:'',Creat_per:email},
],crear:async()=>{},editar:async()=>{},eliminar:async()=>{}})
useAbsencies.setState({load:async()=>{}})
useSubstitucions.setState({load:async()=>{}})
export default function Preview(){
 const [absence,setAbsence]=useState(false)
 return <MemoryRouter><div className="min-h-screen bg-gray-50"><nav className="p-4 flex flex-wrap items-center gap-4 text-sm border-b bg-white"><strong>Revisió local · dades fictícies</strong><button onClick={()=>setAbsence(true)} className="text-primary underline">Nova absència</button></nav><main className="p-4 space-y-4"><OperationsOverview/><HorarisPage/></main>{absence&&<AbsenciaForm onCancel={()=>setAbsence(false)} onDesar={async()=>setAbsence(false)}/>}</div></MemoryRouter>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
