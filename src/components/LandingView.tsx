'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Bot,
  Shield,
  MessageSquare,
  ArrowRight,
  Check,
  Send,
  Box,
  Terminal,
  Zap,
  Cpu,
  Lock,
} from 'lucide-react'

export function LandingView() {
  const { setUser, setIsAuthenticated, setView } = useAppStore()
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (loginMode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error)
          setLoading(false)
          return
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      if (sessionRes.ok && session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.name || '',
          email: session.user.email || '',
          role: session.user.role || 'user',
          plan: session.user.plan || 'free',
        })
        setIsAuthenticated(true)
        setView('dashboard')
      } else {
        setError('Login failed — please try again')
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || ''
      const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || ''
      
      if (!demoEmail || !demoPassword) {
        setError('Demo mode is not configured. Please create an account instead.')
        setLoading(false)
        return
      }

      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword, name: 'Demo User' }),
      })

      const result = await signIn('credentials', {
        email: demoEmail,
        password: demoPassword,
        redirect: false,
      })

      if (result?.error) { setLoading(false); return }

      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      if (sessionRes.ok && session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.name || 'Demo User',
          email: session.user.email || '',
          role: session.user.role || 'user',
          plan: session.user.plan || 'free',
        })
        setIsAuthenticated(true)
        setView('dashboard')
      }
    } catch {
      setError('Demo login failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 md:px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight">AgentForge</span>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Sign In
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {loginMode === 'login' ? 'Welcome back' : 'Create account'}
                </DialogTitle>
                <DialogDescription>
                  {loginMode === 'login'
                    ? 'Sign in to your AgentForge account'
                    : 'Create your free account to start building agents'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {loginMode === 'register' && (
                  <div>
                    <Input
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : loginMode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {loginMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    type="button"
                    className="text-foreground underline underline-offset-2 hover:text-foreground/80"
                    onClick={() => {
                      setLoginMode(loginMode === 'login' ? 'register' : 'login')
                      setError('')
                    }}
                  >
                    {loginMode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-32">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50" />

        <div className="relative container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-8 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
              self-hosted ai agent platform
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Build agents
              <br />
              that actually work
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              Create, configure, and deploy custom AI agents with isolated sandboxes,
              knowledge bases, and multi-channel integration. Self-hosted, fully controlled.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-foreground text-background hover:bg-foreground/90 px-6 h-11 text-sm font-medium"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {loginMode === 'login' ? 'Welcome back' : 'Create account'}
                    </DialogTitle>
                    <DialogDescription>
                      {loginMode === 'login'
                        ? 'Sign in to your AgentForge account'
                        : 'Create your free account to start building agents'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {loginMode === 'register' && (
                      <div>
                        <Input
                          placeholder="Full Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    )}
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full bg-foreground text-background hover:bg-foreground/90"
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : loginMode === 'login' ? 'Sign In' : 'Create Account'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      {loginMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                      <button
                        type="button"
                        className="text-foreground underline underline-offset-2 hover:text-foreground/80"
                        onClick={() => {
                          setLoginMode(loginMode === 'login' ? 'register' : 'login')
                          setError('')
                        }}
                      >
                        {loginMode === 'login' ? 'Sign up' : 'Sign in'}
                      </button>
                    </p>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="lg"
                className="px-6 h-11 text-sm font-medium"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                Try Demo
                <Zap className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture — clean grid */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-4">Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Six layers. Zero compromises.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A complete architecture designed for security, scalability, and developer experience — from the builder UI down to the sandboxed runtime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px max-w-4xl mx-auto bg-border rounded-lg overflow-hidden">
            {[
              {
                icon: <MessageSquare className="h-5 w-5" />,
                title: 'Builder UI',
                description: 'ChatGPT-like interface to configure your agent — name, personality, knowledge base, tools, and model settings.',
              },
              {
                icon: <Cpu className="h-5 w-5" />,
                title: 'API Gateway + Registry',
                description: 'Handles auth, rate limiting, and routing. Agent Registry stores configs, versions, and ownership data.',
              },
              {
                icon: <Box className="h-5 w-5" />,
                title: 'Sandboxed Runtime',
                description: 'Each agent runs in its own isolated container — no shared memory, no cross-user access.',
              },
              {
                icon: <Lock className="h-5 w-5" />,
                title: 'Shared Infrastructure',
                description: 'Postgres with row-level security, object storage per user, vector DB namespaced per tenant, job queues.',
              },
              {
                icon: <Shield className="h-5 w-5" />,
                title: 'Platform Services',
                description: 'Auth with OAuth, Stripe billing with usage metering, per-container monitoring, and admin dashboard.',
              },
              {
                icon: <Terminal className="h-5 w-5" />,
                title: 'Deploy Anywhere',
                description: 'Docker Compose on a VPS for starters. Migrate to ECS/EKS when scaling. Same isolation guarantees everywhere.',
              },
            ].map((layer, i) => (
              <div
                key={i}
                className="bg-card p-6 group hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {layer.icon}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2">{layer.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{layer.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Telegram Integration — split layout */}
      <section className="py-24 md:py-32 border-t">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-4">Integration</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Connect to Telegram
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Connect your agent to Telegram using BotFather.
                Your users can chat with your AI agent right from their phone, 24/7.
              </p>
              <div className="space-y-4">
                {[
                  'Create a bot via @BotFather in Telegram',
                  'Paste the bot token in your agent settings',
                  'Hit Publish — webhook is set up automatically',
                  'Your agent responds on Telegram in real-time',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded border border-border text-xs font-mono text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              {/* Chat mockup */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Send className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-xs">@MySupportBot</div>
                    <div className="text-[10px] text-muted-foreground">online</div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-end">
                    <div className="bg-foreground text-background rounded-lg rounded-br-sm px-3 py-2 max-w-[80%] text-xs">
                      How do I reset my password?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2 max-w-[80%] text-xs">
                      You can reset your password by clicking &quot;Forgot Password&quot; on the login page, or I can send you a reset link.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-foreground text-background rounded-lg rounded-br-sm px-3 py-2 max-w-[80%] text-xs">
                      Send me the link please
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2 max-w-[80%] text-xs">
                      Done! Check your email. The link expires in 24 hours.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — minimal */}
      <section className="py-24 md:py-32 border-t">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-4">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Simple. Predictable.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Start free, scale as you grow. Self-hosted means you control the infrastructure costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px max-w-4xl mx-auto bg-border rounded-lg overflow-hidden">
            {[
              {
                name: 'Free',
                price: '$0',
                period: '/mo',
                features: ['1 Agent', '1,000 messages/mo', 'Basic models', 'Community support'],
                cta: 'Get Started',
                featured: false,
              },
              {
                name: 'Pro',
                price: '$29',
                period: '/mo',
                features: ['10 Agents', '50,000 messages/mo', 'All models + custom', 'Telegram integration', 'Knowledge base uploads', 'Priority support'],
                cta: 'Start Pro',
                featured: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                features: ['Unlimited Agents', 'Unlimited messages', 'Custom model hosting', 'SSO/SAML', 'Dedicated support', 'SLA guarantee'],
                cta: 'Contact Us',
                featured: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`bg-card p-6 flex flex-col ${plan.featured ? 'relative z-10' : ''}`}
              >
                {plan.featured && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-foreground" />
                )}
                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                    {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs">
                      <Check className="h-3 w-3 text-muted-foreground shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full text-xs h-9 ${plan.featured ? 'bg-foreground text-background hover:bg-foreground/90' : ''}`}
                  variant={plan.featured ? 'default' : 'outline'}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-background">
              <Bot className="h-2.5 w-2.5" />
            </div>
            <span className="font-medium text-xs">AgentForge</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Self-hosted AI agent builder. Open source and production ready.
          </p>
        </div>
      </footer>
    </div>
  )
}
