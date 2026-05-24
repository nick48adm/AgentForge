import { create } from 'zustand'

export type View = 'landing' | 'dashboard' | 'builder' | 'admin'

export interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  plan: string
  image?: string | null
}

interface AppStore {
  view: View
  setView: (view: View) => void
  selectedAgentId: string | null
  setSelectedAgentId: (id: string | null) => void
  isAuthenticated: boolean
  setIsAuthenticated: (val: boolean) => void
  user: UserInfo | null
  setUser: (user: UserInfo | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  view: 'landing',
  setView: (view) => set({ view }),
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  isAuthenticated: false,
  setIsAuthenticated: (val) => set({ isAuthenticated: val }),
  user: null,
  setUser: (user) => set({ user }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
