'use client'

import { useState, useEffect, useRef, useMemo, memo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Bot,
  ArrowRight,
  MessageSquare,
  Box,
  Terminal,
  Cpu,
  Lock,
  Shield,
  Send,
  ChevronDown,
  Sparkles,
  Globe,
  Layers,
} from 'lucide-react'

/* ─── Intersection Observer hook — reusable, stable ─── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect() } },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, isVisible }
}

/* ─── Floating orb — memoized, CSS transform only ─── */
const FloatingOrb = memo(function FloatingOrb({ className, style, orbRef }: { className?: string; style?: React.CSSProperties; orbRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={orbRef}
      className={`absolute rounded-full pointer-events-none parallax-orb ${className ?? ''}`}
      style={style}
    />
  )
})

/* ─── Animated terminal — memoized, self-contained ─── */
const AnimatedTerminal = memo(function AnimatedTerminal() {
  const [lines, setLines] = useState<string[]>([])
  const allLines = useMemo(() => [
    '$ agentforge init my-support-bot',
    '✓ Agent scaffold created',
    '$ agentforge config --model gpt-4o --temp 0.7',
    '✓ Model configured',
    '$ agentforge knowledge add ./docs/',
    '✓ 47 documents indexed',
    '$ agentforge deploy --sandbox',
    '⠋ Provisioning isolated container...',
    '✓ Agent live at agent-f8k2.agentforge.run',
    '$ agentforge connect telegram --token ***',
    '✓ Webhook registered. Bot is online.',
  ], [])

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < allLines.length) {
        setLines(prev => [...prev, allLines[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [allLines])

  return (
    <div className="landing-terminal rounded-xl border border-white/[0.06] bg-[#0a0a0f]/80 p-5 font-mono text-[13px] leading-relaxed overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <div className="h-3 w-3 rounded-full bg-green-500/70" />
        <span className="ml-2 text-[11px] text-white/30">terminal — agentforge</span>
      </div>
      <div className="space-y-1.5 min-h-[260px]">
        {lines.map((line, i) => (
          <div
            key={i}
            className="terminal-line-enter"
          >
            {line.startsWith('$') ? (
              <span className="text-emerald-400">{line}</span>
            ) : line.startsWith('✓') ? (
              <span className="text-sky-400">{line}</span>
            ) : line.startsWith('⠋') ? (
              <span className="text-amber-400">{line}</span>
            ) : (
              <span className="text-white/50">{line}</span>
            )}
          </div>
        ))}
        {lines.length < allLines.length && (
          <span className="inline-block w-2 h-4 bg-emerald-400/80 animate-pulse" />
        )}
      </div>
    </div>
  )
})

/* ─── Architecture layer data — stable reference ─── */
const ARCHITECTURE_LAYERS = [
  { icon: MessageSquare, title: 'Builder UI', description: 'ChatGPT-like interface to configure your agent — name, personality, knowledge base, tools, and model settings.', accent: 'from-indigo-500/20 to-transparent' },
  { icon: Cpu, title: 'API Gateway + Registry', description: 'Handles auth, rate limiting, and routing. Agent Registry stores configs, versions, and ownership data.', accent: 'from-cyan-500/20 to-transparent' },
  { icon: Box, title: 'Sandboxed Runtime', description: 'Each agent runs in its own isolated container — no shared memory, no cross-user access.', accent: 'from-emerald-500/20 to-transparent' },
  { icon: Lock, title: 'Shared Infrastructure', description: 'Postgres with row-level security, object storage per user, vector DB namespaced per tenant, job queues.', accent: 'from-violet-500/20 to-transparent' },
  { icon: Shield, title: 'Platform Services', description: 'Auth with OAuth, usage metering, per-container monitoring, and comprehensive admin dashboard.', accent: 'from-amber-500/20 to-transparent' },
  { icon: Terminal, title: 'Deploy Anywhere', description: 'Docker Compose on a VPS for starters. Migrate to ECS/EKS when scaling. Same isolation guarantees everywhere.', accent: 'from-rose-500/20 to-transparent' },
]

const TELEGRAM_STEPS = [
  'Create a bot via @BotFather in Telegram',
  'Paste the bot token in your agent settings',
  'Hit Publish — webhook is set up automatically',
  'Your agent responds on Telegram in real-time',
]

/* ─── Main Landing View ─── */
export function LandingView() {
  /* Parallax via ref — no state, no re-renders */
  const scrollRef = useRef(0)
  const orbsRef = useRef<HTMLDivElement[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY
          scrollRef.current = y
          // Direct DOM manipulation — zero React re-renders
          if (orbsRef.current[0]) orbsRef.current[0].style.transform = `translate3d(0, ${y * 0.08}px, 0)`
          if (orbsRef.current[1]) orbsRef.current[1].style.transform = `translate3d(0, ${y * -0.06}px, 0)`
          if (orbsRef.current[2]) orbsRef.current[2].style.transform = `translate3d(0, ${y * 0.05}px, 0)`
          if (orbsRef.current[3]) orbsRef.current[3].style.transform = `translate3d(0, ${y * -0.04}px, 0)`
          if (gridRef.current) gridRef.current.style.transform = `translate3d(0, ${y * 0.15}px, 0)`
          if (glowRef.current) glowRef.current.style.transform = `translate(-50%, ${y * 0.1}px)`
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const arch = useReveal(0.1)
  const telegram = useReveal(0.1)
  const cta = useReveal(0.1)

  return (
    <div className="min-h-screen flex flex-col bg-[#050508] text-white overflow-x-hidden landing-page">
      {/* ─── Floating gradient orbs (DOM-direct parallax — no React state) ─── */}
      <FloatingOrb
        className="w-[600px] h-[600px] bg-indigo-600/15 -top-40 -left-40"
        orbRef={(el) => { if (el) orbsRef.current[0] = el }}
      />
      <FloatingOrb
        className="w-[500px] h-[500px] bg-cyan-500/10 top-[30%] -right-60"
        orbRef={(el) => { if (el) orbsRef.current[1] = el }}
      />
      <FloatingOrb
        className="w-[400px] h-[400px] bg-violet-500/10 top-[65%] left-[10%]"
        orbRef={(el) => { if (el) orbsRef.current[2] = el }}
      />
      <FloatingOrb
        className="w-[350px] h-[350px] bg-emerald-500/8 top-[85%] right-[20%]"
        orbRef={(el) => { if (el) orbsRef.current[3] = el }}
      />

      {/* ─── Nav ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 landing-nav">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AgentForge</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[13px] text-white/50">
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="#integrations" className="hover:text-white transition-colors">Integrations</a>
            <a href="#deploy" className="hover:text-white transition-colors">Deploy</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="text-xs h-9 bg-white text-black hover:bg-white/90 font-medium"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative pt-36 pb-28 md:pt-52 md:pb-40">
        {/* Grid pattern (DOM-direct parallax) */}
        <div
          ref={gridRef}
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] parallax-orb"
        />

        {/* Radial glow (DOM-direct parallax) */}
        <div
          ref={glowRef}
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-b from-indigo-600/10 via-cyan-500/5 to-transparent pointer-events-none"
        />

        <div className="relative container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/50 mb-10 hero-badge-enter">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              self-hosted ai agent platform
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-7 leading-[1.05] hero-title-enter">
              <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
                Build agents
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                that actually work
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed hero-subtitle-enter">
              Create, configure, and deploy custom AI agents with isolated sandboxes,
              knowledge bases, and multi-channel integration. Self-hosted, fully controlled.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 hero-cta-enter">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white px-8 h-12 text-sm font-medium shadow-lg shadow-indigo-500/25 transition-shadow hover:shadow-indigo-500/40 active:scale-[0.98]"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <a
                href="#architecture"
                className="group flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                See how it works
                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ─── Architecture Section ─── */}
      <section id="architecture" className="relative py-28 md:py-40">
        <div
          ref={arch.ref}
          className={`container mx-auto px-4 md:px-6 transition-all duration-700 ${
            arch.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="max-w-2xl mx-auto text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.02] px-3 py-1 text-[11px] text-white/30 uppercase tracking-[0.2em] mb-6">
              <Layers className="h-3 w-3" />
              Architecture
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              <span className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                Six layers. Zero compromises.
              </span>
            </h2>
            <p className="text-white/35 leading-relaxed max-w-lg mx-auto">
              A complete architecture designed for security, scalability, and developer experience — from the builder UI down to the sandboxed runtime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] max-w-5xl mx-auto rounded-2xl overflow-hidden bg-white/[0.04]">
            {ARCHITECTURE_LAYERS.map((layer, i) => (
              <div
                key={layer.title}
                className="group relative bg-[#0a0a10] p-7 hover:bg-[#0d0d16] transition-colors duration-300 cursor-default"
                style={{
                  transitionDelay: arch.isVisible ? `${i * 60}ms` : '0ms',
                }}
              >
                {/* Hover gradient glow */}
                <div className={`absolute inset-0 bg-gradient-to-b ${layer.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-white/30 group-hover:text-white/70 transition-colors duration-200">
                      <layer.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-mono text-white/20 group-hover:text-white/40 transition-colors">0{i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-2.5 text-white/80 group-hover:text-white transition-colors duration-200">{layer.title}</h3>
                  <p className="text-[13px] text-white/25 leading-relaxed group-hover:text-white/45 transition-colors duration-200">{layer.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Telegram Integration + Terminal ─── */}
      <section id="integrations" className="relative py-28 md:py-40">
        <div
          ref={telegram.ref}
          className={`container mx-auto px-4 md:px-6 transition-all duration-700 ${
            telegram.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.02] px-3 py-1 text-[11px] text-white/30 uppercase tracking-[0.2em] mb-6">
                <Globe className="h-3 w-3" />
                Integrations
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
                <span className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                  Ship to Telegram
                </span>
                <br />
                <span className="text-white/30 text-2xl md:text-3xl">in four steps</span>
              </h2>
              <p className="text-white/35 mb-10 leading-relaxed max-w-md">
                Connect your agent to Telegram using BotFather.
                Your users can chat with your AI agent right from their phone, 24/7.
              </p>
              <div className="space-y-5">
                {TELEGRAM_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 group"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-xs font-mono text-white/30 group-hover:border-indigo-500/30 group-hover:text-indigo-400 transition-colors duration-200 shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-white/50 group-hover:text-white/80 transition-colors duration-200">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — chat mockup */}
            <div className="relative">
              {/* Glow behind */}
              <div className="absolute -inset-8 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 rounded-3xl blur-2xl pointer-events-none" />

              <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a0a0f]/90 p-6 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/[0.06]">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Send className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-xs text-white/80">@MySupportBot</div>
                    <div className="text-[10px] text-emerald-400/70 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                      online
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-gradient-to-r from-indigo-500/80 to-indigo-600/80 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] text-[13px]">
                      How do I reset my password?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%] text-[13px] text-white/70">
                      You can reset your password by clicking &quot;Forgot Password&quot; on the login page, or I can send you a reset link right now.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-gradient-to-r from-indigo-500/80 to-indigo-600/80 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] text-[13px]">
                      Send me the link please
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%] text-[13px] text-white/70">
                      Done! ✓ Check your email. The link expires in 24 hours.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Terminal Showcase ─── */}
      <section id="deploy" className="relative py-28 md:py-40">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.02] px-3 py-1 text-[11px] text-white/30 uppercase tracking-[0.2em] mb-6">
              <Terminal className="h-3 w-3" />
              Developer Experience
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              <span className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                From zero to deployed
              </span>
              <br />
              <span className="text-white/30 text-2xl md:text-3xl">in under a minute</span>
            </h2>
          </div>
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-emerald-500/8 via-transparent to-indigo-500/8 rounded-3xl blur-2xl pointer-events-none" />
            <AnimatedTerminal />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative py-32 md:py-44">
        <div
          ref={cta.ref}
          className={`container mx-auto px-4 md:px-6 text-center transition-all duration-700 ${
            cta.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          {/* Big gradient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-indigo-600/15 via-cyan-500/10 to-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <Sparkles className="h-6 w-6 text-indigo-400/50 mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Ready to build something real?
              </span>
            </h2>
            <p className="text-white/30 max-w-lg mx-auto mb-10 leading-relaxed">
              Stop paying per API call to platforms you don&apos;t control.
              Self-host your own agent infrastructure.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white px-10 h-12 text-sm font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow active:scale-[0.98]"
              >
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-cyan-400">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-xs text-white/60">AgentForge</span>
          </div>
          <p className="text-[11px] text-white/20">
            Self-hosted AI agent builder. Open source and production ready.
          </p>
        </div>
      </footer>
    </div>
  )
}
