'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import {
  Bot,
  Shield,
  LogOut,
  LayoutDashboard,
  Settings,
  User,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function Navbar() {
  const { user, setView, setUser, setIsAuthenticated } = useAppStore()

  const handleSignOut = async () => {
    // Clear next-auth session cookie properly
    await signOut({ redirect: false })
    setUser(null)
    setIsAuthenticated(false)
    setView('landing')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Logo */}
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">AgentForge</span>
        </button>

        {/* Nav Links */}
        <nav className="flex items-center gap-1 ml-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('dashboard')}
            className="text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('admin')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Shield className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.image || ''} />
                <AvatarFallback className="bg-emerald-600 text-white text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm">{user?.name || 'User'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <User className="h-4 w-4 mr-2" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              {user?.plan?.charAt(0).toUpperCase()}{user?.plan?.slice(1)} Plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
