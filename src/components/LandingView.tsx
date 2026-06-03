'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Bot,
  Shield,
  MessageSquare,
  Upload,
  Rocket,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  Check,
  Send,
  Box,
  Brain,
  Terminal,
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

      // Sign in via NextAuth to set the session cookie
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      // Fetch user info from session (cookie is now set)
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
      // Demo account uses environment-configured credentials
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || ''
      const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || ''
      
      if (!demoEmail || !demoPassword) {
        setError('Demo mode is not configured. Please create an account instead.')
        setLoading(false)
        return
      }

      // Create demo user if not exists (409 is fine — already registered)
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
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-background to-slate-950/20" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-slate-500/5 blur-3xl" />

        <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-400 mb-8">
              <Rocket className="h-3.5 w-3.5" />
              Self-hosted AI Agent Platform
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Build Your Own{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                AI Agents
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Create, configure, and deploy custom AI agents with isolated sandboxes,
              knowledge bases, and Telegram integration. Like ChatGPT&apos;s GPTs, but self-hosted.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 text-base">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {loginMode === 'login' ? 'Welcome Back' : 'Create Account'}
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
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : loginMode === 'login' ? 'Sign In' : 'Create Account'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      {loginMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                      <button
                        type="button"
                        className="text-emerald-500 hover:underline"
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
                className="px-8 h-12 text-base"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                Try Demo
                <Zap className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Layers */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Six Layers of Power</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete architecture designed for security, scalability, and developer experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: 'Builder UI',
                description: 'ChatGPT-like interface to configure your agent — name, personality, knowledge base, tools, and model settings.',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: 'API Gateway + Registry',
                description: 'Handles auth, rate limiting, and routing. Agent Registry stores configs, versions, and ownership data.',
                color: 'text-cyan-500',
                bg: 'bg-cyan-500/10',
              },
              {
                icon: <Box className="h-6 w-6" />,
                title: 'Sandboxed Runtime',
                description: 'Each agent runs in its own isolated container — no shared memory, no cross-user access. Complete isolation.',
                color: 'text-red-500',
                bg: 'bg-red-500/10',
              },
              {
                icon: <Upload className="h-6 w-6" />,
                title: 'Shared Infrastructure',
                description: 'Postgres with row-level security, object storage per user, vector DB namespaced per tenant, job queues.',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: 'Platform Services',
                description: 'Auth with OAuth, Stripe billing with usage metering, per-container monitoring, and admin dashboard.',
                color: 'text-violet-500',
                bg: 'bg-violet-500/10',
              },
              {
                icon: <Terminal className="h-6 w-6" />,
                title: 'Deploy Anywhere',
                description: 'Docker Compose on a VPS for starters. Migrate to ECS/EKS when scaling. Same isolation guarantees everywhere.',
                color: 'text-orange-500',
                bg: 'bg-orange-500/10',
              },
            ].map((layer, i) => (
              <Card key={i} className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${layer.bg} ${layer.color} mb-2`}>
                    {layer.icon}
                  </div>
                  <CardTitle className="text-lg">Layer {i + 1} — {layer.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{layer.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Telegram Integration Highlight */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/5 px-4 py-1.5 text-sm text-sky-400 mb-6">
                <Send className="h-3.5 w-3.5" />
                Telegram Integration
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Connect Your Agent to Telegram
              </h2>
              <p className="text-muted-foreground mb-6">
                Just like Hermes Agent — connect your agent to Telegram using BotFather.
                Your users can chat with your AI agent right from their phone, 24/7.
              </p>
              <div className="space-y-3">
                {[
                  'Create a bot via @BotFather in Telegram',
                  'Paste the bot token in your agent settings',
                  'Hit Publish — webhook is set up automatically',
                  'Your agent responds on Telegram in real-time',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">@MySupportBot</div>
                    <div className="text-xs text-muted-foreground">online</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[80%] text-sm">
                      How do I reset my password?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%] text-sm">
                      You can reset your password by clicking &quot;Forgot Password&quot; on the login page, or I can send you a reset link. Which would you prefer?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[80%] text-sm">
                      Send me the link please
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%] text-sm">
                      Done! Check your email. The link expires in 24 hours.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start free, scale as you grow. Self-hosted means you control the infrastructure costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: 'Free',
                price: '$0',
                period: '/month',
                features: ['1 Agent', '1,000 messages/mo', 'Basic models', 'Community support'],
                cta: 'Get Started',
                popular: false,
              },
              {
                name: 'Pro',
                price: '$29',
                period: '/month',
                features: ['10 Agents', '50,000 messages/mo', 'All models + custom', 'Telegram integration', 'Knowledge base uploads', 'Priority support'],
                cta: 'Start Pro',
                popular: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                features: ['Unlimited Agents', 'Unlimited messages', 'Custom model hosting', 'SSO/SAML', 'Dedicated support', 'SLA guarantee'],
                cta: 'Contact Us',
                popular: false,
              },
            ].map((plan, i) => (
              <Card
                key={i}
                className={`relative ${plan.popular ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-border/50'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${plan.popular ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white">
              <Bot className="h-3 w-3" />
            </div>
            <span className="font-semibold text-sm">AgentForge</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Self-hosted AI agent builder. Open source and production ready.
          </p>
        </div>
      </footer>
    </div>
  )
}
