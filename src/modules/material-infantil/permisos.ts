import type { Rol, Usuari } from '../usuaris/types'
import { canAccessModul } from '../../store/configStore'

export function potGestionarMaterialInfantil(rol: Rol | null, potGestionarMaterialFlag: boolean): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular' || potGestionarMaterialFlag
}

export function potVeureMaterialInfantil(
  usuariActual: Usuari | null,
  rol: Rol | null,
  config: Record<string, string[]>,
): boolean {
  if (rol === 'coordinador') return true
  if (usuariActual?.PotGestionarMaterial) return true
  return canAccessModul(config, 'material-infantil', rol)
}
