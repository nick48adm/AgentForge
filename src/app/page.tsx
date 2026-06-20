'use client'

import { useAppStore, View } from '@/lib/store'
import { LandingView } from '@/components/LandingView'
import { DashboardView } from '@/components/DashboardView'
import { BuilderView } from '@/components/BuilderView'
import { AdminView } from '@/components/AdminView'
import { Navbar } from '@/components/Navbar'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function Home() {
  const { view, isAuthenticated, setUser, setIsAuthenticated, setView } = useAppStore()
  const { data: session, status } = useSession()

  // Sync next-auth session with Zustand store
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setUser({
        id: (session.user as any).id,
        name: session.user.name || '',
        email: session.user.email || '',
        role: (session.user as any).role || 'user',
        plan: (session.user as any).plan || 'free',
        image: session.user.image,
      })
      setIsAuthenticated(true)
      if (view === 'landing') setView('dashboard')
    } else if (status === 'unauthenticated') {
      setUser(null)
      setIsAuthenticated(false)
      if (view !== 'landing') setView('landing')
    }
  }, [status, session])

  const renderView = () => {
    switch (view) {
      case 'landing':
        return <LandingView />
      case 'dashboard':
        return isAuthenticated ? <DashboardView /> : <LandingView />
      case 'builder':
        return isAuthenticated ? <BuilderView /> : <LandingView />
      case 'admin':
        return isAuthenticated ? <AdminView /> : <LandingView />
      default:
        return <LandingView />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {isAuthenticated && view !== 'landing' && <Navbar />}
      <main className="flex-1">{renderView()}</main>
    </div>
  )
}
