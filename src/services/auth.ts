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

function createProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, createProvider())
  const email = result.user.email ?? ''

  if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
    await signOut(auth)
    useAuthStore.getState().clearAuth()
    throw new Error('domini-no-autoritzat')
  }

  useAuthStore.getState().setAuth(result.user)

  return result.user
}

export async function logout(): Promise<void> {
  // Retirem les dades visibles abans de tancar la sessió.
  useAuthStore.getState().clearAuth()
  sessionStorage.removeItem('coord-stjosepDB-auth')
  clearSessionData()
  await signOut(auth)
}
