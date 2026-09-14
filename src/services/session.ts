import { useConfigStore } from '../store/configStore'
import { useUsuarisStore } from '../store/usuarisStore'
import { useAbsencies } from '../modules/absencies/useAbsencies'
import { useSubstitucions } from '../modules/substitucions/useSubstitucions'
import { useHoraris } from '../modules/horaris/useHoraris'
import { useComandesInfantil } from '../modules/material-infantil/useComandesInfantil'
import { useMaterialsInfantil } from '../modules/material-infantil/useMaterialsInfantil'
import { useProveidorsInfantil } from '../modules/material-infantil/useProveidorsInfantil'

export function clearSessionData() {
  useUsuarisStore.getState().reset()
  useConfigStore.setState({ config: {}, loaded: false, loading: false, error: null })
  useAbsencies.setState({ absencies: [], loading: false, error: null })
  useSubstitucions.setState({ substitucions: [], loading: false, error: null })
  useHoraris.setState({ horaris: [], loading: false, error: null })
  useComandesInfantil.setState({ comandes: [], loading: false, error: null })
  useMaterialsInfantil.setState({ materials: [], loading: false, error: null })
  useProveidorsInfantil.setState({ proveidors: [], loading: false, error: null })
}
