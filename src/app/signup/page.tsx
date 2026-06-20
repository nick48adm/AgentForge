'use client'

import { useState, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, ArrowRight, Loader2, Check } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Register
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Auto sign in after registration
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push('/login')
        return
      }
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }, [email, password, name, router])

  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
  ]

  return (
    <div className="min-h-screen flex bg-[#050508] text-white">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        {/* Background gradient orbs */}
        <div className="absolute w-[500px] h-[500px] bg-emerald-600/15 rounded-full -top-20 -left-20 blur-3xl pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] bg-indigo-500/10 rounded-full bottom-10 right-0 blur-3xl pointer-events-none" />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">AgentForge</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4 leading-[1.1]">
            <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
              Start building
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              intelligent agents
            </span>
          </h1>
          <p className="text-white/35 leading-relaxed max-w-sm">
            Create your free account to start building, deploying, and managing AI agents with isolated sandboxes.
          </p>

          {/* What you get */}
          <div className="mt-10 space-y-3">
            {[
              '3 free agents on the free plan',
              'Isolated Docker sandboxes per agent',
              'Multi-channel: Telegram, Discord, WhatsApp, Widget',
              'Knowledge base with per-agent isolation',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-white/40">
                <Check className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AgentForge</span>
          </div>

          <h2 className="text-xl font-semibold mb-1">Create account</h2>
          <p className="text-sm text-white/35 mb-8">Get started with your free AgentForge account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">Full Name</label>
              <Input
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 bg-white/5 border-white/10 focus:border-white/20 placeholder:text-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 focus:border-white/20 placeholder:text-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">Password</label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 focus:border-white/20 placeholder:text-white/20"
              />
              {/* Password strength indicators */}
              {password.length > 0 && (
                <div className="space-y-1 mt-2">
                  {passwordChecks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                        check.met ? 'text-emerald-400/70' : 'text-white/20'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                      {check.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90 font-medium h-10"
              disabled={loading || password.length < 8}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-xs text-center text-white/30 mt-6">
            Already have an account?{' '}
            <button
              type="button"
              className="text-white/60 underline underline-offset-2 hover:text-white transition-colors"
              onClick={() => router.push('/login')}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
