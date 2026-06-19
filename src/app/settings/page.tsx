'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  User,
  Key,
  CreditCard,
  Loader2,
  Check,
  Bot,
} from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, setUser, setIsAuthenticated, setView } = useAppStore()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/user/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        setUser({ ...user, name: data.name })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      // silently fail
    }
    setSaving(false)
  }, [user, name, setUser])

  const handleChangePassword = useCallback(async () => {
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    setPasswordSaving(true)
    setPasswordSaved(false)
    try {
      const res = await fetch(`/api/user/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordSaved(true)
        setTimeout(() => setPasswordSaved(false), 2000)
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'Failed to change password')
      }
    } catch {
      setPasswordError('Something went wrong')
    }
    setPasswordSaving(false)
  }, [currentPassword, newPassword, confirmPassword])

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050508]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050508]/95 backdrop-blur-sm">
        <div className="flex h-14 items-center px-4 md:px-6 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-8 w-8 text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-sm ml-2">Settings</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Profile Section */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-white/40" />
              <CardTitle className="text-sm">Profile</CardTitle>
            </div>
            <CardDescription className="text-xs text-white/30">
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/60">Email</Label>
              <Input
                value={user.email}
                disabled
                className="h-9 bg-white/5 border-white/10 text-white/40 text-sm"
              />
              <p className="text-[10px] text-white/20">Email cannot be changed</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/60">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 bg-white/5 border-white/10 focus:border-white/20 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveProfile}
                disabled={saving || name === user.name}
                className="h-8 text-xs bg-white text-black hover:bg-white/90"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : saved ? (
                  <Check className="h-3 w-3 mr-1.5" />
                ) : null}
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-white/40" />
              <CardTitle className="text-sm">Password</CardTitle>
            </div>
            <CardDescription className="text-xs text-white/30">
              Change your account password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/60">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-9 bg-white/5 border-white/10 focus:border-white/20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/60">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-9 bg-white/5 border-white/10 focus:border-white/20 text-sm placeholder:text-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/60">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 bg-white/5 border-white/10 focus:border-white/20 text-sm"
              />
            </div>
            {passwordError && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">{passwordError}</p>
            )}
            <Button
              onClick={handleChangePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="h-8 text-xs bg-white text-black hover:bg-white/90"
            >
              {passwordSaving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : passwordSaved ? (
                <Check className="h-3 w-3 mr-1.5" />
              ) : null}
              {passwordSaving ? 'Changing...' : passwordSaved ? 'Password Changed' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>

        {/* Plan Section */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-white/40" />
              <CardTitle className="text-sm">Plan</CardTitle>
            </div>
            <CardDescription className="text-xs text-white/30">
              Your current subscription plan and usage limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-white/5 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white/40" />
                </div>
                <div>
                  <div className="text-sm font-medium capitalize">{user.plan} Plan</div>
                  <div className="text-[10px] text-white/30">
                    {user.plan === 'free' ? '3 agents, basic features' :
                     user.plan === 'pro' ? 'Unlimited agents, priority support' :
                     'Custom limits, dedicated support'}
                  </div>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={
                  user.plan === 'free' ? 'bg-white/10 text-white/50 text-[10px]' :
                  user.plan === 'pro' ? 'bg-white text-black text-[10px]' :
                  'bg-white/70 text-black text-[10px]'
                }
              >
                Current
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Role info (for admins) */}
        {user.role === 'admin' && (
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge className="bg-white text-black text-[10px] h-5">Admin</Badge>
                Administrator Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-white/30">
                You have admin privileges. Access the admin panel from the main navigation to manage users and agents platform-wide.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
