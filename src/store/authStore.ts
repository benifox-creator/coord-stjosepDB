import { create } from 'zustand'
import type { User } from 'firebase/auth'

interface AuthStore {
  user: User | null
  setAuth: (user: User | null) => void
  clearAuth: () => void
}

// Firebase owns session persistence and token renewal. Provider tokens are never persisted here.
export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  setAuth: user => set({ user }),
  clearAuth: () => set({ user: null }),
}))
