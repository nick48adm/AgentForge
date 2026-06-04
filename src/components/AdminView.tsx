'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, Users, Bot, BarChart3, Loader2, AlertCircle } from 'lucide-react'

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  role: string
  plan: string
  createdAt: string
  _count: { agents: number }
}

interface AdminAgent {
  id: string
  name: string
  model: string
  status: string
  version: number
  user: { name: string | null; email: string | null }
  telegramConnection?: { botUsername: string | null; isActive: boolean } | null
  _count: { conversations: number; usageLogs: number }
}

export function AdminView() {
  const { user } = useAppStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') return

    const fetchData = async () => {
      try {
        const [usersRes, agentsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/agents'),
        ])
        if (usersRes.ok) setUsers(await usersRes.json())
        if (agentsRes.ok) setAgents(await agentsRes.json())
      } catch {}
      setLoading(false)
    }
    fetchData()
  }, [user])

  const updateUserPlan = async (userId: string, plan: string) => {
    if (!user?.id) return
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)))
    } catch {}
  }

  const updateAgentStatus = async (agentId: string, status: string) => {
    if (!user?.id) return
    try {
      await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status } : a)))
    } catch {}
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Admin access required</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statusStyles = useMemo<Record<string, string>>(() => ({
    draft: 'bg-muted text-muted-foreground',
    deploying: 'bg-foreground/10 text-foreground',
    published: 'bg-foreground text-background',
    stopped: 'bg-red-500/10 text-red-400',
    suspended: 'bg-red-500/10 text-red-400',
  }), [])

  const planStyles = useMemo<Record<string, string>>(() => ({
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-foreground text-background',
    enterprise: 'bg-foreground/70 text-background',
  }), [])

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, agents, and platform resources.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Users, value: users.length, label: 'Users' },
          { icon: Bot, value: agents.length, label: 'Agents' },
          { icon: BarChart3, value: agents.filter((a) => a.status === 'published').length, label: 'Published' },
          { icon: Shield, value: users.filter((u) => u.role === 'admin').length, label: 'Admins' },
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

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Agents</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-xs">{u.name || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] h-5 ${planStyles[u.plan] || 'bg-muted'}`}>
                          {u.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          u.role === 'admin' ? 'text-[10px] h-5 bg-foreground text-background' : 'text-[10px] h-5 bg-muted text-muted-foreground'
                        }>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{u._count.agents}</TableCell>
                      <TableCell>
                        <Select
                          value={u.plan}
                          onValueChange={(plan) => updateUserPlan(u.id, plan)}
                        >
                          <SelectTrigger className="h-7 w-20 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Model</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Convos</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-xs">{a.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.user.email || a.user.name}</TableCell>
                      <TableCell className="text-xs font-mono">{a.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] h-5 ${statusStyles[a.status] || 'bg-muted'}`}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{a._count.conversations}</TableCell>
                      <TableCell>
                        <Select
                          value={a.status}
                          onValueChange={(status) => updateAgentStatus(a.id, status)}
                        >
                          <SelectTrigger className="h-7 w-24 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="stopped">Stopped</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
