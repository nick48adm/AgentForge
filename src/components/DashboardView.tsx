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
  MoreVertical,
  Pencil,
  Play,
  Square,
  Trash2,
  Send,
  Loader2,
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

  const statusStyles: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    deploying: 'bg-foreground/10 text-foreground',
    published: 'bg-foreground text-background',
    stopped: 'bg-red-500/10 text-red-400',
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          {user?.name || 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your AI agents and monitor usage.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: 'Agents',
            value: usage?.agentCount ?? agents.length,
            icon: Bot,
          },
          {
            label: 'Published',
            value: usage?.publishedCount ?? 0,
            icon: Play,
          },
          {
            label: 'Conversations',
            value: usage?.conversationCount ?? 0,
            icon: MessageSquare,
          },
          {
            label: 'Tokens Used',
            value: ((usage?.totalTokensIn ?? 0) + (usage?.totalTokensOut ?? 0)).toLocaleString(),
            icon: Zap,
          },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold tracking-tight">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agents Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Agents</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 h-8 text-xs">
              <Plus className="h-3 w-3 mr-1.5" />
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
                className="w-full bg-foreground text-background hover:bg-foreground/90"
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
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No agents yet</h3>
            <p className="text-xs text-muted-foreground mb-6 text-center max-w-sm">
              Create your first AI agent. Configure its personality, tools, and knowledge base,
              then deploy it to a sandboxed environment.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1.5" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => {
            const StatusIcon = statusIcons[agent.status] || Pencil
            return (
              <Card
                key={agent.id}
                className="border-border/50 hover:border-border transition-all cursor-pointer group"
                onClick={() => {
                  setSelectedAgentId(agent.id)
                  setView('builder')
                }}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                        {agent.avatar || agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-sm">{agent.name}</CardTitle>
                        <CardDescription className="text-[10px] font-mono">
                          {agent.model}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-3.5 w-3.5" />
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
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {agent.status === 'published' ? (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStopAgent(agent.id)
                            }}
                          >
                            <Square className="h-3.5 w-3.5 mr-2" />
                            Stop
                          </DropdownMenuItem>
                        ) : agent.status === 'deploying' ? (
                          <DropdownMenuItem disabled>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            Deploying...
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeployAgent(agent.id)
                            }}
                          >
                            <Play className="h-3.5 w-3.5 mr-2" />
                            Deploy
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAgent(agent.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className={`text-[10px] h-5 ${statusStyles[agent.status]}`}>
                      <StatusIcon className={`h-2.5 w-2.5 mr-0.5 ${agent.status === 'deploying' ? 'animate-spin' : ''}`} />
                      {agent.status}
                    </Badge>
                    {agent.telegramConnection?.isActive && (
                      <Badge variant="secondary" className="text-[10px] h-5 bg-muted text-muted-foreground">
                        <Send className="h-2.5 w-2.5 mr-0.5" />
                        Telegram
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-5 bg-muted text-muted-foreground font-mono">
                      v{agent.version}
                    </Badge>
                  </div>
                  {agent.description && (
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
                      {agent.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Create New Agent Card */}
          <Card
            className="border-dashed border-2 hover:border-foreground/20 transition-colors cursor-pointer"
            onClick={() => setCreateOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center mb-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">New Agent</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
