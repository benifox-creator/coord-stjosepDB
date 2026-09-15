import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { clearSessionData } from './session'
import { useAuthStore } from '../store/authStore'

const ALLOWED_DOMAIN = 'stjosep.org'

/** Per què es rebutja un inici de sessió, o null si s'accepta. */
export type MotiuRebuig = 'correu-no-disponible' | 'domini-no-autoritzat'

export function motiuRebuig(email: string): MotiuRebuig | null {
  const net = email.trim().toLowerCase()
  // Un correu buit i un correu d'un altre domini no són el mateix problema i
  // no es poden explicar igual: el primer es resol tornant-ho a provar i el
  // segon no es resol de cap manera.
  if (!net) return 'correu-no-disponible'
  if (!net.endsWith(`@${ALLOWED_DOMAIN}`)) return 'domini-no-autoritzat'
  return null
}

function createProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

async function correuDelUsuari(user: User): Promise<string> {
  if (user.email) return user.email
  // Quan algú entra per primer cop amb Google en un compte que ja existia a
  // Firebase sense cap proveïdor (perquè l'hem donat d'alta per avançat),
  // l'enllaçat encara no s'ha propagat a l'objecte que retorna el popup i el
  // correu hi arriba buit. Recarregar-lo el porta; si no, el té el proveïdor.
  try {
    await user.reload()
  } catch {
    // Si la recàrrega falla encara queda el proveïdor; que no s'aturi aquí.
  }
  return auth.currentUser?.email ?? user.providerData.find((p) => p.email)?.email ?? ''
}

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, createProvider())
  const motiu = motiuRebuig(await correuDelUsuari(result.user))

  if (motiu) {
    await signOut(auth)
    useAuthStore.getState().clearAuth()
    throw new Error(motiu)
  }

  const user = auth.currentUser ?? result.user
  useAuthStore.getState().setAuth(user)

  return user
}

export async function logout(): Promise<void> {
  // Retirem les dades visibles abans de tancar la sessió.
  useAuthStore.getState().clearAuth()
  sessionStorage.removeItem('coord-stjosepDB-auth')
  clearSessionData()
  await signOut(auth)
}
