'use client'

import { useAppStore } from '@/lib/store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Shield, Users, Bot, Activity, Loader2, Server, DollarSign, Zap, RefreshCw, Skull } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function AdminView() {
  const { user } = useAppStore()
  const queryClient = useQueryClient()

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    enabled: user?.role === 'admin',
    refetchInterval: 15000, // auto-refresh every 15s
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: user?.role === 'admin',
  })

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: user?.role === 'admin',
  })

  const { data: usage } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: async () => {
      const res = await fetch('/api/usage')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: user?.role === 'admin',
  })

  const updateUser = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated') },
    onError: () => toast.error('Failed to update user'),
  })

  const killAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/admin/agents/${agentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Container killed')
    },
    onError: () => toast.error('Failed to kill container'),
  })

  const chartData = usage?.dailyUsage
    ? Object.entries(usage.dailyUsage).map(([date, data]: [string, any]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tokens: data.tokensIn + data.tokensOut,
        messages: data.count,
        cost: parseFloat(data.cost?.toFixed(4) || '0'),
      }))
    : []

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-1">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to view this page.</p>
        </div>
      </div>
    )
  }

  const p = stats?.platform || {}

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-emerald-600" /> Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Live platform overview and controls.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchStats()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </motion.div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { icon: Users, label: 'Users', value: p.totalUsers ?? '—', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
          { icon: Bot, label: 'Agents', value: p.totalAgents ?? '—', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
          { icon: Activity, label: 'Active', value: p.activeAgents ?? '—', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
          { icon: Server, label: 'Containers', value: stats?.containers?.length ?? '—', color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
          { icon: Zap, label: 'Msgs Today', value: p.todayMessages ?? '—', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
          { icon: DollarSign, label: 'Cost Today', value: p.todayCost ? `$${p.todayCost}` : '—', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
          { icon: DollarSign, label: 'Total Rev', value: p.totalRevenue ? `$${p.totalRevenue}` : '—', color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center ${color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-bold">{statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="containers">
        <TabsList className="grid grid-cols-4 w-full max-w-lg mb-4">
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        {/* Live Containers Tab */}
        <TabsContent value="containers">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Server className="w-5 h-5" />Live Sandbox Containers</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : stats?.containers?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No containers running.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Container</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Kill</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.containers || []).map((c: any) => {
                        // Extract agentId from container name: af-agent-{agentId12}-v{N}
                        const match = c.name?.match(/af-agent-([a-z0-9]+)-v\d+/)
                        const agentId = match ? agents.find((a: any) => a.id.startsWith(match[1]))?.id : null
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.name}</TableCell>
                            <TableCell>
                              <Badge className={c.status?.startsWith('Up') ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                                {c.status?.split(' ')[0] || 'unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{c.cpu || '—'}</TableCell>
                            <TableCell className="text-sm">{c.mem || '—'}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost" size="sm"
                                className="text-xs text-red-600 hover:text-red-700"
                                disabled={!agentId || killAgent.isPending}
                                onClick={() => agentId && killAgent.mutate(agentId)}
                              >
                                <Skull className="w-3.5 h-3.5 mr-1" />Kill
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-lg">All Users ({users.length})</CardTitle></CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Agents</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Select value={u.plan} onValueChange={plan => updateUser.mutate({ userId: u.id, data: { plan } })}>
                              <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{u._count?.agents ?? 0}</TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={role => updateUser.mutate({ userId: u.id, data: { role } })}>
                              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader><CardTitle className="text-lg">All Agents ({agents.length})</CardTitle></CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto">
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
                      {agents.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{a.user?.email}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.model}</code></TableCell>
                          <TableCell>
                            <Badge className={
                              a.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              a.status === 'stopped' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''
                            }>{a.status}</Badge>
                          </TableCell>
                          <TableCell>{a._count?.conversations ?? 0}</TableCell>
                          <TableCell>
                            {a.status === 'published' && (
                              <Button variant="ghost" size="sm" className="text-xs text-red-600"
                                onClick={() => killAgent.mutate(a.id)} disabled={killAgent.isPending}>
                                <Skull className="w-3 h-3 mr-1" />Kill
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Token Usage (30 Days)</CardTitle></CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="tokens" fill="#10b981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">No usage data yet</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Cost (30 Days)</CardTitle></CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">No usage data yet</div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-lg">Platform Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Messages', value: usage?.summary?.totalMessages?.toLocaleString() || '0' },
                  { label: 'Tokens In', value: usage?.summary?.totalTokensIn?.toLocaleString() || '0' },
                  { label: 'Tokens Out', value: usage?.summary?.totalTokensOut?.toLocaleString() || '0' },
                  { label: 'Total Cost', value: `$${(usage?.summary?.totalCost || 0).toFixed(4)}` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
