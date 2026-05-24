'use client'

import { useState, useEffect } from 'react'
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
      const headers = { 'x-user-id': user.id }
      try {
        const [usersRes, agentsRes] = await Promise.all([
          fetch('/api/admin/users', { headers }),
          fetch('/api/admin/agents', { headers }),
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ status }),
      })
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status } : a)))
    } catch {}
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    deploying: 'bg-amber-500/10 text-amber-500',
    published: 'bg-emerald-500/10 text-emerald-500',
    stopped: 'bg-red-500/10 text-red-500',
    suspended: 'bg-red-500/10 text-red-500',
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-emerald-500" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Manage users, agents, and platform resources.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">{users.length}</div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-cyan-500" />
              <div>
                <div className="text-2xl font-bold">{agents.length}</div>
                <div className="text-xs text-muted-foreground">Total Agents</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">
                  {agents.filter((a) => a.status === 'published').length}
                </div>
                <div className="text-xs text-muted-foreground">Published</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-violet-500" />
              <div>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'admin').length}
                </div>
                <div className="text-xs text-muted-foreground">Admins</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          u.plan === 'pro' ? 'bg-emerald-500/10 text-emerald-500' :
                          u.plan === 'enterprise' ? 'bg-violet-500/10 text-violet-500' :
                          'bg-muted'
                        }>
                          {u.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          u.role === 'admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted'
                        }>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u._count.agents}</TableCell>
                      <TableCell>
                        <Select
                          value={u.plan}
                          onValueChange={(plan) => updateUserPlan(u.id, plan)}
                        >
                          <SelectTrigger className="h-8 w-24">
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
            <CardHeader>
              <CardTitle>All Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conversations</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.user.email || a.user.name}</TableCell>
                      <TableCell>{a.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[a.status] || 'bg-muted'}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{a._count.conversations}</TableCell>
                      <TableCell>
                        <Select
                          value={a.status}
                          onValueChange={(status) => updateAgentStatus(a.id, status)}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="stopped">Stopped</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
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
