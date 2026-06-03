'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Bot,
  Plus,
  MessageSquare,
  Zap,
  TrendingUp,
  MoreVertical,
  Pencil,
  Play,
  Square,
  Trash2,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Agent {
  id: string
  name: string
  description: string
  avatar: string | null
  model: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
  telegramConnection?: { botUsername: string; isActive: boolean } | null
  _count?: { conversations: number }
}

interface UsageData {
  totalTokensIn: number
  totalTokensOut: number
  totalCost: number
  agentCount: number
  publishedCount: number
  conversationCount: number
}

export function DashboardView() {
  const { user, setView, setSelectedAgentId } = useAppStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [creating, setCreating] = useState(false)
  const deployPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (deployPollRef.current) {
        clearInterval(deployPollRef.current)
        deployPollRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      try {
        const [agentsRes, usageRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/usage'),
        ])
        if (agentsRes.ok) setAgents(await agentsRes.json())
        if (usageRes.ok) setUsage(await usageRes.json())
      } catch (err) {
        console.error('[dashboard] Failed to load data:', err)
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.ok) setAgents(await res.json())
    } catch (err) {
      console.error('[dashboard] Failed to fetch agents:', err)
    }
  }

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAgentName }),
      })
      if (res.ok) {
        const agent = await res.json()
        setNewAgentName('')
        setCreateOpen(false)
        setSelectedAgentId(agent.id)
        setView('builder')
      }
    } catch (err) {
      console.error('[dashboard] Failed to create agent:', err)
    }
    setCreating(false)
  }

  const handleDeleteAgent = async (id: string) => {
    try {
      await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      fetchAgents()
    } catch (err) {
      console.error('[dashboard] Failed to delete agent:', err)
    }
  }

  const startDeployPoll = () => {
    if (deployPollRef.current) return
    deployPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/agents')
        if (res.ok) {
          const data: Agent[] = await res.json()
          setAgents(data)
          const hasDeploying = data.some(a => a.status === 'deploying')
          if (!hasDeploying && deployPollRef.current) {
            clearInterval(deployPollRef.current)
            deployPollRef.current = null
          }
        }
      } catch (err) {
        console.error('[dashboard] Deploy poll error:', err)
      }
    }, 2000)
  }

  const handleDeployAgent = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: 'POST' })
      if (res.ok) {
        fetchAgents()
        startDeployPoll()
      }
    } catch (err) {
      console.error('[dashboard] Failed to deploy agent:', err)
    }
  }

  const handleStopAgent = async (id: string) => {
    try {
      await fetch(`/api/agents/${id}/stop`, { method: 'POST' })
      fetchAgents()
    } catch (err) {
      console.error('[dashboard] Failed to stop agent:', err)
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    deploying: 'bg-amber-500/10 text-amber-500',
    published: 'bg-emerald-500/10 text-emerald-500',
    stopped: 'bg-red-500/10 text-red-500',
  }

  const statusIcons: Record<string, typeof Pencil> = {
    draft: Pencil,
    deploying: Loader2,
    published: Play,
    stopped: Square,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">
          Welcome back, {user?.name || 'User'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your AI agents and monitor usage.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Agents',
            value: usage?.agentCount ?? agents.length,
            icon: Bot,
            color: 'text-emerald-500',
          },
          {
            label: 'Published',
            value: usage?.publishedCount ?? 0,
            icon: Play,
            color: 'text-emerald-500',
          },
          {
            label: 'Conversations',
            value: usage?.conversationCount ?? 0,
            icon: MessageSquare,
            color: 'text-cyan-500',
          },
          {
            label: 'Tokens Used',
            value: ((usage?.totalTokensIn ?? 0) + (usage?.totalTokensOut ?? 0)).toLocaleString(),
            icon: Zap,
            color: 'text-amber-500',
          },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className={`${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agents Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">My Agents</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Give your agent a name. You can configure all other settings in the builder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Agent name (e.g., Support Bot)"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
              />
              <Button
                onClick={handleCreateAgent}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={creating || !newAgentName.trim()}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Create your first AI agent. Configure its personality, tools, and knowledge base,
              then deploy it to a sandboxed environment.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const StatusIcon = statusIcons[agent.status] || Pencil
            return (
              <Card
                key={agent.id}
                className="border-border/50 hover:border-border transition-all hover:shadow-md cursor-pointer group"
                onClick={() => {
                  setSelectedAgentId(agent.id)
                  setView('builder')
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-lg">
                        {agent.avatar || agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {agent.model}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAgentId(agent.id)
                            setView('builder')
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {agent.status === 'published' ? (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStopAgent(agent.id)
                            }}
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Stop
                          </DropdownMenuItem>
                        ) : agent.status === 'deploying' ? (
                          <DropdownMenuItem disabled>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deploying…
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeployAgent(agent.id)
                            }}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Deploy
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAgent(agent.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={statusColors[agent.status]}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${agent.status === 'deploying' ? 'animate-spin' : ''}`} />
                      {agent.status}
                    </Badge>
                    {agent.telegramConnection?.isActive && (
                      <Badge variant="secondary" className="bg-sky-500/10 text-sky-500">
                        <Send className="h-3 w-3 mr-1" />
                        Telegram
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      v{agent.version}
                    </Badge>
                  </div>
                  {agent.description && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                      {agent.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Create New Agent Card */}
          <Card
            className="border-dashed border-2 hover:border-emerald-500/50 transition-colors cursor-pointer"
            onClick={() => setCreateOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">New Agent</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
