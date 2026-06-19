'use client'

import { useState, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }, [email, password, router])

  return (
    <div className="min-h-screen flex bg-[#050508] text-white">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        {/* Background gradient orbs */}
        <div className="absolute w-[500px] h-[500px] bg-indigo-600/15 rounded-full -top-20 -left-20 blur-3xl pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] bg-cyan-500/10 rounded-full bottom-10 right-0 blur-3xl pointer-events-none" />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">AgentForge</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4 leading-[1.1]">
            <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
              Welcome back
            </span>
          </h1>
          <p className="text-white/35 leading-relaxed max-w-sm">
            Sign in to manage your AI agents, deploy sandboxes, and monitor usage across your projects.
          </p>

          {/* Feature highlights */}
          <div className="mt-10 space-y-4">
            {[
              'Deploy agents to isolated sandboxes',
              'Connect to Telegram, Discord, and WhatsApp',
              'Real-time chat preview and testing',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-white/40">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400/60" />
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

          <h2 className="text-xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-white/35 mb-8">Enter your credentials to access your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 focus:border-white/20 placeholder:text-white/20"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90 font-medium h-10"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-center text-white/30 mt-6">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="text-white/60 underline underline-offset-2 hover:text-white transition-colors"
              onClick={() => router.push('/signup')}
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
