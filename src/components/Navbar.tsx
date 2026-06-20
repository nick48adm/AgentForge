'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
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
    await signOut({ redirect: false })
    setUser(null)
    setIsAuthenticated(false)
    setView('landing')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95">
      <div className="flex h-13 items-center px-4 md:px-6">
        {/* Logo */}
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">AgentForge</span>
        </button>

        {/* Nav Links */}
        <nav className="flex items-center gap-0.5 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('dashboard')}
            className="text-muted-foreground hover:text-foreground text-xs h-8"
          >
            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('admin')}
              className="text-muted-foreground hover:text-foreground text-xs h-8"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-8">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image || ''} />
                <AvatarFallback className="bg-muted text-foreground text-[10px] font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-xs">{user?.name || 'User'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <User className="h-3.5 w-3.5 mr-2" />
              <span className="text-xs">{user?.email}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs">Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              <span className="text-xs">Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
