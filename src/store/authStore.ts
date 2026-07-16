import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from 'firebase/auth'

interface AuthStore {
  user: User | null
  googleAccessToken: string | null
  setAuth: (user: User | null, token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      googleAccessToken: null,
      setAuth: (user, googleAccessToken) => set({ user, googleAccessToken }),
      clearAuth: () => set({ user: null, googleAccessToken: null }),
    }),
    {
      name: 'coord-stjosepDB-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Només persistim el token, no l'objecte User (no és serialitzable de forma fiable)
      partialize: (state) => ({ googleAccessToken: state.googleAccessToken }),
    }
  )
)
