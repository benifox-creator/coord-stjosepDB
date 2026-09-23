import { useEffect, useMemo, useState } from 'react'
import { PanellEconomic } from '../../modules/excursions/PanellEconomic'
import { useBalanc } from '../../modules/excursions/useBalanc'
import { resumCurs } from '../../modules/excursions/balanc'
import { potVeureCostos } from '../../modules/excursions/permisos'
import { parametresPreu } from '../../modules/excursions/parametres'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { useConfigStore } from '../../store/configStore'
import { schoolYear } from '../../utils/schoolCalendar'

export default function EconomiaWrapper() {
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const jo = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null
  const potVeure = potVeureCostos(rol, jo)

  const { sortides, loading, error, carrega } = useBalanc()
  const config = useConfigStore((s) => s.config)
  const [curs, setCurs] = useState(schoolYear())

  // Els paràmetres de sempre surten de la configuració viva, per etapa, com a
  // qualsevol altra pantalla: el store no ha de saber què hi diu la
  // Configuració, i només se'ls mira per a les sortides sense preu confirmat.
  useEffect(() => {
    if (potVeure) void carrega(curs, (etapa) => parametresPreu(config, etapa))
  }, [carrega, curs, potVeure, config])

  // `avui` es calcula aquí, al límit de l’aplicació, i entra al càlcul com a
  // argument: cap funció de `balanc.ts` mira el rellotge, i així les proves
  // poden situar-se on vulguin.
  const resum = useMemo(() => resumCurs(sortides, new Date().toISOString().slice(0, 10)), [sortides])

  if (!potVeure) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          Aquesta pantalla ensenya els costos de les sortides i només la veu qui els gestiona.
        </p>
      </div>
    )
  }

  return (
    <PanellEconomic
      resum={resum}
      curs={curs}
      cursos={[curs]}
      loading={loading}
      error={error}
      onCurs={setCurs}
    />
  )
}
