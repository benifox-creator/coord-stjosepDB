import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { useAuthStore } from '../store/authStore'

const ALLOWED_DOMAIN = 'stjosep.org'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
]

function createProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  SCOPES.forEach((s) => p.addScope(s))
  return p
}

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, createProvider())
  const email = result.user.email ?? ''

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await signOut(auth)
    useAuthStore.getState().clearAuth()
    throw new Error('domini-no-autoritzat')
  }

  const credential = GoogleAuthProvider.credentialFromResult(result)
  useAuthStore.getState().setAuth(result.user, credential?.accessToken ?? null)

  return result.user
}

export async function logout(): Promise<void> {
  // Esborrem token i rol ABANS de signOut per evitar que onAuthStateChanged
  // intenti recuperar-los mentre s'està tancant la sessió
  useAuthStore.getState().clearAuth()
  const { reset } = await import('../store/usuarisStore').then(m => ({ reset: m.useUsuarisStore.getState().reset }))
  reset()
  await signOut(auth)
}
